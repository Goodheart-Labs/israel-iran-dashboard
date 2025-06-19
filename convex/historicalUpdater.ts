"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { ConvexError } from "convex/values";

export const updateHistoricalData = action({
  args: {},
  handler: async (ctx) => {
    console.log("[HISTORICAL] Starting 30-day historical data update...");
    
    const startTime = Date.now();
    const results = {
      success: true,
      marketsUpdated: 0,
      marketsFailed: 0,
      errors: [] as string[],
      timestamp: startTime,
    };
    
    try {
      // Get all active Polymarket predictions
      const predictions = await ctx.runQuery(api.predictions.getActive);
      const polymarketPredictions = predictions.filter((p: any) => p.source === "polymarket");
      
      console.log(`[HISTORICAL] Found ${polymarketPredictions.length} Polymarket predictions to update`);
      
      for (const prediction of polymarketPredictions) {
        try {
          // Extract slug from sourceUrl
          const urlParts = prediction.sourceUrl.split('/');
          const slug = urlParts[urlParts.length - 1];
          
          console.log(`[HISTORICAL] Processing ${prediction.title} (${slug})`);
          
          // Fetch market details to get clobTokenId
          const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
          if (!eventResponse.ok) {
            throw new Error(`Event API returned ${eventResponse.status}`);
          }
          
          const events = await eventResponse.json();
          if (!events?.[0]?.markets?.[0]) {
            throw new Error("No markets found for slug");
          }
          
          const market = events[0].markets[0];
          const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
          if (!marketResponse.ok) {
            throw new Error(`Market API returned ${marketResponse.status}`);
          }
          
          const marketDetails = await marketResponse.json();
          if (!marketDetails.clobTokenIds) {
            throw new Error("No clobTokenIds found");
          }
          
          const clobTokenIds = JSON.parse(marketDetails.clobTokenIds);
          const clobTokenId = clobTokenIds[0];
          
          // Fetch 30 days of historical data
          const endTs = Math.floor(Date.now() / 1000);
          const startTs = endTs - (30 * 24 * 60 * 60); // 30 days ago
          
          const historyUrl = `https://clob.polymarket.com/prices-history?market=${clobTokenId}&fidelity=30&startTs=${startTs}&endTs=${endTs}`;
          console.log(`[HISTORICAL] Fetching history from: ${historyUrl}`);
          
          const historyResponse = await fetch(historyUrl);
          if (!historyResponse.ok) {
            throw new Error(`History API returned ${historyResponse.status}`);
          }
          
          const historyData = await historyResponse.json();
          const points = historyData.history || [];
          
          console.log(`[HISTORICAL] Fetched ${points.length} data points for ${prediction.title}`);
          
          // Store the new history (this will handle the replacement logic)
          await ctx.runMutation(internal.historicalMutations.replaceHistory, {
            predictionId: prediction._id,
            historyData: points.map((p: any) => ({
              timestamp: p.t * 1000, // Convert to milliseconds
              probability: Math.round(p.p * 100) // Convert to percentage
            })),
            source: "polymarket"
          });
          
          results.marketsUpdated++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          const errorMsg = `${prediction.title}: ${String(error)}`;
          console.error(`[HISTORICAL] Error: ${errorMsg}`);
          results.errors.push(errorMsg);
          results.marketsFailed++;
        }
      }
      
    } catch (error) {
      console.error("[HISTORICAL] Fatal error:", error);
      results.success = false;
      results.errors.push(`Fatal error: ${String(error)}`);
    }
    
    const duration = Date.now() - startTime;
    
    // Record the update status
    await ctx.runMutation(internal.statusMutations.recordHistoricalUpdate, {
      success: results.success && results.marketsFailed === 0,
      marketsUpdated: results.marketsUpdated,
      marketsFailed: results.marketsFailed,
      duration,
      timestamp: startTime,
      errors: results.errors,
    });
    
    console.log(`[HISTORICAL] Update complete. Updated: ${results.marketsUpdated}, Failed: ${results.marketsFailed}, Duration: ${duration}ms`);
    
    return results;
  },
});