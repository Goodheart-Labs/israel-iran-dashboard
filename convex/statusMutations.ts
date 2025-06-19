import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to record update status
export const recordUpdateStatus = internalMutation({
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

// Internal mutation to record historical update status
export const recordHistoricalUpdate = internalMutation({
  args: {
    success: v.boolean(),
    marketsUpdated: v.number(),
    marketsFailed: v.number(),
    duration: v.number(),
    timestamp: v.number(),
    errors: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Update historical update status
    const existing = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", "lastHistoricalUpdate"))
      .first();
    
    const statusData = {
      success: args.success,
      marketsUpdated: args.marketsUpdated,
      marketsFailed: args.marketsFailed,
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
        key: "lastHistoricalUpdate",
        value: statusData,
        updatedAt: Date.now(),
      });
    }
    
    // Also track historical update history (keep last 24 hours)
    const historyKey = "historicalUpdateHistory";
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