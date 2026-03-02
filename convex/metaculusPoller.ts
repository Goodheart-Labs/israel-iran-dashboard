"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const pollMetaculusPrices = action({
  args: {},
  handler: async (ctx) => {
    console.log("[METACULUS POLL] Starting price update...");

    const startTime = Date.now();
    let updated = 0;
    let failed = 0;

    try {
      const predictions = await ctx.runQuery(api.predictions.getActive);
      const metaculusPredictions = predictions.filter(
        (p: any) => p.source === "metaculus"
      );

      if (metaculusPredictions.length === 0) {
        console.log("[METACULUS POLL] No Metaculus markets to poll");
        return { updated: 0, failed: 0, duration: 0 };
      }

      for (const prediction of metaculusPredictions) {
        try {
          if (!prediction.sourceUrl) {
            throw new Error("No source URL");
          }

          // Extract question ID from URL: https://www.metaculus.com/questions/5253/
          const match = prediction.sourceUrl.match(/questions\/(\d+)/);
          if (!match) {
            throw new Error("Could not extract question ID from URL");
          }
          const questionId = match[1];

          const metaculusToken = process.env.METACULUS_API_KEY || "";
          const mcHeaders: Record<string, string> = { Accept: "application/json" };
          if (metaculusToken) mcHeaders["Authorization"] = `Token ${metaculusToken}`;
          const resp = await fetch(
            `https://www.metaculus.com/api/posts/${questionId}/`,
            { headers: mcHeaders }
          );

          if (!resp.ok) {
            throw new Error(`Metaculus API ${resp.status}`);
          }

          const data = await resp.json();
          const q = data.question;

          let probability = 0;

          // Try aggregations first (community prediction)
          if (q?.aggregations?.recency_weighted?.latest?.centers?.[0] !== undefined) {
            probability = Math.round(
              q.aggregations.recency_weighted.latest.centers[0] * 100
            );
          } else if (q?.aggregations?.metaculus_prediction?.latest?.centers?.[0] !== undefined) {
            probability = Math.round(
              q.aggregations.metaculus_prediction.latest.centers[0] * 100
            );
          }

          if (probability > 0 && prediction.probability !== probability) {
            await ctx.runMutation(
              internal.priceMutations.updateCurrentPrice,
              {
                predictionId: prediction._id,
                probability,
                timestamp: Date.now(),
              }
            );
            console.log(
              `[METACULUS POLL] Updated ${prediction.title}: ${prediction.probability}% → ${probability}%`
            );
            updated++;
          }
        } catch (error) {
          console.error(
            `[METACULUS POLL] Error updating ${prediction.title}:`,
            error
          );
          failed++;
        }
      }
    } catch (error) {
      console.error("[METACULUS POLL] Fatal error:", error);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[METACULUS POLL] Complete. Updated: ${updated}, Failed: ${failed}, Duration: ${duration}ms`
    );
    return { updated, failed, duration };
  },
});
