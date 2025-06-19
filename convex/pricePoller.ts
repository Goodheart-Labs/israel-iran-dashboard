"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const pollCurrentPrices = action({
  args: {},
  handler: async (ctx) => {
    console.log("[PRICE POLL] Starting current price update...");
    
    const startTime = Date.now();
    let updated = 0;
    let failed = 0;
    
    try {
      // Get all active predictions
      const predictions = await ctx.runQuery(api.predictions.getActive);
      
      // Update prices in parallel for speed
      const updatePromises = predictions.map(async (prediction: any) => {
        try {
          if (prediction.source === "polymarket") {
            // Extract slug
            const urlParts = prediction.sourceUrl.split('/');
            const slug = urlParts[urlParts.length - 1];
            
            // Quick fetch for current price only
            const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
            if (!response.ok) {
              throw new Error(`API returned ${response.status}`);
            }
            
            const events = await response.json();
            if (!events?.[0]?.markets?.[0]) {
              throw new Error("No market found");
            }
            
            const market = events[0].markets[0];
            const probability = Math.round(parseFloat(market.outcomePrices[0]) * 100);
            
            // Update only if changed
            if (prediction.probability !== probability) {
              await ctx.runMutation(internal.priceMutations.updateCurrentPrice, {
                predictionId: prediction._id,
                probability,
                timestamp: Date.now(),
              });
              console.log(`[PRICE POLL] Updated ${prediction.title}: ${prediction.probability}% → ${probability}%`);
              updated++;
            }
          }
          // Add other sources here (Metaculus, Kalshi, etc.)
          
        } catch (error) {
          console.error(`[PRICE POLL] Error updating ${prediction.title}:`, error);
          failed++;
        }
      });
      
      await Promise.all(updatePromises);
      
    } catch (error) {
      console.error("[PRICE POLL] Fatal error:", error);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[PRICE POLL] Complete. Updated: ${updated}, Failed: ${failed}, Duration: ${duration}ms`);
    
    return { updated, failed, duration };
  },
});