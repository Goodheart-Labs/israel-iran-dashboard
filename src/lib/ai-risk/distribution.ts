import type { ProbabilityCount } from "./types";

/** Retain valid answer counts and sort without mutating the input. */
function orderedValues(values: ProbabilityCount[]): ProbabilityCount[] {
  return values
    .filter(
      ({ value, count }) =>
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100 &&
        Number.isSafeInteger(count) &&
        count > 0,
    )
    .sort((a, b) => a.value - b.value);
}

function totalCount(values: ProbabilityCount[]): number {
  return values.reduce((sum, entry) => sum + entry.count, 0);
}

/** Value at a zero-based rank in the full, count-weighted answer distribution. */
function valueAtRank(values: ProbabilityCount[], rank: number): number {
  let cumulative = 0;
  for (const entry of values) {
    cumulative += entry.count;
    if (rank < cumulative) return entry.value;
  }
  return values[values.length - 1]?.value ?? 0;
}

/**
 * Observed answers sampled at the middle of equally sized rank intervals.
 * The marks summarize the distribution; all statistics use the full counts.
 * When count exceeds n, repeated values are intentional representative marks.
 */
export function representativeValues(
  values: ProbabilityCount[],
  count = 100,
): number[] {
  if (!Number.isFinite(count) || count < 1) return [];
  const ordered = orderedValues(values);
  const n = totalCount(ordered);
  if (n === 0) return [];
  const marks = Math.floor(count);
  return Array.from({ length: marks }, (_, index) =>
    valueAtRank(ordered, Math.floor(((index + 0.5) * n) / marks)),
  );
}

/** Shares of answers below, equal to, and above a probability, in percent. */
export function percentileAt(
  values: ProbabilityCount[],
  value: number,
): { below: number; equal: number; above: number; midpoint: number } {
  const ordered = orderedValues(values);
  const n = totalCount(ordered);
  if (n === 0 || Number.isNaN(value)) {
    return { below: 0, equal: 0, above: 0, midpoint: 0 };
  }
  let lower = 0;
  let same = 0;
  for (const entry of ordered) {
    if (entry.value < value) lower += entry.count;
    else if (entry.value === value) same += entry.count;
  }
  return {
    below: (100 * lower) / n,
    equal: (100 * same) / n,
    above: (100 * (n - lower - same)) / n,
    midpoint: (100 * (lower + same / 2)) / n,
  };
}

/** Unweighted respondent statistics computed from the count-weighted values. */
export function distributionStats(
  values: ProbabilityCount[],
): { n: number; mean: number; median: number } {
  const ordered = orderedValues(values);
  const n = totalCount(ordered);
  if (n === 0) return { n: 0, mean: 0, median: 0 };
  const total = ordered.reduce((sum, entry) => sum + entry.value * entry.count, 0);
  const lowMiddle = valueAtRank(ordered, Math.floor((n - 1) / 2));
  const highMiddle = valueAtRank(ordered, Math.floor(n / 2));
  return { n, mean: total / n, median: (lowMiddle + highMiddle) / 2 };
}

const probabilityFormatter = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 3,
});

/** Input is already a percentage (10 means 10%, not 1,000%). */
export function formatProbability(value: number): string {
  return Number.isFinite(value) ? `${probabilityFormatter.format(value)}%` : "—";
}
