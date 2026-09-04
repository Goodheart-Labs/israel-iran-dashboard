import assert from "node:assert/strict";
import test from "node:test";
import { fetchPolymarketHistory, mergeRecordedHistory } from "./polymarketHistory";

void test("history merge preserves stored observations and chronological order", () => {
  const recorded = [{ timestamp: 2, probability: 20 }];
  assert.deepEqual(mergeRecordedHistory(recorded, [
    { timestamp: 2, probability: 99 }, { timestamp: 1, probability: 10 },
  ]), [{ timestamp: 1, probability: 10 }, { timestamp: 2, probability: 20 }]);
  assert.equal(recorded.length, 1);
});

void test("loader selects the exact question and Yes token, converts units and rejects invalid points", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    urls.push(input);
    return new Response(JSON.stringify(urls.length === 1 ? [
      { slug: "unrelated", outcomes: ["Yes", "No"], clobTokenIds: ["wrong", "also-wrong"] },
      { slug: "target", outcomes: '["No","Yes"]', clobTokenIds: '["no-token","yes-token"]' },
    ] : { history: [{ t: 2, p: 0.14 }, { t: 1, p: 0.2 }, { t: 3, p: 2 }] }));
  });
  const history = await fetchPolymarketHistory("target");
  assert.ok(urls[1].includes("market=yes-token&interval=max&fidelity=1440"));
  assert.deepEqual(history.map((p) => p.timestamp), [1000, 2000]);
  assert.equal(history[0].probability, 20);
  assert.ok(Math.abs(history[1].probability - 14) < 0.00001);
});

void test("loader fails explicitly if an exact market is unavailable", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("[]"));
  await assert.rejects(fetchPolymarketHistory("missing"), /Exact market not found/);
});
