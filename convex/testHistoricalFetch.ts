"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const testHistoricalFetchTheories = action({
  args: {
    marketSlug: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("=== TESTING HISTORICAL FETCH THEORIES ===");
    const results: any = {
      marketSlug: args.marketSlug,
      timestamp: new Date().toISOString(),
      theories: {}
    };
    
    try {
      // Theory 1: Test if we can fetch market details and parse clobTokenIds
      console.log("Theory 1: Testing clobTokenIds parsing...");
      
      const eventUrl = `https://gamma-api.polymarket.com/events?slug=${args.marketSlug}`;
      const eventResponse = await fetch(eventUrl);
      
      if (!eventResponse.ok) {
        results.theories.eventFetchFailed = true;
        return results;
      }
      
      const events = await eventResponse.json();
      const market = events[0]?.markets?.[0];
      
      if (!market) {
        results.theories.noMarketFound = true;
        return results;
      }
      
      // Get full market details
      const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
      const marketDetails = await marketResponse.json();
      
      results.theories.clobTokenIdsPresent = !!marketDetails.clobTokenIds;
      
      if (marketDetails.clobTokenIds) {
        try {
          const parsed = JSON.parse(marketDetails.clobTokenIds);
          results.theories.clobTokenIdsParsed = true;
          results.theories.clobTokenIds = parsed;
          results.theories.firstClobTokenId = parsed[0];
        } catch (parseError) {
          results.theories.clobTokenIdsParseError = String(parseError);
        }
      }
      
      // Theory 2: Test if historical fetch works directly
      if (results.theories.firstClobTokenId) {
        console.log("Theory 2: Testing direct historical fetch...");
        
        const clobTokenId = results.theories.firstClobTokenId;
        const endTs = Math.floor(Date.now() / 1000);
        const startTs = endTs - (7 * 24 * 60 * 60);
        
        const historyUrl = `https://clob.polymarket.com/prices-history?market=${clobTokenId}&fidelity=30&startTs=${startTs}&endTs=${endTs}`;
        console.log("Fetching history from:", historyUrl);
        
        const historyResponse = await fetch(historyUrl);
        results.theories.historyFetchStatus = historyResponse.status;
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          results.theories.historyPointsReturned = historyData.history?.length || 0;
          results.theories.historySample = historyData.history?.slice(0, 3);
        } else {
          results.theories.historyFetchError = await historyResponse.text();
        }
      }
      
      // Theory 3: Test the full action flow
      console.log("Theory 3: Testing full fetchMarketHistory action...");
      
      if (results.theories.firstClobTokenId) {
        try {
          const actionResult = await ctx.runAction(api.predictions.fetchMarketHistory, {
            marketId: results.theories.firstClobTokenId,
            source: "polymarket",
            days: 7
          });
          
          results.theories.actionResult = actionResult;
        } catch (actionError) {
          results.theories.actionError = String(actionError);
        }
      }
      
      // Theory 4: Check duplicate prevention logic
      console.log("Theory 4: Testing duplicate prevention...");
      
      // Get the prediction from database
      const predictions = await ctx.runQuery(api.predictions.getActive);
      const prediction = predictions.find((p: any) => p.sourceUrl?.includes(args.marketSlug));
      
      if (prediction) {
        results.theories.predictionFound = true;
        results.theories.predictionId = prediction._id;
        
        // Get current history count
        const history = await ctx.runQuery(api.predictions.getHistory, {
          predictionId: prediction._id
        });
        
        results.theories.currentHistoryCount = history.length;
        
        // Check if storeMarketHistory works
        if (results.theories.historyPointsReturned > 0) {
          console.log("Testing storeMarketHistory mutation...");
          
          try {
            // Try storing just a few test points
            const testPoints = results.theories.historySample || [];
            const storeResult = await ctx.runMutation(api.predictions.storeMarketHistory, {
              marketId: results.theories.firstClobTokenId,
              historyData: testPoints,
              source: "polymarket"
            });
            
            results.theories.storeResult = storeResult;
          } catch (storeError) {
            results.theories.storeError = String(storeError);
          }
        }
      }
      
      // Theory 5: Check if the issue is in fetchPolymarketDirectMarkets
      console.log("Theory 5: Checking if historical fetch is called in update flow...");
      
      // This would require adding logging to the actual function, but we can check
      // if the clobTokenIds field exists in the response that function receives
      results.theories.updateFlowCheck = {
        wouldCallHistoricalFetch: !!marketDetails.clobTokenIds,
        hasValidClobTokenId: !!results.theories.firstClobTokenId,
        expectedToWork: !!marketDetails.clobTokenIds && !!results.theories.firstClobTokenId
      };
      
    } catch (error) {
      results.error = String(error);
      console.error("Test error:", error);
    }
    
    console.log("=== TEST RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
    
    return results;
  },
});