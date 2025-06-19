"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const loadInitialHistoricalData = action({
  args: {},
  handler: async (ctx) => {
    console.log("[INITIAL LOAD] Starting initial historical data load...");
    
    try {
      // First, load all historical data
      const historicalResult = await ctx.runAction(internal.historicalUpdater.updateHistoricalData);
      console.log("[INITIAL LOAD] Historical data load complete:", historicalResult);
      
      // Then do a price poll to ensure current prices are up to date
      const priceResult = await ctx.runAction(internal.pricePoller.pollCurrentPrices);
      console.log("[INITIAL LOAD] Current price poll complete:", priceResult);
      
      return {
        success: true,
        historical: historicalResult,
        prices: priceResult,
      };
    } catch (error) {
      console.error("[INITIAL LOAD] Failed:", error);
      return {
        success: false,
        error: String(error),
      };
    }
  },
});