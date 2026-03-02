"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const pollKalshiPrices = action({
  args: {},
  handler: async (ctx) => {
    console.log("[KALSHI POLL] Starting price update...");

    const startTime = Date.now();
    let updated = 0;
    let failed = 0;

    try {
      const predictions = await ctx.runQuery(api.predictions.getActive);
      const kalshiPredictions = predictions.filter(
        (p: any) => p.source === "kalshi"
      );

      if (kalshiPredictions.length === 0) {
        console.log("[KALSHI POLL] No Kalshi markets to poll");
        return { updated: 0, failed: 0, duration: 0 };
      }

      for (const prediction of kalshiPredictions) {
        try {
          // Extract ticker from sourceUrl — format: https://kalshi.com/markets/kxusairanagreement
          // We need the actual ticker stored in the market. Let's extract from the slug pattern.
          // The sourceUrl base is the series, but we need the specific ticker.
          // We'll search the series markets to find the matching one.
          if (!prediction.sourceUrl) {
            throw new Error("No source URL");
          }

          // For Kalshi, sourceUrl is like: https://kalshi.com/markets/kxusairanagreement
          // We find all markets in that series and match by title
          const urlParts = prediction.sourceUrl.split("/");
          const seriesPart = urlParts[urlParts.length - 1];

          const resp = await fetch(
            `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${seriesPart.toUpperCase()}&limit=20`
          );
          if (!resp.ok) {
            throw new Error(`Kalshi API ${resp.status}`);
          }

          const data = await resp.json();
          const markets = data.markets || [];

          // Find the market that matches this prediction's title
          const match = markets.find(
            (m: any) =>
              m.title === prediction.title ||
              prediction.title.includes(m.title) ||
              m.title.includes(prediction.title.replace(/\?$/, ""))
          );

          if (!match) {
            // Fallback: just take the first active one (the headline market)
            const active = markets.find((m: any) => m.status === "active");
            if (active) {
              const probability = active.last_price; // Already 0-100
              if (prediction.probability !== probability) {
                await ctx.runMutation(
                  internal.priceMutations.updateCurrentPrice,
                  {
                    predictionId: prediction._id,
                    probability,
                    timestamp: Date.now(),
                  }
                );
                console.log(
                  `[KALSHI POLL] Updated ${prediction.title}: ${prediction.probability}% → ${probability}%`
                );
                updated++;
              }
            }
          } else {
            const probability = match.last_price;
            if (prediction.probability !== probability) {
              await ctx.runMutation(
                internal.priceMutations.updateCurrentPrice,
                {
                  predictionId: prediction._id,
                  probability,
                  timestamp: Date.now(),
                }
              );
              console.log(
                `[KALSHI POLL] Updated ${prediction.title}: ${prediction.probability}% → ${probability}%`
              );
              updated++;
            }
          }
        } catch (error) {
          console.error(
            `[KALSHI POLL] Error updating ${prediction.title}:`,
            error
          );
          failed++;
        }
      }
    } catch (error) {
      console.error("[KALSHI POLL] Fatal error:", error);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[KALSHI POLL] Complete. Updated: ${updated}, Failed: ${failed}, Duration: ${duration}ms`
    );
    return { updated, failed, duration };
  },
});
