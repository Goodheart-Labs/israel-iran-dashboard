import { mutation } from "./_generated/server";

// Add test prediction for development
export const addTestPrediction = mutation({
  handler: async (ctx) => {
    const now = Date.now();
    
    // Add a test prediction
    const predictionId = await ctx.db.insert("predictions", {
      category: "military_action",
      title: "Will Iran conduct a military operation before 2025?",
      description: "Test prediction for development",
      probability: 35,
      previousProbability: 32,
      source: "polymarket",
      sourceUrl: "https://polymarket.com/event/test",
      lastUpdated: now,
      isActive: true,
      isApproved: true,
      clarificationText: "This is a test prediction for development purposes"
    });
    
    // Add some historical data
    const historyPoints = [];
    for (let i = 0; i < 20; i++) {
      const timestamp = now - (i * 60 * 60 * 1000); // Going back in hours
      const probability = 30 + Math.floor(Math.random() * 10); // Random between 30-40
      
      historyPoints.push({
        predictionId,
        timestamp,
        probability,
        source: "polymarket" as const
      });
    }
    
    // Insert history in reverse order (oldest first)
    for (const point of historyPoints.reverse()) {
      await ctx.db.insert("predictionHistory", point);
    }
    
    return { 
      success: true, 
      predictionId,
      message: "Added test prediction with 20 history points" 
    };
  }
});