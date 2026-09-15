import { ConvexError, v } from "convex/values";

export const RISK_OUTCOMES = [
  "extinction",
  "extinction-century",
  "loss-of-control",
] as const;

export const LONG_RUN_OUTCOMES = [
  "extremely-good",
  "good",
  "neutral",
  "bad",
  "extremely-bad",
] as const;

export const OUTCOMES = [...RISK_OUTCOMES, ...LONG_RUN_OUTCOMES] as const;
export type OutcomeId = (typeof OUTCOMES)[number];
export type Rating = "useful" | "somewhat_useful" | "not_useful";

export const outcomeValidator = v.union(
  v.literal("extinction"),
  v.literal("extinction-century"),
  v.literal("loss-of-control"),
  v.literal("extremely-good"),
  v.literal("good"),
  v.literal("neutral"),
  v.literal("bad"),
  v.literal("extremely-bad"),
);

export const ratingValidator = v.union(
  v.literal("useful"),
  v.literal("somewhat_useful"),
  v.literal("not_useful"),
);

export function validateVoterKey(voterKey: string): void {
  if (!/^[A-Za-z0-9_-]{36,128}$/.test(voterKey)) {
    throw new ConvexError("A valid private browser voting token is required.");
  }
}

export function validateSlot(slot: string): void {
  if (slot.length > 120 || !/^ai-risk:[a-z0-9:-]+$/.test(slot)) {
    throw new ConvexError("Invalid AI risk feedback slot.");
  }
}

export function validateSlots(slots: string[]): void {
  if (slots.length > 50) {
    throw new ConvexError("Request feedback for at most 50 items at a time.");
  }
  if (new Set(slots).size !== slots.length) {
    throw new ConvexError("Feedback slots must be unique.");
  }
  slots.forEach(validateSlot);
}

export function validateForecasts(
  values: Array<{ outcomeId: string; value: number }>,
): Array<{ outcomeId: OutcomeId; value: number; bin: number }> {
  if (values.length < 1 || values.length > 5) {
    throw new ConvexError("Submit one to three risk answers, or all five long-run outcomes.");
  }
  const seen = new Set<string>();
  const normalized = values.map(({ outcomeId, value }) => {
    if (!(OUTCOMES as readonly string[]).includes(outcomeId)) {
      throw new ConvexError("Unknown AI outcome.");
    }
    if (seen.has(outcomeId)) {
      throw new ConvexError("Each outcome can appear only once.");
    }
    seen.add(outcomeId);
    const bin = Math.round(value * 10);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100 ||
      Math.abs(value * 10 - bin) > 1e-7
    ) {
      throw new ConvexError("Use percentages from 0 to 100 with at most one decimal place.");
    }
    return { outcomeId: outcomeId as OutcomeId, value: bin / 10, bin };
  });

  const riskCount = normalized.filter(({ outcomeId }) =>
    (RISK_OUTCOMES as readonly string[]).includes(outcomeId),
  ).length;
  if (riskCount > 0) {
    if (riskCount !== normalized.length || riskCount > 3) {
      throw new ConvexError("Submit risk questions separately from the five long-run outcomes.");
    }
  } else if (
    normalized.length !== LONG_RUN_OUTCOMES.length ||
    normalized.reduce((total, { bin }) => total + bin, 0) !== 1000
  ) {
    throw new ConvexError("The five long-run outcome percentages must total 100%.");
  }
  return normalized;
}

/** A 0.1 percentage-point bin avoids float equality when revising an answer. */
export function updateHistogram(
  previous: { counts: number[]; n: number } | null,
  oldBin?: number,
  newBin?: number,
): { counts: number[]; n: number } {
  const counts = previous ? [...previous.counts] : Array<number>(1001).fill(0);
  let n = previous?.n ?? 0;
  if (oldBin !== undefined) {
    if (!(counts[oldBin] > 0) || n < 1) {
      throw new ConvexError("The response totals could not be updated. Please try again later.");
    }
    counts[oldBin]--;
    n--;
  }
  if (newBin !== undefined) {
    counts[newBin]++;
    n++;
  }
  return { counts, n };
}
