import { query } from "../_generated/server";

export const checkMarketStatus = query({
  handler: async (ctx) => {
    // Get all predictions
    const predictions = await ctx.db.query("predictions").collect();
    
    // Check each market's status
    const marketStatus = predictions.map(p => ({
      title: p.title,
      source: p.source,
      externalId: p.externalId,
      currentProbability: p.probability,
      lastUpdated: p.lastUpdated ? new Date(p.lastUpdated).toISOString() : 'Never',
      minutesAgo: p.lastUpdated ? Math.floor((Date.now() - p.lastUpdated) / 1000 / 60) : null,
      sourceUrl: p.sourceUrl,
      isActive: p.isActive,
      isApproved: p.isApproved
    }));
    
    // Sort by last updated
    marketStatus.sort((a, b) => (b.minutesAgo || 9999) - (a.minutesAgo || 9999));
    
    return {
      totalMarkets: predictions.length,
      activeMarkets: predictions.filter(p => p.isActive).length,
      approvedMarkets: predictions.filter(p => p.isApproved).length,
      markets: marketStatus,
      oldestUpdate: marketStatus[0]?.lastUpdated || 'Never',
      minutesSinceOldest: marketStatus[0]?.minutesAgo || null
    };
  }
});