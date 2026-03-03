import { query } from "./_generated/server";

// Remove single-point spikes from history data.
// A spike is a point that jumps >30pp from BOTH its neighbors.
function despike(
  history: Array<{ timestamp: number; probability: number }>
): Array<{ timestamp: number; probability: number }> {
  if (history.length < 3) return history;
  const result = [history[0]];
  for (let i = 1; i < history.length - 1; i++) {
    const prev = history[i - 1].probability;
    const curr = history[i].probability;
    const next = history[i + 1].probability;
    const diffPrev = Math.abs(curr - prev);
    const diffNext = Math.abs(curr - next);
    // If it jumps far from both neighbors, skip it
    if (diffPrev > 30 && diffNext > 30) continue;
    result.push(history[i]);
  }
  result.push(history[history.length - 1]);
  return result;
}

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
        // Get most recent 500 history points for rich charts
        const recentHistory = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) =>
            q.eq("predictionId", p._id)
          )
          .order("desc")
          .take(500);
        
        const historyData = recentHistory.reverse().map(h => ({
          timestamp: h.timestamp,
          probability: h.probability,
          ...(h.lowerBound !== undefined && { lowerBound: h.lowerBound }),
          ...(h.upperBound !== undefined && { upperBound: h.upperBound }),
        }));

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
          shortLabel: p.shortLabel,
          sortOrder: p.sortOrder,
          questionType: p.questionType,
          scalingRangeMin: p.scalingRangeMin,
          scalingRangeMax: p.scalingRangeMax,
          scalingZeroPoint: p.scalingZeroPoint,
          history: p.questionType === "date"
            ? historyData  // Don't despike date question data (values are positions, not probabilities)
            : despike(historyData),
        };
      })
    );
    
    return predictionsWithHistory;
  }
});