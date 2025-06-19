import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const updateCurrentPrice = internalMutation({
  args: {
    predictionId: v.id("predictions"),
    probability: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const prediction = await ctx.db.get(args.predictionId);
    if (!prediction) {
      throw new Error("Prediction not found");
    }
    
    // Store history point for the price change
    await ctx.db.insert("predictionHistory", {
      predictionId: args.predictionId,
      probability: args.probability,
      timestamp: args.timestamp,
      source: prediction.source,
    });
    
    // Update the prediction
    await ctx.db.patch(args.predictionId, {
      previousProbability: prediction.probability,
      probability: args.probability,
      lastUpdated: args.timestamp,
    });
    
    return { success: true };
  },
});