import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAiRiskAccess } from "./aiRiskAccess";
import {
  OUTCOMES,
  ratingValidator,
  updateHistogram,
  validateForecasts,
  validateSlot,
  validateSlots,
  validateVoterKey,
} from "./aiRiskValidation";
import type { OutcomeId, Rating } from "./aiRiskValidation";

// This limits accidental rapid resubmission by one browser. Anonymous tokens
// are not identities, so this is deliberately not advertised as bot protection.
const UPDATE_INTERVAL_MS = 500;

async function throttle(
  ctx: MutationCtx,
  voterKey: string,
  field: "forecastsAt" | "feedbackAt",
  now: number,
) {
  const activity = await ctx.db
    .query("aiRiskActivity")
    .withIndex("by_voter", (q) => q.eq("voterKey", voterKey))
    .unique();
  const previous = activity?.[field];
  if (previous !== undefined && now - previous < UPDATE_INTERVAL_MS) {
    throw new ConvexError("Please wait a moment before updating again.");
  }
  if (activity) {
    await ctx.db.patch(activity._id, { [field]: now });
  } else {
    await ctx.db.insert("aiRiskActivity", { voterKey, [field]: now });
  }
}

async function changeDistribution(
  ctx: MutationCtx,
  outcomeId: OutcomeId,
  now: number,
  oldBin?: number,
  newBin?: number,
) {
  const aggregate = await ctx.db
    .query("aiRiskDistributions")
    .withIndex("by_outcome", (q) => q.eq("outcomeId", outcomeId))
    .unique();
  const update = { ...updateHistogram(aggregate, oldBin, newBin), updatedAt: now };
  if (aggregate) {
    await ctx.db.patch(aggregate._id, update);
  } else {
    await ctx.db.insert("aiRiskDistributions", { outcomeId, ...update });
  }
}

async function changeFeedbackTotals(
  ctx: MutationCtx,
  slot: string,
  now: number,
  oldRating?: Rating,
  newRating?: Rating,
) {
  const aggregate = await ctx.db
    .query("aiRiskFeedbackTotals")
    .withIndex("by_slot", (q) => q.eq("slot", slot))
    .unique();
  const counts = {
    useful: aggregate?.useful ?? 0,
    somewhat_useful: aggregate?.somewhat_useful ?? 0,
    not_useful: aggregate?.not_useful ?? 0,
  };
  if (oldRating !== undefined) {
    if (counts[oldRating] < 1) {
      throw new ConvexError("The feedback totals could not be updated. Please try again later.");
    }
    counts[oldRating]--;
  }
  if (newRating !== undefined) counts[newRating]++;
  const update = { ...counts, updatedAt: now };
  if (aggregate) {
    await ctx.db.patch(aggregate._id, update);
  } else {
    await ctx.db.insert("aiRiskFeedbackTotals", { slot, ...update });
  }
}

export const getSummary = query({
  args: { accessToken: v.string(), voterKey: v.string() },
  handler: async (ctx, { accessToken, voterKey }) => {
    await requireAiRiskAccess(accessToken);
    validateVoterKey(voterKey);
    const distributions = await Promise.all(
      OUTCOMES.map(async (outcomeId) => {
        const aggregate = await ctx.db
          .query("aiRiskDistributions")
          .withIndex("by_outcome", (q) => q.eq("outcomeId", outcomeId))
          .unique();
        return {
          outcomeId,
          n: aggregate?.n ?? 0,
          values: (aggregate?.counts ?? []).flatMap((count, bin) =>
            count > 0 ? [{ value: bin / 10, count }] : [],
          ),
        };
      }),
    );
    // A browser can have at most eight rows, enforced by the outcome validator
    // and the unique voter/outcome lookup in every write.
    const ownRows = await ctx.db
      .query("aiRiskForecasts")
      .withIndex("by_voter", (q) => q.eq("voterKey", voterKey))
      .take(OUTCOMES.length);
    const mine: Record<string, number> = {};
    for (const row of ownRows) {
      if (row.deletedAt === undefined) mine[row.outcomeId] = row.value;
    }
    return { distributions, mine };
  },
});

