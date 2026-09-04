import assert from "node:assert/strict";
import test from "node:test";
import { DAY_MS, isPastDeadline, mergeMarketHistory } from "./marketPresentation";
import { chartScore, HIDE_SCORE } from "./helpfulness";

void test("archive only when every source has a known past closing date", () => {
  assert.equal(isPastDeadline([{ resolveDate: 1 }], 2), true);
  assert.equal(isPastDeadline([{ resolveDate: 1 }, { resolveDate: 3 }], 2), false);
  assert.equal(isPastDeadline([{ resolveDate: 1 }, {}], 2), false);
  assert.equal(isPastDeadline([], 2), false);
});

void test("a stale source does not extend to a newer source's date", () => {
  const rows = mergeMarketHistory([
    { history: [{ timestamp: 1, probability: 20 }] },
    { history: [{ timestamp: 2, probability: 40 }] },
  ]);
  assert.equal(rows[0].series_0, 20);
  assert.equal(rows[0].series_1, null);
  assert.equal(rows[1].series_0, null);
  assert.equal(rows[1].series_1, 40);
});

void test("long observation gaps break lines, including a single-source chart", () => {
  const rows = mergeMarketHistory([{ history: [
    { timestamp: 0, probability: 30 },
    { timestamp: 5 * DAY_MS, probability: 60 },
  ] }]);
  assert.deepEqual(rows.map((r) => r.series_0), [30, null, 60]);
});

void test("empty and out-of-order histories are safe", () => {
  assert.deepEqual(mergeMarketHistory([{ history: [] }]), []);
  const rows = mergeMarketHistory([{ history: [
    { timestamp: 2, probability: 40 }, { timestamp: 1, probability: 20 },
  ] }]);
  assert.deepEqual(rows.map((r) => r.series_0), [20, 40]);
});

void test("weighted helpfulness hides at threshold and recovers above it", () => {
  const negative = Array.from({ length: 3 }, () => ({ rating: "not_useful" }));
  assert.equal(chartScore(negative), HIDE_SCORE);
  assert.ok(chartScore([...negative, { rating: "somewhat_useful" }]) > HIDE_SCORE);
  assert.equal(chartScore([{ rating: "useful" }, { rating: "somewhat_useful" }]), 1.5);
});
