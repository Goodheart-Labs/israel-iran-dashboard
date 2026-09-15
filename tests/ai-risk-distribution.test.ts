import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  distributionStats,
  formatProbability,
  percentileAt,
  representativeValues,
} from "../src/lib/ai-risk/distribution.ts";
import type { SurveyData } from "../src/lib/ai-risk/types.ts";

const survey = JSON.parse(
  readFileSync(new URL("../src/data/ai-risk-survey.json", import.meta.url), "utf8"),
) as SurveyData;

function close(actual: number, expected: number, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

void test("statistics and rank samples use respondent counts, not unique values", () => {
  const values = [
    { value: 100, count: 1 },
    { value: 0, count: 1 },
    { value: 10, count: 8 },
  ];
  const original = structuredClone(values);
  assert.deepEqual(distributionStats(values), { n: 10, mean: 18, median: 10 });
  assert.deepEqual(representativeValues(values, 5), [10, 10, 10, 10, 100]);
  assert.deepEqual(values, original, "helpers must not reorder their input");
});

void test("weighted median averages the middle two observations for even n", () => {
  assert.deepEqual(
    distributionStats([
      { value: 0, count: 3 },
      { value: 20, count: 2 },
      { value: 100, count: 1 },
    ]),
    { n: 6, mean: 140 / 6, median: 10 },
  );
  assert.equal(
    distributionStats([
      { value: 0, count: 2 },
      { value: 20, count: 2 },
      { value: 100, count: 1 },
    ]).median,
    20,
  );
});

void test("percentiles count ties and keep the two distribution endpoints", () => {
  const values = [
    { value: 0, count: 2 },
    { value: 50, count: 4 },
    { value: 100, count: 4 },
  ];
  assert.deepEqual(percentileAt(values, 0), { below: 0, equal: 20, above: 80, midpoint: 10 });
  assert.deepEqual(percentileAt(values, 50), { below: 20, equal: 40, above: 40, midpoint: 40 });
  assert.deepEqual(percentileAt(values, 100), { below: 60, equal: 40, above: 0, midpoint: 80 });
  assert.deepEqual(percentileAt(values, 25), { below: 20, equal: 0, above: 80, midpoint: 20 });
  assert.deepEqual(percentileAt(values, -1), { below: 0, equal: 0, above: 100, midpoint: 0 });
  assert.deepEqual(percentileAt(values, 101), { below: 100, equal: 0, above: 0, midpoint: 100 });
  assert.deepEqual(percentileAt([{ value: 70, count: 8 }], 70), {
    below: 0, equal: 100, above: 0, midpoint: 50,
  });
});

void test("representative marks select observed values without interpolated probabilities", () => {
  const values = [{ value: 0, count: 1 }, { value: 100, count: 1 }];
  assert.deepEqual(representativeValues(values, 2), [0, 100]);
  assert.deepEqual(representativeValues(values, 4), [0, 0, 100, 100]);
  assert.deepEqual(representativeValues(values, 1), [100]);
  assert.equal(representativeValues(values).length, 100);
});

void test("empty distributions and invalid counts do not produce NaN statistics", () => {
  assert.deepEqual(distributionStats([]), { n: 0, mean: 0, median: 0 });
  assert.deepEqual(percentileAt([], 10), { below: 0, equal: 0, above: 0, midpoint: 0 });
  assert.deepEqual(representativeValues([]), []);
  assert.deepEqual(representativeValues([{ value: 10, count: 1 }], 0), []);
  assert.deepEqual(representativeValues([{ value: 10, count: 1 }], Infinity), []);
  assert.deepEqual(distributionStats([
    { value: 10, count: 0 },
    { value: 40, count: -1 },
    { value: NaN, count: 1 },
    { value: 200, count: 1 },
  ]), { n: 0, mean: 0, median: 0 });
});

void test("probabilities are displayed in percentage units and preserve tiny values", () => {
  assert.equal(formatProbability(0), "0%");
  assert.equal(formatProbability(0.1), "0.1%");
  assert.equal(formatProbability(0.00001), "0.00001%");
  assert.equal(formatProbability(10), "10%");
  assert.equal(formatProbability(100), "100%");
  assert.equal(formatProbability(NaN), "—");
});

void test("all eight exported distributions reconcile to documented denominators and statistics", () => {
  assert.equal(survey.sourceLabel, "Expert Survey on Progress in AI 2024, AI Impacts");
  assert.equal(survey.questions.length, 8);
  const denominators = new Map([
    ["extinction", 744], ["extinction-century", 353], ["loss-of-control", 392],
    ["extremely-good", 1538], ["good", 1538], ["neutral", 1538],
    ["bad", 1538], ["extremely-bad", 1538],
  ]);
  for (const question of survey.questions) {
    assert.equal(question.n, denominators.get(question.id));
    const stats = distributionStats(question.values);
    assert.equal(stats.n, question.n);
    close(stats.mean, question.mean);
    close(stats.median, question.median);
    assert.ok(question.values.every(({ value, count }) =>
      value >= 0 && value <= 100 && Number.isSafeInteger(count) && count > 0));
  }
  close(survey.questions.filter((question) => question.group === "outcomes")
    .reduce((sum, question) => sum + question.mean, 0), 100);
});

void test("70% sits at the midpoint of the full 2024 answer ties, with marks 93–95", () => {
  const extinction = survey.questions.find((question) => question.id === "extinction");
  assert.ok(extinction);
  const rank = percentileAt(extinction.values, 70);
  close(rank.below, 100 * 687 / 744);
  close(rank.equal, 100 * 17 / 744);
  close(rank.above, 100 * 40 / 744);
  close(rank.midpoint, 93.48118279569893);
  const indices = representativeValues(extinction.values)
    .flatMap((value, index) => value === 70 ? [index + 1] : []);
  assert.deepEqual(indices, [93, 94, 95]);
  close(extinction.mean, 18.312773966397984);
  assert.equal(extinction.median, 10);
});
