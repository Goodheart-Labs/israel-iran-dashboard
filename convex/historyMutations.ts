import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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