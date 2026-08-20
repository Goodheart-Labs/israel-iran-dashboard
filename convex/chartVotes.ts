import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Whether readers find a given chart useful. One vote per browser, changeable. */

const RATINGS = v.union(
  v.literal("useful"),
  v.literal("somewhat_useful"),
  v.literal("not_useful")
);

export const listAll = query({
  args: {},
  handler: async (ctx) => ctx.db.query("chartVotes").collect(),
});

export const vote = mutation({
  args: { slot: v.string(), rating: RATINGS, voterKey: v.string() },
  handler: async (ctx, { slot, rating, voterKey }) => {
    const existing = await ctx.db
      .query("chartVotes")
      .withIndex("by_slot_voter", (q) =>
        q.eq("slot", slot).eq("voterKey", voterKey)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { rating });
      return;
    }
    await ctx.db.insert("chartVotes", {
      slot,
      rating,
      voterKey,
      createdAt: Date.now(),
    });
  },
});
