"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { kalshiPrice, parseKalshiSourceUrl } from "./sourceParsing";

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

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
          if (!prediction.sourceUrl) {
            throw new Error("No source URL");
          }

          // sourceUrl is the series page, optionally with the exact ticker as
          // a fragment (seeded markets). Older rows have no fragment, so fall
          // back to matching the series' markets by title.
          const { series, ticker } = parseKalshiSourceUrl(prediction.sourceUrl);
          let match: any;

          if (ticker) {
            const resp = await fetch(`${KALSHI_API}/markets/${ticker}`);
            if (!resp.ok) throw new Error(`Kalshi API ${resp.status}`);
            match = (await resp.json()).market;
          } else {
            const resp = await fetch(`${KALSHI_API}/markets?series_ticker=${series}&limit=20`);
            if (!resp.ok) throw new Error(`Kalshi API ${resp.status}`);
            const markets: any[] = (await resp.json()).markets || [];
            const byTitle = markets.filter(
              (m) =>
                m.title === prediction.title ||
                prediction.title.includes(m.title) ||
                m.title.includes(prediction.title.replace(/\?$/, ""))
            );
            // Series can list twins with identical titles; take the most traded.
            const volume = (m: any) => Number(m.volume_fp ?? m.volume ?? 0);
            match =
              byTitle.sort((a, b) => volume(b) - volume(a))[0] ||
              markets.find((m) => m.status === "active");
          }

          if (!match) throw new Error("No matching Kalshi market");
          const probability = kalshiPrice(match);
          if (probability === null) throw new Error(`No price on ${match.ticker}`);

          if (prediction.probability !== probability) {
            await ctx.runMutation(internal.priceMutations.updateCurrentPrice, {
              predictionId: prediction._id,
              probability,
              timestamp: Date.now(),
            });
            console.log(
              `[KALSHI POLL] Updated ${prediction.title}: ${prediction.probability}% → ${probability}%`
            );
            updated++;
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
