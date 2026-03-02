import { query } from "./_generated/server";

// Dead simple query - no imports, no dependencies
export const getMarkets = query({
  args: {},
  handler: async (ctx) => {
    // Get all active predictions
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Sort by sortOrder then creation time
    predictions.sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return b._creationTime - a._creationTime;
    });
    
    // For each prediction, get its history
    const predictionsWithHistory = await Promise.all(
      predictions.map(async (p) => {
        // Get most recent 50 history points using index order + take
        const recentHistory = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) =>
            q.eq("predictionId", p._id)
          )
          .order("desc")
          .take(50);
        
        return {
          _id: p._id,
          title: p.title,
          probability: p.probability,
          previousProbability: p.previousProbability,
          source: p.source,
          sourceUrl: p.sourceUrl,
          lastUpdated: p.lastUpdated,
          clarificationText: p.clarificationText,
          chartGroup: p.chartGroup,
          chartColor: p.chartColor,
          sortOrder: p.sortOrder,
          history: recentHistory.reverse().map(h => ({
            timestamp: h.timestamp,
            probability: h.probability
          }))
        };
      })
    );
    
    return predictionsWithHistory;
  }
});