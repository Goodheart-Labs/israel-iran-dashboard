import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to replace history data
export const replaceHistory = internalMutation({
  args: {
    predictionId: v.id("predictions"),
    historyData: v.array(v.object({
      timestamp: v.number(),
      probability: v.number(),
    })),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    // First, create a backup marker
    const now = Date.now();
    
    try {
      // Get current history count for logging
      const currentHistory = await ctx.db
        .query("predictionHistory")
        .withIndex("by_prediction_time", (q) => q.eq("predictionId", args.predictionId))
        .collect();
      
      console.log(`[REPLACE HISTORY] Replacing ${currentHistory.length} points with ${args.historyData.length} new points`);
      
      // Delete old history
      for (const point of currentHistory) {
        await ctx.db.delete(point._id);
      }
      
      // Insert new history
      let stored = 0;
      for (const point of args.historyData) {
        await ctx.db.insert("predictionHistory", {
          predictionId: args.predictionId,
          probability: point.probability,
          timestamp: point.timestamp,
          source: args.source,
        });
        stored++;
      }
      
      // Update prediction with last historical update time
      await ctx.db.patch(args.predictionId, {
        lastHistoricalUpdate: now,
        historicalDataPoints: stored,
      });
      
      return { success: true, stored, replaced: currentHistory.length };
      
    } catch (error) {
      console.error("[REPLACE HISTORY] Error during replacement:", error);
      // If we fail, the old data might be partially deleted
      // In production, we'd want a more robust transaction system
      throw error;
    }
  },
});