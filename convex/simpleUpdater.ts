"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Simple update function with status tracking
export const updatePredictions = action({
  handler: async (ctx): Promise<{ success: boolean; marketsUpdated: number; timestamp: string; error?: string }> => {
    const startTime = Date.now();
    console.log(`[UPDATE] Starting update at ${new Date().toISOString()}`);
    
    try {
      // Run the Polymarket update
      const result = await ctx.runAction(api.predictions.fetchPolymarketDirectMarkets, {});
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Record successful update
      await ctx.runMutation(internal.statusMutations.recordUpdateStatus, {
        success: true,
        marketsUpdated: result.updated,
        duration,
        timestamp: endTime,
        errors: result.errors,
      });
      
      console.log(`[UPDATE] Success - Updated ${result.updated} markets in ${duration}ms`);
      
      return {
        success: true,
        marketsUpdated: result.updated,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Record failed update
      await ctx.runMutation(internal.statusMutations.recordUpdateStatus, {
        success: false,
        marketsUpdated: 0,
        duration,
        timestamp: endTime,
        errors: [errorMessage],
      });
      
      console.error(`[UPDATE] Failed after ${duration}ms:`, errorMessage);
      
      return {
        success: false,
        marketsUpdated: 0,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  },
});