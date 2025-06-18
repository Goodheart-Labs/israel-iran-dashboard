"use node";

import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";

// Update current prices for all markets and record in history
export const updateAllCurrentPrices = action({
  handler: async (ctx): Promise<{
    polymarketUpdated: number;
    historyRecorded: number;
    duration: number;
    timestamp: string;
    message: string;
  }> => {
    
    const startTime = Date.now();
    console.log(`[CRON] Starting price update at ${new Date().toISOString()}`);
    
    try {
      // Use the existing fetchPolymarketDirectMarkets action
      const polymarketResult = await ctx.runAction(api.predictions.fetchPolymarketDirectMarkets);
      
      // Record current values in history
      const predictions = await ctx.runQuery(api.predictions.getActive);
      let recorded = 0;
      
      for (const prediction of predictions) {
        await ctx.runMutation(internal.historyMutations.addHistoryPoint, {
          predictionId: prediction._id,
          timestamp: Date.now(),
          probability: prediction.probability,
          source: prediction.source
        });
        recorded++;
      }
      
      const duration = Date.now() - startTime;
      console.log(`[CRON] Price update completed in ${duration}ms - Updated ${polymarketResult.updated} markets, recorded ${recorded} history points`);
      
      return {
        polymarketUpdated: polymarketResult.updated,
        historyRecorded: recorded,
        duration,
        timestamp: new Date().toISOString(),
        message: `Updated ${polymarketResult.updated} markets and recorded ${recorded} history points`
      };
    } catch (error) {
      console.error(`[CRON] Price update failed:`, error);
      throw error;
    }
  }
});

