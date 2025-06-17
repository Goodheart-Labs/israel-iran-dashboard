import { query } from "./_generated/server";

// Dead simple query - no imports, no dependencies
export const getMarkets = query({
  args: {},
  handler: async (ctx) => {
    // Get all active predictions
    const predictions = await ctx.db
      .query("predictions")
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
    
    // Sort by creation time, newest first
    predictions.sort((a, b) => b._creationTime - a._creationTime);
    
    // Return just what we need for display
    return predictions.map(p => ({
      _id: p._id,
      title: p.title,
      probability: p.probability,
      previousProbability: p.previousProbability,
      source: p.source,
      sourceUrl: p.sourceUrl,
      lastUpdated: p.lastUpdated,
      clarificationText: p.clarificationText
    }));
  }
});