"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

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
      const polymarketPredictions = predictions.filter(
        (p: any) => p.source === "polymarket",
      );

      console.log(
        `[HISTORICAL] Found ${polymarketPredictions.length} Polymarket predictions to update`,
      );

      for (const prediction of polymarketPredictions) {
        try {
          // Extract slug from sourceUrl
          const urlParts = (prediction.sourceUrl || "").split("/");
          const slug = urlParts[urlParts.length - 1];

          console.log(`[HISTORICAL] Processing ${prediction.title} (${slug})`);

          // Fetch market details to get clobTokenId
          // Try events API first; fall back to markets API for market-level slugs
          let marketDetails: any = null;
          const eventResponse = await fetch(
            `https://gamma-api.polymarket.com/events?slug=${slug}`,
          );
          if (eventResponse.ok) {
            const events = await eventResponse.json();
            if (events?.[0]?.markets?.[0]) {
              const market = events[0].markets[0];
              const marketResponse = await fetch(
                `https://gamma-api.polymarket.com/markets/${market.id}`,
              );
              if (marketResponse.ok) {
                marketDetails = await marketResponse.json();
              }
            }
          }

          if (!marketDetails) {
            // Fall back: slug is a market-level slug
            const mktResp = await fetch(
              `https://gamma-api.polymarket.com/markets?slug=${slug}`,
            );
            if (!mktResp.ok) throw new Error(`Market API returned ${mktResp.status}`);
            const mkts = await mktResp.json();
            if (!mkts?.[0]) throw new Error("No markets found for slug");
            marketDetails = mkts[0];
          }
          if (!marketDetails.clobTokenIds) {
            throw new Error("No clobTokenIds found");
          }

          const clobTokenIds = JSON.parse(marketDetails.clobTokenIds);
          const clobTokenId = clobTokenIds[0];

          // Fetch full historical data (high fidelity for smooth charts)
          const historyUrl = `https://clob.polymarket.com/prices-history?market=${clobTokenId}&interval=1m&fidelity=60`;
          console.log(`[HISTORICAL] Fetching history from: ${historyUrl}`);

          const historyResponse = await fetch(historyUrl);
          if (!historyResponse.ok) {
            const errorBody = await historyResponse.text();
            throw new Error(`History API returned ${historyResponse.status}: ${errorBody}`);
          }

          const historyData = await historyResponse.json();
          const points = historyData.history || [];

          console.log(
            `[HISTORICAL] Fetched ${points.length} data points for ${prediction.title}`,
          );

          // Store additively (only inserts new points, preserves existing granular data)
          await ctx.runMutation(api.predictions.storeMarketHistory, {
            marketId: clobTokenId,
            marketSlug: slug,
            historyData: points,
            source: "polymarket",
          });

          results.marketsUpdated++;

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
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

    console.log(
      `[HISTORICAL] Update complete. Updated: ${results.marketsUpdated}, Failed: ${results.marketsFailed}, Duration: ${duration}ms`,
    );

    return results;
  },
});
