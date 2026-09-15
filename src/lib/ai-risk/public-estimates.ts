import type { ProbabilityEstimate, PublicQuote } from "./types";
import { formatProbability } from "./distribution";

export function estimateLabel(estimate: ProbabilityEstimate): string {
  switch (estimate.kind) {
    case "point": return formatProbability(estimate.value);
    case "range": return `${formatProbability(estimate.low).replace(/%$/, "")}–${formatProbability(estimate.high)}`;
    case "lower-bound": return `>${formatProbability(estimate.value)}`;
    case "upper-bound": return `<${formatProbability(estimate.value)}`;
    case "qualitative": return estimate.label;
  }
}

export function estimateBounds(estimate: ProbabilityEstimate): [number, number] | null {
  switch (estimate.kind) {
    case "point": return [estimate.value, estimate.value];
    case "range": return [estimate.low, estimate.high];
    case "lower-bound": return [estimate.value, 100];
    case "upper-bound": return [0, estimate.value];
    case "qualitative": return null;
  }
}

// Sorting a range by its lower bound does not assert an invented point estimate.
export function sortQuotes(quotes: PublicQuote[], sort: string, votes: Record<string, number> = {}) {
  return [...quotes].sort((a, b) => {
    const av = estimateBounds(a.estimate)?.[0];
    const bv = estimateBounds(b.estimate)?.[0];
    if (sort === "newest") return (b.date ?? "").localeCompare(a.date ?? "");
    if (sort === "useful") return (votes[b.id] ?? 0) - (votes[a.id] ?? 0);
    if (av === undefined) return bv === undefined ? 0 : 1;
    if (bv === undefined) return -1;
    return sort === "low" ? av - bv : bv - av;
  });
}
