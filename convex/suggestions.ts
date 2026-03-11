import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("suggestions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();
  },
});

export const listHeld = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("suggestions")
      .withIndex("by_status", (q) => q.eq("status", "held"))
      .order("desc")
      .collect();
  },
});

export const submit = mutation({
  args: {
    text: v.string(),
    ipHash: v.string(),
  },
  handler: async (ctx, { text, ipHash }) => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      throw new ConvexError("Suggestion must be at least 10 characters.");
    }
    if (trimmed.length > 300) {
      throw new ConvexError("Suggestion must be under 300 characters.");
    }

    await ctx.db.insert("suggestions", {
      text: trimmed,
      upvotes: 0,
      flags: 0,
      status: "active",
      ipHash,
    });
  },
});

export const upvote = mutation({
  args: {
    suggestionId: v.id("suggestions"),
    ipHash: v.string(),
  },
  handler: async (ctx, { suggestionId, ipHash }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) throw new ConvexError("Suggestion not found.");
    if (suggestion.status === "held") return; // silently ignore held items

    // Check for existing upvote
    const existing = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_suggestion_ip_type", (q) =>
        q
          .eq("suggestionId", suggestionId)
          .eq("ipHash", ipHash)
          .eq("type", "upvote")
      )
      .unique();

    if (existing) {
      // Toggle: remove upvote
      await ctx.db.delete(existing._id);
      await ctx.db.patch(suggestionId, { upvotes: Math.max(0, suggestion.upvotes - 1) });
    } else {
      await ctx.db.insert("suggestionVotes", { suggestionId, ipHash, type: "upvote" });
      await ctx.db.patch(suggestionId, { upvotes: suggestion.upvotes + 1 });
    }
  },
});

export const flag = mutation({
  args: {
    suggestionId: v.id("suggestions"),
    ipHash: v.string(),
  },
  handler: async (ctx, { suggestionId, ipHash }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) throw new ConvexError("Suggestion not found.");

    // Check for existing flag from this IP
    const existing = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_suggestion_ip_type", (q) =>
        q
          .eq("suggestionId", suggestionId)
          .eq("ipHash", ipHash)
          .eq("type", "flag")
      )
      .unique();

    if (existing) return; // already flagged by this IP

    await ctx.db.insert("suggestionVotes", { suggestionId, ipHash, type: "flag" });
    const newFlags = suggestion.flags + 1;
    const newStatus = newFlags >= 2 ? "held" : suggestion.status;
    await ctx.db.patch(suggestionId, { flags: newFlags, status: newStatus });
  },
});

// Admin: approve a held suggestion back to active
export const approve = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, { suggestionId }) => {
    await ctx.db.patch(suggestionId, { status: "active", flags: 0 });
  },
});

// Admin: permanently delete a suggestion
export const remove = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, { suggestionId }) => {
    // Delete votes too
    const votes = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_suggestion", (q) => q.eq("suggestionId", suggestionId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }
    await ctx.db.delete(suggestionId);
  },
});
