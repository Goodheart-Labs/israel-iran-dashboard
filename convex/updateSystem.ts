import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Track update health for each source
export const recordUpdateAttempt = mutation({
  args: {
    source: v.string(),
    success: v.boolean(),
    marketsUpdated: v.number(),
    errorMessage: v.optional(v.string()),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get or create source status
    const existing = await ctx.db
      .query("sourceStatus")
      .withIndex("by_source", q => q.eq("source", args.source))
      .first();
    
    if (existing) {
      // Calculate new success rate
      const totalAttempts = (existing.totalAttempts || 0) + 1;
      const successCount = (existing.successCount || 0) + (args.success ? 1 : 0);
      const successRate = Math.round((successCount / totalAttempts) * 100);
      
      // Update existing record
      await ctx.db.patch(existing._id, {
        lastAttempt: now,
        lastSuccess: args.success ? now : existing.lastSuccess,
        lastError: args.errorMessage || existing.lastError,
        successRate,
        totalAttempts,
        successCount,
        avgResponseTime: Math.round(
          ((existing.avgResponseTime || 0) * (totalAttempts - 1) + args.duration) / totalAttempts
        ),
        status: args.success ? "healthy" : 
          successRate > 50 ? "degraded" : "failed",
      });
    } else {
      // Create new record
      await ctx.db.insert("sourceStatus", {
        source: args.source,
        lastAttempt: now,
        lastSuccess: args.success ? now : undefined,
        lastError: args.errorMessage,
        successRate: args.success ? 100 : 0,
        totalAttempts: 1,
        successCount: args.success ? 1 : 0,
        avgResponseTime: args.duration,
        status: args.success ? "healthy" : "failed",
      });
    }
  },
});

// Get health status for all sources
export const getSourceHealth = query({
  handler: async (ctx) => {
    const sources = await ctx.db
      .query("sourceStatus")
      .collect();
    
    // Sort by success rate
    return sources.sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
  },
});

// Check if we should attempt to update from a source
export const shouldUpdateSource = query({
  args: { source: v.string() },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query("sourceStatus")
      .withIndex("by_source", q => q.eq("source", args.source))
      .first();
    
    if (!status) return { shouldUpdate: true, reason: "No history" };
    
    const hoursSinceLastAttempt = (Date.now() - (status.lastAttempt || 0)) / (1000 * 60 * 60);
    
    // Always try if it's been more than 24 hours
    if (hoursSinceLastAttempt > 24) {
      return { shouldUpdate: true, reason: "Stale - retry after 24h" };
    }
    
    // Failed sources: exponential backoff
    if (status.status === "failed") {
      const hoursSinceLastSuccess = (Date.now() - (status.lastSuccess || 0)) / (1000 * 60 * 60);
      const backoffHours = Math.min(24, Math.pow(2, Math.floor(hoursSinceLastSuccess / 24)));
      
      if (hoursSinceLastAttempt < backoffHours) {
        return { 
          shouldUpdate: false, 
          reason: `Failed - waiting ${backoffHours}h backoff` 
        };
      }
    }
    
    // Degraded sources: try less frequently
    if (status.status === "degraded" && hoursSinceLastAttempt < 2) {
      return { 
        shouldUpdate: false, 
        reason: "Degraded - waiting 2h between attempts" 
      };
    }
    
    return { shouldUpdate: true, reason: "Healthy" };
  },
});

// Record that a prediction was updated
export const recordPredictionUpdate = mutation({
  args: {
    predictionId: v.id("predictions"),
    oldProbability: v.number(),
    newProbability: v.number(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const changePercent = Math.abs(args.newProbability - args.oldProbability);
    
    // Only record significant changes
    if (changePercent >= 1) {
      await ctx.db.insert("updateLog", {
        predictionId: args.predictionId,
        timestamp: Date.now(),
        oldValue: args.oldProbability,
        newValue: args.newProbability,
        changePercent,
        source: args.source,
      });
    }
  },
});

// Get recent updates for monitoring
export const getRecentUpdates = query({
  args: { 
    limit: v.optional(v.number()),
    hoursBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const hoursBack = args.hoursBack || 24;
    const since = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    const updates = await ctx.db
      .query("updateLog")
      .withIndex("by_time", q => q.gte("timestamp", since))
      .order("desc")
      .take(limit);
    
    // Get prediction details
    const predictions = await Promise.all(
      updates.map(u => ctx.db.get(u.predictionId))
    );
    
    return updates.map((update, i) => ({
      ...update,
      prediction: predictions[i],
    }));
  },
});