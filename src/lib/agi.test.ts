import assert from "node:assert/strict";
import test from "node:test";
import { agiChartRows, agiDashboardSchema } from "./agi";

void test("AGI histories retain medians and interval bounds without extending sources", () => {
  const rows = agiChartRows([
    {
      id: "index",
      points: [{ date: "2026-01-01", value: 2031, range: [2027, 2044] }],
    },
    { id: "source", points: [{ date: "2025-01-01", value: 2035 }] },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].source, 2035);
  assert.equal(rows[0].index, undefined);
  assert.equal(rows[1].index, 2031);
  assert.deepEqual(rows[1]["index-range"], [2027, 2044]);
  assert.equal(rows[1].source, undefined);
});

void test("AGI payload validation rejects an absent index or invalid dates", () => {
  assert.equal(
    agiDashboardSchema.safeParse({
      generatedAt: "2026-01-01",
      index: [],
      sources: [],
    }).success,
    false,
  );
  assert.equal(
    agiDashboardSchema.safeParse({
      generatedAt: "2026-01-01",
      index: [{ date: "invalid", value: 2031 }],
      sources: [],
    }).success,
    false,
  );
  const data = agiDashboardSchema.parse({
    generatedAt: "2026-01-01",
    index: [{ date: "2026-01-01", value: 2031, range: [2027, 2044] }],
    sources: [],
  });
  assert.deepEqual(data.index[0].range, [2027, 2044]);
  assert.deepEqual(data.unavailableSources, []);
});
