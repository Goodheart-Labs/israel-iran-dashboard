"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Simple, reliable update function with proper error handling
export const updatePredictions = action({
  handler: async (ctx) => {
    const startTime = Date.now();
    const results = {
      sources: [] as Array<{
        source: string;
        success: boolean;
        marketsUpdated: number;
        error?: string;
        duration: number;
      }>,
      totalUpdated: 0,
      totalDuration: 0,
    };
    
    // List of update functions to try
    const updateSources = [
      {
        name: "polymarket-direct",
        fn: () => ctx.runAction(api.predictions.fetchPolymarketDirectMarkets),
      },
      // Add more sources here as they become reliable
    ];
    
    // Try each source independently
    for (const { name, fn } of updateSources) {
      const sourceStart = Date.now();
      
      try {
        // Check if we should update this source
        const shouldUpdate = await ctx.runQuery(api.updateSystem.shouldUpdateSource, { 
          source: name 
        });
        
        if (!shouldUpdate.shouldUpdate) {
          console.log(`Skipping ${name}: ${shouldUpdate.reason}`);
          continue;
        }
        
        console.log(`Updating from ${name}...`);
        const result = await fn();
        const duration = Date.now() - sourceStart;
        
        // Record success
        await ctx.runMutation(api.updateSystem.recordUpdateAttempt, {
          source: name,
          success: true,
          marketsUpdated: result.updated || 0,
          duration,
        });
        
        results.sources.push({
          source: name,
          success: true,
          marketsUpdated: result.updated || 0,
          duration,
        });
        
        results.totalUpdated += result.updated || 0;
        
      } catch (error) {
        const duration = Date.now() - sourceStart;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        console.error(`Error updating from ${name}:`, errorMessage);
        
        // Record failure
        await ctx.runMutation(api.updateSystem.recordUpdateAttempt, {
          source: name,
          success: false,
          marketsUpdated: 0,
          errorMessage,
          duration,
        });
        
        results.sources.push({
          source: name,
          success: false,
          marketsUpdated: 0,
          error: errorMessage,
          duration,
        });
      }
    }
    
    results.totalDuration = Date.now() - startTime;
    
    console.log(`Update completed in ${results.totalDuration}ms:`, {
      totalUpdated: results.totalUpdated,
      sources: results.sources.map(s => ({
        name: s.source,
        success: s.success,
        markets: s.marketsUpdated,
      })),
    });
    
    return results;
  },
});

// Get update health dashboard data
export const getUpdateDashboard = action({
  handler: async (ctx) => {
    const [sourceHealth, recentUpdates, activePredictions] = await Promise.all([
      ctx.runQuery(api.updateSystem.getSourceHealth),
      ctx.runQuery(api.updateSystem.getRecentUpdates, { limit: 20, hoursBack: 24 }),
      ctx.runQuery(api.predictions.getActive),
    ]);
    
    // Calculate update statistics
    const lastHour = Date.now() - (60 * 60 * 1000);
    const recentUpdateCount = recentUpdates.filter(u => u.timestamp > lastHour).length;
    
    // Find stale predictions (not updated in 2+ hours)
    const staleThreshold = Date.now() - (2 * 60 * 60 * 1000);
    const stalePredictions = activePredictions.filter(p => p.lastUpdated < staleThreshold);
    
    return {
      sourceHealth,
      recentUpdates,
      stats: {
        totalSources: sourceHealth.length,
        healthySources: sourceHealth.filter(s => s.status === "healthy").length,
        updatesLastHour: recentUpdateCount,
        activePredictions: activePredictions.length,
        stalePredictions: stalePredictions.length,
      },
      stalePredictions: stalePredictions.slice(0, 5), // Top 5 stale
    };
  },
});