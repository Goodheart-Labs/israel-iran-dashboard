import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Latest summary for a topic page, or null when none has been written. */
export const latest = query({
  args: { topic: v.string() },
  handler: async (ctx, { topic }) =>
    ctx.db
      .query("headlines")
      .withIndex("by_topic", (q) => q.eq("topic", topic))
      .order("desc")
      .first(),
});

/** Store a new summary. Internal: run from the CLI or a scheduled job, never the browser. */
export const set = internalMutation({
  args: {
    topic: v.string(),
    text: v.string(),
    citedSlots: v.array(v.string()),
    author: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("headlines", { ...args, createdAt: Date.now() });
  },
});
