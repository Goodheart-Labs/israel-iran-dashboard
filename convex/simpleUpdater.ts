"use node";

import { action, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

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
      await ctx.runMutation(internal.simpleUpdater.recordUpdateStatus, {
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
      await ctx.runMutation(internal.simpleUpdater.recordUpdateStatus, {
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

// Internal mutation to record update status
export const recordUpdateStatus = mutation({
  args: {
    success: v.boolean(),
    marketsUpdated: v.number(),
    duration: v.number(),
    timestamp: v.number(),
    errors: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Update last update status
    const existing = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", "lastUpdate"))
      .first();
    
    const statusData = {
      success: args.success,
      marketsUpdated: args.marketsUpdated,
      duration: args.duration,
      timestamp: args.timestamp,
      errors: args.errors,
    };
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: statusData,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("systemStatus", {
        key: "lastUpdate",
        value: statusData,
        updatedAt: Date.now(),
      });
    }
    
    // Also track update history (keep last 24 hours)
    const historyKey = "updateHistory";
    const historyRecord = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", historyKey))
      .first();
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const currentHistory = historyRecord?.value || [];
    const recentHistory = currentHistory.filter((h: any) => h.timestamp > oneDayAgo);
    
    // Add new entry
    recentHistory.push(statusData);
    
    if (historyRecord) {
      await ctx.db.patch(historyRecord._id, {
        value: recentHistory,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("systemStatus", {
        key: historyKey,
        value: recentHistory,
        updatedAt: Date.now(),
      });
    }
  },
});