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
    const [lastUpdate, history] = await Promise.all([
      ctx.runQuery(api.systemStatus.getLastUpdate),
      ctx.runQuery(api.systemStatus.getUpdateHistory),
    ]);
    
    // Calculate success rate from history
    const recentUpdates = history.slice(0, 10); // Last 10 updates
    const successCount = recentUpdates.filter(u => u.success).length;
    const successRate = recentUpdates.length > 0 
      ? Math.round((successCount / recentUpdates.length) * 100)
      : 0;
    
    // Check if updates are stale (> 1 hour old)
    const isStale = lastUpdate.lastUpdatedAgo ? lastUpdate.lastUpdatedAgo > 60 * 60 * 1000 : true;
    
    return {
      lastUpdate,
      successRate,
      totalUpdates24h: history.length,
      isStale,
      status: isStale ? 'warning' : lastUpdate.success ? 'healthy' : 'error',
    };
  },
});