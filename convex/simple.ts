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
    
    // For each prediction, get its history
    const predictionsWithHistory = await Promise.all(
      predictions.map(async (p) => {
        // Get historical data from predictionHistory table
        const history = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => 
            q.eq("predictionId", p._id)
          )
          .collect();
        
        // Sort by timestamp descending and take last 50 points
        history.sort((a, b) => b.timestamp - a.timestamp);
        const recentHistory = history.slice(0, 50);
        
        return {
          _id: p._id,
          title: p.title,
          probability: p.probability,
          previousProbability: p.previousProbability,
          source: p.source,
          sourceUrl: p.sourceUrl,
          lastUpdated: p.lastUpdated,
          clarificationText: p.clarificationText,
          // Add the historical data (reverse to show oldest first)
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