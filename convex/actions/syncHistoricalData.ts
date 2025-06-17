import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

// Fetch and store historical data for all active markets
export const syncAllHistoricalData = action({
  handler: async (ctx) => {
    "use node";
    
    console.log(`[CRON] Starting historical data sync at ${new Date().toISOString()}`);
    const startTime = Date.now();
    
    // Get all active predictions
    const predictions = await ctx.runQuery(api.predictions.getActive);
    
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const prediction of predictions) {
      if (prediction.source === "polymarket" && prediction.sourceUrl) {
        try {
          // Extract slug from URL
          const match = prediction.sourceUrl.match(/polymarket\.com\/event\/([^\/\?]+)/);
          if (match) {
            const slug = match[1];
            
            // Use the existing getPolymarketHistoricalData action
            const historicalData = await ctx.runAction(api.predictions.getPolymarketHistoricalData, { slug });
            
            if (historicalData && historicalData.length > 0) {
              // Store the historical data
              await ctx.runMutation(internal.actions.syncHistoricalData.storeHistoricalData, {
                predictionId: prediction._id,
                dataPoints: historicalData.map((point: any) => ({
                  timestamp: new Date(point.date).getTime(),
                  probability: point.probability
                })),
                source: prediction.source
              });
              
              results.updated++;
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`${prediction.title}: ${error}`);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[CRON] Historical sync completed in ${duration}ms - Updated ${results.updated} markets, ${results.failed} failures`);
    
    return {
      ...results,
      duration,
      timestamp: new Date().toISOString(),
      message: `Updated historical data for ${results.updated} markets`
    };
  }
});

// Internal mutation to store historical data
export const storeHistoricalData = internalMutation({
  args: {
    predictionId: v.id("predictions"),
    dataPoints: v.array(v.object({
      timestamp: v.number(),
      probability: v.number()
    })),
    source: v.union(
      v.literal("polymarket"),
      v.literal("kalshi"),
      v.literal("metaculus"),
      v.literal("manifold"),
      v.literal("predictit"),
      v.literal("adjacent"),
      v.literal("other")
    )
  },
  handler: async (ctx, args) => {
    // Delete existing history for this prediction
    const existing = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", q => 
        q.eq("predictionId", args.predictionId)
      )
      .collect();
    
    for (const record of existing) {
      await ctx.db.delete(record._id);
    }
    
    // Insert new history points
    for (const point of args.dataPoints) {
      await ctx.db.insert("predictionHistory", {
        predictionId: args.predictionId,
        timestamp: point.timestamp,
        probability: point.probability,
        source: args.source
      });
    }
    
    return { stored: args.dataPoints.length };
  }
});