export const saveForecasts = mutation({
  args: {
    accessToken: v.string(),
    voterKey: v.string(),
    values: v.array(v.object({ outcomeId: v.string(), value: v.number() })),
  },
  handler: async (ctx, { accessToken, voterKey, values }) => {
    await requireAiRiskAccess(accessToken);
    validateVoterKey(voterKey);
    const normalized = validateForecasts(values);
    const now = Date.now();
    await throttle(ctx, voterKey, "forecastsAt", now);
    for (const { outcomeId, value, bin } of normalized) {
      const existing = await ctx.db
        .query("aiRiskForecasts")
        .withIndex("by_voter_outcome", (q) =>
          q.eq("voterKey", voterKey).eq("outcomeId", outcomeId),
        )
        .unique();
      const oldBin = existing && existing.deletedAt === undefined
        ? Math.round(existing.value * 10)
        : undefined;
      if (oldBin !== bin) {
        await changeDistribution(ctx, outcomeId, now, oldBin, bin);
      }
      if (existing) {
        await ctx.db.patch(existing._id, { value, updatedAt: now, deletedAt: undefined });
      } else {
        await ctx.db.insert("aiRiskForecasts", { voterKey, outcomeId, value, updatedAt: now });
      }
    }
    return { saved: normalized.length };
  },
});

export const clearForecasts = mutation({
  args: { accessToken: v.string(), voterKey: v.string() },
  handler: async (ctx, { accessToken, voterKey }) => {
    await requireAiRiskAccess(accessToken);
    validateVoterKey(voterKey);
    const now = Date.now();
    const ownRows = await ctx.db
      .query("aiRiskForecasts")
      .withIndex("by_voter", (q) => q.eq("voterKey", voterKey))
      .take(OUTCOMES.length);
    let cleared = 0;
    for (const row of ownRows) {
      if (row.deletedAt !== undefined) continue;
      await changeDistribution(ctx, row.outcomeId, now, Math.round(row.value * 10));
      await ctx.db.patch(row._id, { deletedAt: now, updatedAt: now });
      cleared++;
    }
    return { cleared };
  },
});

export const getFeedback = query({
  args: { accessToken: v.string(), voterKey: v.string(), slots: v.array(v.string()) },
  handler: async (ctx, { accessToken, voterKey, slots }) => {
    await requireAiRiskAccess(accessToken);
    validateVoterKey(voterKey);
    validateSlots(slots);
    return await Promise.all(slots.map(async (slot) => {
      const [aggregate, ownVote] = await Promise.all([
        ctx.db.query("aiRiskFeedbackTotals")
          .withIndex("by_slot", (q) => q.eq("slot", slot)).unique(),
        ctx.db.query("aiRiskFeedback")
          .withIndex("by_voter_slot", (q) => q.eq("voterKey", voterKey).eq("slot", slot))
          .unique(),
      ]);
      return {
        slot,
        useful: aggregate?.useful ?? 0,
        somewhat_useful: aggregate?.somewhat_useful ?? 0,
        not_useful: aggregate?.not_useful ?? 0,
        ...(ownVote && ownVote.deletedAt === undefined ? { mine: ownVote.rating } : {}),
      };
    }));
  },
});

export const rate = mutation({
  args: { accessToken: v.string(), voterKey: v.string(), slot: v.string(), rating: ratingValidator },
  handler: async (ctx, { accessToken, voterKey, slot, rating }) => {
    await requireAiRiskAccess(accessToken);
    validateVoterKey(voterKey);
    validateSlot(slot);
    const now = Date.now();
    await throttle(ctx, voterKey, "feedbackAt", now);
    const existing = await ctx.db
      .query("aiRiskFeedback")
      .withIndex("by_voter_slot", (q) => q.eq("voterKey", voterKey).eq("slot", slot))
      .unique();
    const oldRating = existing && existing.deletedAt === undefined ? existing.rating : undefined;
    if (oldRating !== rating) {
      await changeFeedbackTotals(ctx, slot, now, oldRating, rating);
    }
    if (existing) {
      await ctx.db.patch(existing._id, { rating, updatedAt: now, deletedAt: undefined });
    } else {
      await ctx.db.insert("aiRiskFeedback", { voterKey, slot, rating, updatedAt: now });
    }
    return { rating };
  },
});

/** Remove this browser's feedback without exposing or modifying other voters. */
export const clearFeedback = mutation({
  args: { accessToken: v.string(), voterKey: v.string(), slots: v.array(v.string()) },
  handler: async (ctx, { accessToken, voterKey, slots }) => {
    await requireAiRiskAccess(accessToken);
    validateVoterKey(voterKey);
    validateSlots(slots);
    const now = Date.now();
    let cleared = 0;
    for (const slot of slots) {
      const existing = await ctx.db
        .query("aiRiskFeedback")
        .withIndex("by_voter_slot", (q) => q.eq("voterKey", voterKey).eq("slot", slot))
        .unique();
      if (!existing || existing.deletedAt !== undefined) continue;
      await changeFeedbackTotals(ctx, slot, now, existing.rating);
      await ctx.db.patch(existing._id, { deletedAt: now, updatedAt: now });
      cleared++;
    }
    return { cleared };
  },
});
