/**
 * Run with: pnpm --ignore-workspace exec node --import tsx --test tests/ai-risk-backend.test.ts
 * The indexed in-memory adapter exercises the actual registered handlers. It is
 * not a substitute for a deployed Convex transaction/concurrency integration test.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test, { type TestContext } from "node:test";
import { ConvexError } from "convex/values";
import type { RegisteredMutation, RegisteredQuery } from "convex/server";
import type { MutationCtx } from "../convex/_generated/server";
import {
  clearFeedback,
  clearForecasts,
  getFeedback,
  getSummary,
  rate,
  saveForecasts,
} from "../convex/aiRisk";
import {
  LONG_RUN_OUTCOMES,
  OUTCOMES,
  validateForecasts,
  validateSlots,
  validateVoterKey,
} from "../convex/aiRiskValidation";

const ALICE = "00000000-0000-4000-a000-000000000001";
const BOB = "00000000-0000-4000-a000-000000000002";
const SLOT = "ai-risk:extinction:chart";
const TEST_SESSION_SECRET = "ai-risk-test-session-secret-is-not-a-real-secret";
const testPayload = Buffer.from(JSON.stringify({ scope: "ai-risk", exp: 604800 })).toString("base64url");
const TEST_ACCESS_TOKEN = `${testPayload}.${createHmac("sha256", TEST_SESSION_SECRET).update(testPayload).digest("base64url")}`;
type Row = Record<string, unknown> & { _id: string };

class MemoryDb {
  rows = new Map<string, Row>();
  nextId = 0;

  query(table: string) {
    return {
      withIndex: (
        _index: string,
        select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
      ) => {
        const matches: Array<[string, unknown]> = [];
        const range = {
          eq(field: string, value: unknown) {
            matches.push([field, value]);
            return range;
          },
        };
        select(range);
        assert.ok(matches.length, "Every handler read must use an indexed equality range");
        const found = () => [...this.rows.values()].filter((row) =>
          row._id.startsWith(`${table}:`) && matches.every(([field, value]) => row[field] === value),
        );
        return {
          unique: async () => {
            const rows = found();
            assert.ok(rows.length <= 1, "The indexed upsert must preserve uniqueness");
            return rows[0] ? structuredClone(rows[0]) : null;
          },
          take: async (n: number) => {
            assert.ok(n <= 8, "Private response reads must remain bounded");
            return structuredClone(found().slice(0, n));
          },
        };
      },
    };
  }

  async insert(table: string, values: Record<string, unknown>) {
    const id = `${table}:${++this.nextId}`;
    this.rows.set(id, structuredClone({ ...values, _id: id }));
    return id;
  }

  async patch(id: string, values: Record<string, unknown>) {
    const row = this.rows.get(id);
    assert.ok(row, "Can only update a row that exists");
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete row[key];
      else row[key] = structuredClone(value);
    }
  }
}

function fixture(t: TestContext) {
  const previousSecret = process.env.AI_RISK_SESSION_SECRET;
  process.env.AI_RISK_SESSION_SECRET = TEST_SESSION_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.AI_RISK_SESSION_SECRET;
    else process.env.AI_RISK_SESSION_SECRET = previousSecret;
  });
  const db = new MemoryDb();
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const ctx = { db } as unknown as MutationCtx;
  return {
    db,
    advance: () => { now += 1000; },
    async call<A extends Record<string, unknown>, R>(
      this: void,
      registered: RegisteredMutation<"public", A, Promise<R>> | RegisteredQuery<"public", A, Promise<R>>,
      args: Omit<A, "accessToken"> & { accessToken?: string },
    ): Promise<R> {
      // Convex rolls back all writes if a handler throws.
      const before = structuredClone(db.rows);
      try {
        // _handler exists at runtime but is marked internal in Convex's public declarations.
        const { _handler } = registered as unknown as {
          _handler: (ctx: MutationCtx, args: A) => Promise<R>;
        };
        return await _handler(ctx, { accessToken: TEST_ACCESS_TOKEN, ...args } as unknown as A);
      } catch (error) {
        db.rows = before;
        throw error;
      }
    },
  };
}

const longRun = (values: number[]) => LONG_RUN_OUTCOMES.map((outcomeId, index) => ({
  outcomeId,
  value: values[index],
}));

await test("forecast validation accepts boundaries and decimal allocations without floating-point sum errors", () => {
  assert.deepEqual(validateForecasts([
    { outcomeId: "extinction", value: 0 },
    { outcomeId: "extinction-century", value: 100 },
    { outcomeId: "loss-of-control", value: 30.1 },
  ]).map(({ bin }) => bin), [0, 1000, 301]);
  assert.equal(validateForecasts(longRun([0.1, 0.2, 0.3, 0.4, 99])).length, 5);
  assert.equal(validateForecasts([{ outcomeId: "extinction", value: 0.1 + 0.2 }])[0].value, 0.3);
});

await test("malformed percentages, duplicate IDs, mixed groups, and incomplete outcome allocations are rejected", () => {
  const invalid = [
    [],
    [{ outcomeId: "invented", value: 30 }],
    ...[-0.1, 100.1, NaN, Infinity, -Infinity, 10.55].map((value) => [{ outcomeId: "extinction", value }]),
    [{ outcomeId: "extinction", value: 1 }, { outcomeId: "extinction", value: 2 }],
    [{ outcomeId: "extinction", value: 1 }, { outcomeId: "good", value: 99 }],
    [{ outcomeId: "good", value: 100 }],
    longRun([10, 10, 10, 10, 10]),
    [...longRun([20, 20, 20, 20, 20]), { outcomeId: "extinction", value: 20 }],
  ];
  for (const values of invalid) assert.throws(() => validateForecasts(values), ConvexError);
});

await test("browser token and feedback batch validation bound public inputs", () => {
  assert.doesNotThrow(() => validateVoterKey(ALICE));
  assert.doesNotThrow(() => validateVoterKey("a".repeat(128)));
  for (const key of ["", "a".repeat(35), "a".repeat(129), " ".repeat(36), `<${"x".repeat(36)}>`]) {
    assert.throws(() => validateVoterKey(key), ConvexError);
  }
  assert.doesNotThrow(() => validateSlots([SLOT]));
  assert.doesNotThrow(() => validateSlots([]));
  for (const slots of [
    ["ipo:chart"], ["ai-risk:"], ["ai-risk:UPPER"], ["ai-risk:with space"],
    [`ai-risk:${"a".repeat(113)}`], [SLOT, SLOT],
    Array.from({ length: 51 }, (_, i) => `ai-risk:${i}`),
  ]) assert.throws(() => validateSlots(slots), ConvexError);
});

await test("an empty deployment returns all eight empty distributions without seeded responses", async (t) => {
  const { call } = fixture(t);
  assert.deepEqual(await call(getSummary, { voterKey: ALICE }), {
    distributions: OUTCOMES.map((outcomeId) => ({ outcomeId, n: 0, values: [] })),
    mine: {},
  });
  assert.deepEqual(await call(getFeedback, { voterKey: ALICE, slots: [SLOT] }), [{
    slot: SLOT, useful: 0, somewhat_useful: 0, not_useful: 0,
  }]);
});

await test("updating and repeating an answer replaces its histogram contribution instead of adding voters", async (t) => {
  const { call, advance, db } = fixture(t);
  const answer = (value: number) => [{ outcomeId: "extinction", value }];
  assert.deepEqual(await call(saveForecasts, { voterKey: ALICE, values: answer(70) }), { saved: 1 });
  await call(saveForecasts, { voterKey: BOB, values: answer(20) });
  advance();
  await call(saveForecasts, { voterKey: ALICE, values: answer(30.1) });
  advance();
  await call(saveForecasts, { voterKey: ALICE, values: answer(30.1) });
  const alice = await call(getSummary, { voterKey: ALICE });
  assert.deepEqual(alice.distributions[0], {
    outcomeId: "extinction", n: 2, values: [{ value: 20, count: 1 }, { value: 30.1, count: 1 }],
  });
  assert.deepEqual(alice.mine, { extinction: 30.1 });
  const bob = await call(getSummary, { voterKey: BOB });
  assert.deepEqual(bob.mine, { extinction: 20 });
  assert.ok(!JSON.stringify(alice).includes(ALICE) && !JSON.stringify(alice).includes(BOB));
  assert.equal([...db.rows.values()].filter((row) => row._id.startsWith("aiRiskForecasts:")).length, 2);
});

await test("long-run allocation is saved together, invalid revisions preserve it, and independent risks are retained", async (t) => {
  const { call, advance } = fixture(t);
  await call(saveForecasts, { voterKey: ALICE, values: [{ outcomeId: "loss-of-control", value: 5 }] });
  advance();
  await call(saveForecasts, { voterKey: ALICE, values: longRun([10, 20, 30, 20, 20]) });
  const before = await call(getSummary, { voterKey: ALICE });
  advance();
  await assert.rejects(call(saveForecasts, { voterKey: ALICE, values: longRun([10, 20, 30, 20, 21]) }), ConvexError);
  assert.deepEqual(await call(getSummary, { voterKey: ALICE }), before);
  await call(saveForecasts, { voterKey: ALICE, values: longRun([0.1, 0.2, 0.3, 0.4, 99]) });
  const after = await call(getSummary, { voterKey: ALICE });
  assert.equal(after.mine["loss-of-control"], 5);
  assert.equal(after.mine["extremely-bad"], 99);
  assert.equal(after.distributions[7].n, 1);
  assert.deepEqual(after.distributions[7].values, [{ value: 99, count: 1 }]);
});

await test("clearing forecasts soft-deletes only this browser's rows and allows a correct later resubmission", async (t) => {
  const { call, advance, db } = fixture(t);
  await call(saveForecasts, { voterKey: ALICE, values: longRun([20, 20, 20, 20, 20]) });
  await call(saveForecasts, { voterKey: BOB, values: longRun([20, 20, 20, 20, 20]) });
  advance();
  await call(saveForecasts, { voterKey: ALICE, values: [
    { outcomeId: "extinction", value: 0 },
    { outcomeId: "extinction-century", value: 100 },
    { outcomeId: "loss-of-control", value: 10 },
  ] });
  assert.deepEqual(await call(clearForecasts, { voterKey: ALICE }), { cleared: 8 });
  assert.deepEqual(await call(clearForecasts, { voterKey: ALICE }), { cleared: 0 });
  const cleared = await call(getSummary, { voterKey: ALICE });
  assert.deepEqual(cleared.mine, {});
  assert.equal(cleared.distributions[0].n, 0);
  assert.equal(cleared.distributions[7].n, 1);
  const rows = [...db.rows.values()].filter((row) => row._id.startsWith("aiRiskForecasts:") && row.voterKey === ALICE);
  assert.equal(rows.length, 8);
  assert.ok(rows.every((row) => typeof row.deletedAt === "number"));
  advance();
  await call(saveForecasts, { voterKey: ALICE, values: [{ outcomeId: "extinction", value: 100 }] });
  const revived = await call(getSummary, { voterKey: ALICE });
  assert.deepEqual(revived.distributions[0], { outcomeId: "extinction", n: 1, values: [{ value: 100, count: 1 }] });
  assert.deepEqual(revived.mine, { extinction: 100 });
});

await test("rapid writes are throttled per browser and separately for forecasts and usefulness", async (t) => {
  const { call, advance } = fixture(t);
  const values = [{ outcomeId: "extinction", value: 10 }];
  await call(saveForecasts, { voterKey: ALICE, values });
  await assert.rejects(call(saveForecasts, { voterKey: ALICE, values }), /wait a moment/);
  await call(rate, { voterKey: ALICE, slot: SLOT, rating: "useful" });
  await assert.rejects(call(rate, { voterKey: ALICE, slot: SLOT, rating: "not_useful" }), /wait a moment/);
  await call(saveForecasts, { voterKey: BOB, values });
  advance();
  await call(saveForecasts, { voterKey: ALICE, values });
  assert.equal((await call(getSummary, { voterKey: ALICE })).distributions[0].n, 2);
});

await test("usefulness votes aggregate, replace, clear, and revive without leaking other browser tokens", async (t) => {
  const { call, advance, db } = fixture(t);
  await call(rate, { voterKey: ALICE, slot: SLOT, rating: "useful" });
  await call(rate, { voterKey: BOB, slot: SLOT, rating: "somewhat_useful" });
  advance();
  await call(rate, { voterKey: ALICE, slot: SLOT, rating: "not_useful" });
  advance();
  await call(rate, { voterKey: ALICE, slot: SLOT, rating: "not_useful" });
  const before = await call(getFeedback, { voterKey: ALICE, slots: [SLOT] });
  assert.deepEqual(before, [{ slot: SLOT, useful: 0, somewhat_useful: 1, not_useful: 1, mine: "not_useful" }]);
  assert.ok(!JSON.stringify(before).includes(ALICE) && !JSON.stringify(before).includes(BOB));
  assert.deepEqual(await call(clearFeedback, { voterKey: ALICE, slots: [SLOT] }), { cleared: 1 });
  assert.deepEqual(await call(clearFeedback, { voterKey: ALICE, slots: [SLOT] }), { cleared: 0 });
  assert.deepEqual(await call(getFeedback, { voterKey: BOB, slots: [SLOT] }), [{
    slot: SLOT, useful: 0, somewhat_useful: 1, not_useful: 0, mine: "somewhat_useful",
  }]);
  assert.ok([...db.rows.values()].some((row) => row._id.startsWith("aiRiskFeedback:") && row.voterKey === ALICE && row.deletedAt));
  advance();
  await call(rate, { voterKey: ALICE, slot: SLOT, rating: "useful" });
  assert.deepEqual(await call(getFeedback, { voterKey: ALICE, slots: [SLOT] }), [{
    slot: SLOT, useful: 1, somewhat_useful: 1, not_useful: 0, mine: "useful",
  }]);
});

await test("invalid public requests fail before any stored data changes", async (t) => {
  const { call, db } = fixture(t);
  await assert.rejects(call(saveForecasts, { voterKey: "short", values: [{ outcomeId: "extinction", value: 1 }] }), ConvexError);
  await assert.rejects(call(saveForecasts, { voterKey: ALICE, values: [{ outcomeId: "good", value: 100 }] }), ConvexError);
  await assert.rejects(call(rate, { voterKey: ALICE, slot: "ipo:chart", rating: "useful" }), ConvexError);
  await assert.rejects(call(getFeedback, { voterKey: ALICE, slots: Array.from({ length: 51 }, (_, i) => `ai-risk:${i}`) }), ConvexError);
  assert.equal(db.rows.size, 0);
});

await test("every public AI risk handler rejects an unauthorized caller before reading or writing data", async (t) => {
  const { call, db } = fixture(t);
  t.mock.method(db, "query", () => { throw new Error("Unauthorized database read"); });
  const denied = { accessToken: "invalid", voterKey: ALICE };
  const message = /Enter the AI risk page password again/;
  await assert.rejects(call(getSummary, denied), message);
  await assert.rejects(call(getFeedback, { ...denied, slots: [SLOT] }), message);
  await assert.rejects(call(saveForecasts, { ...denied, values: [{ outcomeId: "extinction", value: 10 }] }), message);
  await assert.rejects(call(clearForecasts, denied), message);
  await assert.rejects(call(rate, { ...denied, slot: SLOT, rating: "useful" }), message);
  await assert.rejects(call(clearFeedback, { ...denied, slots: [SLOT] }), message);
  assert.equal(db.rows.size, 0);
});

await test("number and quote accuracy votes remain independent of each other and legacy usefulness votes", async (t) => {
  const { call, advance } = fixture(t);
  const oldSlot = "ai-risk:quote:daniel-70-2025";
  const numberSlot = "ai-risk:number-accuracy:daniel-70-2025";
  const quoteSlot = "ai-risk:quote-accuracy:daniel-70-2025";
  await call(rate, { voterKey: ALICE, slot: oldSlot, rating: "useful" });
  assert.deepEqual(await call(getFeedback, { voterKey: ALICE, slots: [numberSlot, quoteSlot] }), [numberSlot, quoteSlot].map(slot => ({ slot, useful: 0, somewhat_useful: 0, not_useful: 0 })));
  advance();
  await call(rate, { voterKey: ALICE, slot: numberSlot, rating: "somewhat_useful" });
  advance();
  await call(rate, { voterKey: ALICE, slot: quoteSlot, rating: "not_useful" });
  const tallies = await call(getFeedback, { voterKey: ALICE, slots: [oldSlot, numberSlot, quoteSlot] });
  assert.deepEqual(tallies.map(tally => tally.mine), ["useful", "somewhat_useful", "not_useful"]);
});
