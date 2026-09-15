import assert from "node:assert/strict";
import test from "node:test";
import { packPortraits } from "../src/lib/ai-risk/portrait-layout";
import { percentileAt } from "../src/lib/ai-risk/distribution";
import { estimateBounds } from "../src/lib/ai-risk/public-estimates";
import survey from "../src/data/ai-risk-survey.json";
import publicFigures from "../src/data/ai-risk-public-figures.json";
import type { PublicFiguresData } from "../src/lib/ai-risk/types";

const quotes = (publicFigures as PublicFiguresData).quotes.filter(quote => quote.outcomeIds.includes("extinction") && estimateBounds(quote.estimate));
for (const width of [270, 320, 650, 1050]) for (const descending of [false, true]) {
  await test(`portraits stay near weighted survey ranks without overlapping at width ${width}, descending ${descending}`, () => {
    const left = 40, right = width - 24;
    const anchors = quotes.map(quote => {
      const bounds = estimateBounds(quote.estimate)!;
      const p = bounds.reduce((sum, value) => sum + percentileAt(survey.questions[0].values, value).midpoint, 0) / 2;
      return { id: quote.id, x: left + (descending ? 100 - p : p) / 100 * (right - left) };
    });
    const packed = packPortraits(anchors, { minX: left, maxX: right });
    assert.equal(packed.length, quotes.length);
    assert.deepEqual(packPortraits([...anchors].reverse(), { minX: left, maxX: right }), packed, "layout should not jump with input order");
    for (const [i, point] of packed.entries()) {
      assert.ok(Math.abs(point.x - point.anchorX) <= 28);
      assert.ok(point.x >= left && point.x <= right && point.rise >= 0);
      for (const other of packed.slice(i + 1)) assert.ok(Math.hypot(point.x - other.x, point.rise - other.rise) >= 47 - 1e-6, `${point.id} overlaps ${other.id}`);
    }
    const maxRise = Math.max(...packed.map(point => point.rise));
    assert.ok(maxRise < 260, "mobile cluster must leave room for the plot");
  });
}

await test("identical estimates clump vertically instead of spreading across the chart", () => {
  const anchors = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: 500 }));
  const packed = packPortraits(anchors, { minX: 40, maxX: 1000 });
  assert.ok(packed.every(point => Math.abs(point.x - 500) <= 28));
  assert.ok(Math.max(...packed.map(point => point.rise)) > 0);
  assert.deepEqual(packPortraits([], { minX: 40, maxX: 1000 }), []);
});
