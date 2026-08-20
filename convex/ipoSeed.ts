import { mutation } from "./_generated/server";

/**
 * Seeds the AI IPO dashboard's markets.
 *
 * Polymarket only for now: its poller derives the API target from the slug in
 * sourceUrl, so these keep themselves updated once inserted. Kalshi lists
 * matching "when will X announce an IPO" ladders, but its API reports
 * last_price as null for them, which is what kalshiPoller reads — so wiring
 * those up needs poller work (order-book midpoints) first.
 *
 * Re-runnable: markets are matched by title and their fields corrected, so
 * this doubles as the fix-up when Polymarket renames a slug — which it does
 * (it appends numeric suffixes as markets are edited).
 */

const ANTHROPIC = "#D97757";
const OPENAI = "#10A37F";

const IPO_MARKETS = [
  {
    title: "Will Anthropic IPO by September 30, 2026?",
    slug: "will-anthropic-ipo-by-september-30-2026-733",
    resolveDate: Date.UTC(2026, 8, 30, 23, 59),
    chartGroup: "ipo_anthropic",
    shortLabel: "by Sep 30",
    chartColor: "#F0B49A",
    sortOrder: 1,
  },
  {
    title: "Will Anthropic IPO by October 31, 2026?",
    slug: "will-anthropic-ipo-by-october-31-2026-213",
    resolveDate: Date.UTC(2026, 9, 31, 23, 59),
    chartGroup: "ipo_anthropic",
    shortLabel: "by Oct 31",
    chartColor: ANTHROPIC,
    sortOrder: 1,
  },
  {
    title: "Will Anthropic IPO by December 31, 2026?",
    slug: "will-anthropic-ipo-by-december-31-2026-546-128-719",
    resolveDate: Date.UTC(2026, 11, 31, 23, 59),
    chartGroup: "ipo_anthropic",
    shortLabel: "by Dec 31",
    chartColor: "#9C4A28",
    sortOrder: 1,
  },
  {
    title: "Will OpenAI IPO by September 30 2026?",
    slug: "will-openai-ipo-by-september-30-2026",
    resolveDate: Date.UTC(2026, 8, 30, 23, 59),
    chartGroup: "ipo_openai",
    shortLabel: "by Sep 30",
    chartColor: "#7FD4BC",
    sortOrder: 2,
  },
  {
    title: "Will OpenAI IPO by December 31 2026?",
    slug: "will-openai-ipo-by-december-31-2026",
    resolveDate: Date.UTC(2026, 11, 31, 23, 59),
    chartGroup: "ipo_openai",
    shortLabel: "by Dec 31",
    chartColor: OPENAI,
    sortOrder: 2,
  },
];

export const seedIpoMarkets = mutation({
  args: {},
  handler: async (ctx) => {
    const added: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];

    const existingRows = await ctx.db
      .query("predictions")
      .withIndex("by_category", (q) => q.eq("category", "ai_companies"))
      .collect();

    for (const market of IPO_MARKETS) {
      const sourceUrl = `https://polymarket.com/event/${market.slug}`;
      const existing = existingRows.find((row) => row.title === market.title);

      if (existing) {
        const patch = {
          sourceUrl,
          resolveDate: market.resolveDate,
          chartGroup: market.chartGroup,
          chartColor: market.chartColor,
          shortLabel: market.shortLabel,
          sortOrder: market.sortOrder,
        };
        const changed = Object.entries(patch).some(
          ([key, value]) => existing[key as keyof typeof patch] !== value,
        );
        if (changed) {
          await ctx.db.patch(existing._id, patch);
          updated.push(market.title);
        } else {
          unchanged.push(market.title);
        }
        continue;
      }

      await ctx.db.insert("predictions", {
        category: "ai_companies",
        title: market.title,
        source: "polymarket",
        sourceUrl,
        // Seeded at zero; pricePoller fills in the real number within a minute.
        probability: 0,
        lastUpdated: Date.now(),
        isActive: true,
        isApproved: true,
        questionType: "binary",
        resolveDate: market.resolveDate,
        chartGroup: market.chartGroup,
        chartColor: market.chartColor,
        shortLabel: market.shortLabel,
        sortOrder: market.sortOrder,
      });
      added.push(market.title);
    }

    return { added, updated, unchanged };
  },
});
