"use node";

import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
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
        await ctx.runMutation(internal.actions.updateCurrentPrices.addHistoryPoint, {
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

// Add a single history point
export const addHistoryPoint = internalMutation({
  args: {
    predictionId: v.id("predictions"),
    timestamp: v.number(),
    probability: v.number(),
    source: v.union(
      v.literal("metaculus"),
      v.literal("kalshi"),
      v.literal("polymarket"),
      v.literal("predictit"),
      v.literal("manifold"),
      v.literal("adjacent"),
      v.literal("other")
    )
  },
  handler: async (ctx, args) => {
    // Check if we already have data for today
    const startOfDay = new Date(args.timestamp);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(args.timestamp);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existing = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", q => 
        q.eq("predictionId", args.predictionId)
      )
      .filter(q => 
        q.and(
          q.gte(q.field("timestamp"), startOfDay.getTime()),
          q.lte(q.field("timestamp"), endOfDay.getTime())
        )
      )
      .first();
    
    if (existing) {
      // Update existing point for today
      await ctx.db.patch(existing._id, {
        probability: args.probability,
        timestamp: args.timestamp
      });
    } else {
      // Add new point
      await ctx.db.insert("predictionHistory", {
        predictionId: args.predictionId,
        timestamp: args.timestamp,
        probability: args.probability,
        source: args.source
      });
    }
  }
});