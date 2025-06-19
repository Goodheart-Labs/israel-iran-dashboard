"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Debug function to test historical data fetching
export const debugPolymarketHistory = action({
  args: {
    slug: v.string(),
    clobTokenId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    console.log("=== DEBUG HISTORICAL FETCH ===");
    console.log("Testing slug:", args.slug);

    const results: any = {
      slug: args.slug,
      theories: {},
    };

    try {
      // First, fetch event to get market details
      const eventUrl = `https://gamma-api.polymarket.com/events?slug=${args.slug}`;
      console.log("1. Fetching event:", eventUrl);

      const eventResponse = await fetch(eventUrl, {
        headers: { Accept: "application/json" },
      });

      results.theories.eventFetchStatus = eventResponse.status;

      if (!eventResponse.ok) {
        results.theories.eventFetchError = `Status ${eventResponse.status}`;
        return results;
      }

      const events = await eventResponse.json();
      console.log(
        "2. Event response:",
        JSON.stringify(events, null, 2).slice(0, 500),
      );

      if (!events?.[0]?.markets?.[0]) {
        results.theories.noMarketsFound = true;
        return results;
      }

      const market = events[0].markets[0];

      // Get market details for clobTokenId
      const marketUrl = `https://gamma-api.polymarket.com/markets/${market.id}`;
      console.log("3. Fetching market details:", marketUrl);

      const marketResponse = await fetch(marketUrl);
      results.theories.marketFetchStatus = marketResponse.status;

      if (!marketResponse.ok) {
        results.theories.marketFetchError = `Status ${marketResponse.status}`;
        return results;
      }

      const marketDetails = await marketResponse.json();
      console.log("4. Market clobTokenIds:", marketDetails.clobTokenIds);

      const clobTokenIds = JSON.parse(marketDetails.clobTokenIds || "[]");
      const tokenId = args.clobTokenId || clobTokenIds[0];

      if (!tokenId) {
        results.theories.noClobTokenId = true;
        return results;
      }

      // Now test historical fetch with different parameters
      const endTs = Math.floor(Date.now() / 1000);
      const startTs = endTs - 7 * 24 * 60 * 60; // 7 days

      console.log("5. Time range:", {
        startTs,
        startDate: new Date(startTs * 1000).toISOString(),
        endTs,
        endDate: new Date(endTs * 1000).toISOString(),
      });

      // Test Theory 1: Try different fidelity values
      const fidelityTests = ["10", "30", "60", "1440"];

      for (const fidelity of fidelityTests) {
        const params = new URLSearchParams({
          market: tokenId,
          fidelity: fidelity,
          startTs: startTs.toString(),
          endTs: endTs.toString(),
        });

        const historyUrl = `https://clob.polymarket.com/prices-history?${params.toString()}`;
        console.log(`6. Testing fidelity=${fidelity}:`, historyUrl);

        const historyResponse = await fetch(historyUrl, {
          headers: { Accept: "application/json" },
        });

        results.theories[`fidelity_${fidelity}_status`] =
          historyResponse.status;

        if (historyResponse.ok) {
          const data = await historyResponse.json();
          const dataPoints = data.history || [];

          results.theories[`fidelity_${fidelity}_count`] = dataPoints.length;

          // Log first few and last few data points
          if (dataPoints.length > 0) {
            console.log(`Fidelity ${fidelity} sample data:`, {
              first: dataPoints.slice(0, 3).map((p: any) => ({
                time: new Date(p.t * 1000).toISOString(),
                price: p.p,
              })),
              last: dataPoints.slice(-3).map((p: any) => ({
                time: new Date(p.t * 1000).toISOString(),
                price: p.p,
              })),
              totalPoints: dataPoints.length,
            });

            // Check for gaps
            const gaps: any[] = [];
            for (let i = 1; i < dataPoints.length; i++) {
              const timeDiff = dataPoints[i].t - dataPoints[i - 1].t;
              const expectedDiff = parseInt(fidelity) * 60; // fidelity is in minutes

              if (timeDiff > expectedDiff * 1.5) {
                // 50% tolerance
                gaps.push({
                  from: new Date(dataPoints[i - 1].t * 1000).toISOString(),
                  to: new Date(dataPoints[i].t * 1000).toISOString(),
                  gapHours: timeDiff / 3600,
                });
              }
            }

            results.theories[`fidelity_${fidelity}_gaps`] = gaps;
          }
        } else {
          const errorText = await historyResponse.text();
          results.theories[`fidelity_${fidelity}_error`] = errorText.slice(
            0,
            200,
          );
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Test Theory 2: Check our timestamp conversion
      const sampleTime = 1718236800; // A specific timestamp
      results.theories.timestampConversion = {
        original: sampleTime,
        multipliedBy1000: sampleTime * 1000,
        asDate: new Date(sampleTime * 1000).toISOString(),
        currentTime: Date.now(),
        currentTimeInSeconds: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      results.error = String(error);
      console.error("Debug error:", error);
    }

    console.log("=== FINAL RESULTS ===");
    console.log(JSON.stringify(results, null, 2));

    return results;
  },
});
