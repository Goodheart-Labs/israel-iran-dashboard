import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

/**
 * Caveats readers can vote on and rewrite.
 *
 * Edits never overwrite: each one appends to textRevisions, so the history is
 * intact and a revert is just another revision carrying older text.
 */

const RATINGS = v.union(
  v.literal("helpful"),
  v.literal("somewhat_helpful"),
  v.literal("not_helpful")
);

export const listForTopic = query({
  args: { topic: v.string() },
  handler: async (ctx, { topic }) => {
    const caveats = await ctx.db
      .query("caveats")
      .withIndex("by_topic", (q) => q.eq("topic", topic))
      .collect();

    const withExtras = await Promise.all(
      caveats.map(async (caveat) => {
        const votes = await ctx.db
          .query("caveatVotes")
          .withIndex("by_caveat", (q) => q.eq("caveatId", caveat._id))
          .collect();

        const revisions = await ctx.db
          .query("textRevisions")
          .withIndex("by_slot", (q) => q.eq("slot", `caveat:${caveat._id}`))
          .collect();
        revisions.sort((a, b) => b.createdAt - a.createdAt);

        const tally = { helpful: 0, somewhat_helpful: 0, not_helpful: 0 };
        for (const vote of votes) tally[vote.rating] += 1;

        return {
          _id: caveat._id,
          content: revisions[0]?.content ?? caveat.content,
          originalContent: caveat.content,
          author: caveat.author,
          pinned: caveat.pinned,
          createdAt: caveat.createdAt,
          editedBy: revisions[0]?.editor,
          revisionCount: revisions.length,
          tally,
          voters: votes.map((vote) => ({
            voterKey: vote.voterKey,
            rating: vote.rating,
          })),
        };
      })
    );

    return withExtras.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  },
});

export const addCaveat = mutation({
  args: {
    topic: v.string(),
    content: v.string(),
    author: v.optional(v.string()),
  },
  handler: async (ctx, { topic, content, author }) => {
    const trimmed = content.trim().slice(0, 600);
    if (!trimmed) throw new Error("A caveat needs some text.");
    return ctx.db.insert("caveats", {
      topic,
      content: trimmed,
      author: author?.trim().slice(0, 60) || undefined,
      pinned: false,
      createdAt: Date.now(),
    });
  },
});

export const voteCaveat = mutation({
  args: {
    caveatId: v.id("caveats"),
    rating: RATINGS,
    voterKey: v.string(),
  },
  handler: async (ctx, { caveatId, rating, voterKey }) => {
    const existing = await ctx.db
      .query("caveatVotes")
      .withIndex("by_caveat_voter", (q) =>
        q.eq("caveatId", caveatId).eq("voterKey", voterKey)
      )
      .first();
    // One vote per browser; changing your mind replaces it.
    if (existing) {
      await ctx.db.patch(existing._id, { rating });
      return;
    }
    await ctx.db.insert("caveatVotes", {
      caveatId,
      rating,
      voterKey,
      createdAt: Date.now(),
    });
  },
});

export const listRevisions = query({
  args: { slot: v.string() },
  handler: async (ctx, { slot }) => {
    const revisions = await ctx.db
      .query("textRevisions")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .collect();
    return revisions.sort(
      (a: Doc<"textRevisions">, b: Doc<"textRevisions">) =>
        b.createdAt - a.createdAt
    );
  },
});

export const addRevision = mutation({
  args: {
    slot: v.string(),
    content: v.string(),
    editor: v.optional(v.string()),
    revertedFrom: v.optional(v.id("textRevisions")),
  },
  handler: async (ctx, { slot, content, editor, revertedFrom }) => {
    const trimmed = content.trim().slice(0, 2000);
    if (!trimmed) throw new Error("An edit needs some text.");
    return ctx.db.insert("textRevisions", {
      slot,
      content: trimmed,
      editor: editor?.trim().slice(0, 60) || undefined,
      revertedFrom,
      createdAt: Date.now(),
    });
  },
});

/** Seeds the caveats the IPO dashboard ships with. Re-runnable. */
export const seedIpoCaveats = mutation({
  args: {},
  handler: async (ctx) => {
    const seeds = [
      "All Polymarket numbers are real-money YES prices, with six-figure volumes on the headline rungs.",
      "The headline day is where the blended cumulative curve crosses 50%. A median is not a promise — there's roughly a coin-flip of the IPO landing either side of it.",
      "Kalshi asks when an IPO will be officially announced, which is an earlier event than the listing. Its API reports no last price for these markets, so those numbers are order-book midpoints from thin books.",
      "A ladder's rungs are separate markets and need not be perfectly consistent with each other.",
      "Metaculus is a forecaster aggregate rather than a market — no money is at stake, and this question has few forecasters so far.",
    ];

    const existing = await ctx.db
      .query("caveats")
      .withIndex("by_topic", (q) => q.eq("topic", "ipo"))
      .collect();

    const added: string[] = [];
    for (const content of seeds) {
      if (existing.some((row) => row.content === content)) continue;
      await ctx.db.insert("caveats", {
        topic: "ipo",
        content,
        author: "Goodheart Labs",
        pinned: true,
        createdAt: Date.now(),
      });
      added.push(content.slice(0, 40));
    }
    return { added, alreadyThere: existing.length };
  },
});
