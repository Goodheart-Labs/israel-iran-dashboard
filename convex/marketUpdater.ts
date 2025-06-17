import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Self-scheduling market updater that runs every 5 minutes
export const startMarketUpdater = action({
  handler: async (ctx) => {
    "use node";
    
    // Run the update immediately
    await ctx.runAction(internal.marketUpdater.updateMarkets);
    
    // Schedule next run in 5 minutes
    await ctx.scheduler.runAfter(
      5 * 60 * 1000, // 5 minutes
      internal.marketUpdater.updateMarkets
    );
    
    return { 
      started: true, 
      nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString() 
    };
  }
});

// Internal action that updates markets and reschedules itself
export const updateMarkets = internalAction({
  handler: async (ctx) => {
    "use node";
    
    console.log(`[Market Updater] Running update at ${new Date().toISOString()}`);
    
    try {
      // Update current prices from Polymarket
      const priceResult = await ctx.runAction(api.predictions.fetchPolymarketDirectMarkets);
      console.log(`[Market Updater] Price update: ${priceResult.message}`);
      
      // Record current values in history (this already dedupes to one per day)
      const predictions = await ctx.runQuery(api.predictions.getActive);
      for (const prediction of predictions) {
        await ctx.runMutation(internal.predictions.storeMarketHistory, {
          predictionId: prediction._id,
          timestamp: Date.now(),
          probability: prediction.probability
        });
      }
      
      // Schedule next run in 5 minutes
      await ctx.scheduler.runAfter(
        5 * 60 * 1000, // 5 minutes
        internal.marketUpdater.updateMarkets
      );
      
      console.log(`[Market Updater] Completed. Next update in 5 minutes.`);
      
      return {
        success: true,
        updated: priceResult.updated,
        nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };
    } catch (error) {
      console.error(`[Market Updater] Error:`, error);
      
      // Still schedule next run even on error
      await ctx.scheduler.runAfter(
        5 * 60 * 1000,
        internal.marketUpdater.updateMarkets
      );
      
      throw error;
    }
  }
});

// Stop the updater (useful for maintenance)
export const stopMarketUpdater = action({
  handler: async (ctx) => {
    // This doesn't actually stop scheduled functions, but we can use it
    // to track state if needed in the future
    return { message: "To stop updates, scheduled functions must expire naturally" };
  }
});