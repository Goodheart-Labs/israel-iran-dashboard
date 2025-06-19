"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const loadInitialHistoricalData = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    historical?: any;
    prices?: any;
    error?: string;
  }> => {
    console.log("[INITIAL LOAD] Starting initial historical data load...");
    
    try {
      // First, load all historical data
      const historicalResult = await ctx.runAction(api.historicalUpdater.updateHistoricalData);
      console.log("[INITIAL LOAD] Historical data load complete:", historicalResult);
      
      // Then do a price poll to ensure current prices are up to date
      const priceResult = await ctx.runAction(api.pricePoller.pollCurrentPrices);
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