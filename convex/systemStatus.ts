import { query } from "./_generated/server";
import { api } from "./_generated/api";

// Get the last update status
export const getLastUpdate = query({
  handler: async (ctx) => {
    const status = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", "lastUpdate"))
      .first();
    
    if (!status) {
      return {
        success: false,
        message: "No updates yet",
        timestamp: null,
      };
    }
    
    const data = status.value as {
      success: boolean;
      marketsUpdated: number;
      duration: number;
      timestamp: number;
      errors: string[];
    };
    
    return {
      success: data.success,
      marketsUpdated: data.marketsUpdated,
      duration: data.duration,
      timestamp: data.timestamp,
      errors: data.errors,
      lastUpdatedAgo: Date.now() - data.timestamp,
    };
  },
});

// Get update history for monitoring
export const getUpdateHistory = query({
  handler: async (ctx) => {
    const history = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", "updateHistory"))
      .first();
    
    if (!history) {
      return [];
    }
    
    // Return sorted by timestamp, newest first
    const updates = history.value as Array<{
      success: boolean;
      marketsUpdated: number;
      duration: number;
      timestamp: number;
      errors: string[];
    }>;
    
    return updates.sort((a, b) => b.timestamp - a.timestamp);
  },
});

// Get system health summary
export const getSystemHealth = query({
  handler: async (ctx) => {
    // Get status directly instead of calling other queries
    const lastUpdateStatus = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", "lastUpdate"))
      .first();
    
    const historyRecord = await ctx.db
      .query("systemStatus")
      .withIndex("by_key", q => q.eq("key", "updateHistory"))
      .first();
    
    const history = historyRecord?.value || [];
    const lastUpdate = lastUpdateStatus?.value || { success: false, timestamp: null };
    
    // Calculate success rate from history
    const recentUpdates: any[] = history.slice(0, 10);
    const successCount = recentUpdates.filter((u: any) => u.success).length;
    const successRate = recentUpdates.length > 0 
      ? Math.round((successCount / recentUpdates.length) * 100)
      : 0;
    
    // Check if updates are stale (> 1 hour old)
    const lastUpdatedAgo = lastUpdate.timestamp ? Date.now() - lastUpdate.timestamp : null;
    const isStale = lastUpdatedAgo ? lastUpdatedAgo > 60 * 60 * 1000 : true;
    
    return {
      lastUpdate: {
        ...lastUpdate,
        lastUpdatedAgo
      },
      successRate,
      totalUpdates24h: history.length,
      isStale,
      status: isStale ? 'warning' : lastUpdate.success ? 'healthy' : 'error',
    };
  },
});