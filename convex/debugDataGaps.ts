"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const debugDataGaps = action({
  args: { 
    predictionId: v.id("predictions"),
    marketSlug: v.string() 
  },
  handler: async (ctx, args) => {
    console.log("=== DEBUGGING DATA GAPS ===");
    const results: any = {
      predictionId: args.predictionId,
      marketSlug: args.marketSlug,
      timestamp: new Date().toISOString()
    };
    
    try {
      // 1. Check database density
      const dbHistory = await ctx.runQuery(api.predictions.getHistory, { 
        predictionId: args.predictionId 
      });
      
      results.databaseAnalysis = {
        totalPoints: dbHistory.length,
        oldestPoint: dbHistory.length > 0 ? new Date(Math.min(...dbHistory.map(h => h.timestamp))).toISOString() : null,
        newestPoint: dbHistory.length > 0 ? new Date(Math.max(...dbHistory.map(h => h.timestamp))).toISOString() : null,
      };
      
      // Group by day to see distribution
      const byDay: Record<string, number> = {};
      const byHour: Record<string, number> = {};
      
      dbHistory.forEach(point => {
        const date = new Date(point.timestamp);
        const day = date.toISOString().split('T')[0];
        const hour = `${day} ${date.getHours().toString().padStart(2, '0')}:00`;
        
        byDay[day] = (byDay[day] || 0) + 1;
        byHour[hour] = (byHour[hour] || 0) + 1;
      });
      
      results.databaseAnalysis.pointsByDay = byDay;
      results.databaseAnalysis.uniqueHours = Object.keys(byHour).length;
      
      // 2. Analyze gaps
      const timestamps = dbHistory.map(h => h.timestamp).sort((a, b) => a - b);
      const gaps: any[] = [];
      const duplicates: any[] = [];
      const nearDuplicates: any[] = [];
      
      for (let i = 1; i < timestamps.length; i++) {
        const gapMs = timestamps[i] - timestamps[i-1];
        const gapHours = gapMs / 3600000;
        
        if (gapMs === 0) {
          duplicates.push({
            timestamp: new Date(timestamps[i]).toISOString(),
            index: i
          });
        } else if (gapMs < 60000) { // Less than 1 minute
          nearDuplicates.push({ 
            t1: new Date(timestamps[i-1]).toISOString(),
            t2: new Date(timestamps[i]).toISOString(),
            gapMs: gapMs,
            gapSeconds: gapMs / 1000
          });
        }
        
        if (gapHours > 2) { // Gaps larger than 2 hours
          gaps.push({
            from: new Date(timestamps[i-1]).toISOString(),
            to: new Date(timestamps[i]).toISOString(),
            gapHours: gapHours.toFixed(2),
            gapDays: (gapHours / 24).toFixed(2)
          });
        }
      }
      
      results.gapAnalysis = {
        largeGaps: gaps,
        duplicateTimestamps: duplicates,
        nearDuplicates: nearDuplicates,
        averageGapMinutes: timestamps.length > 1 
          ? ((timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1) / 60000).toFixed(2)
          : 0
      };
      
      // 3. Fetch fresh data from API to compare
      try {
        // First get the market details
        const eventUrl = `https://gamma-api.polymarket.com/events?slug=${args.marketSlug}`;
        const eventResponse = await fetch(eventUrl);
        
        if (eventResponse.ok) {
          const events = await eventResponse.json();
          
          if (events?.[0]?.markets?.[0]) {
            const market = events[0].markets[0];
            const marketDetailsResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
            
            if (marketDetailsResponse.ok) {
              const marketDetails = await marketDetailsResponse.json();
              
              if (marketDetails.clobTokenIds) {
                const clobTokenIds = JSON.parse(marketDetails.clobTokenIds);
                const clobTokenId = clobTokenIds[0];
                
                // Fetch history
                const endTs = Math.floor(Date.now() / 1000);
                const startTs = endTs - (7 * 24 * 60 * 60);
                
                const historyUrl = `https://clob.polymarket.com/prices-history?market=${clobTokenId}&fidelity=30&startTs=${startTs}&endTs=${endTs}`;
                const historyResponse = await fetch(historyUrl);
                
                if (historyResponse.ok) {
                  const historyData = await historyResponse.json();
                  const apiPoints = historyData.history || [];
                  
                  results.apiComparison = {
                    apiPointsReturned: apiPoints.length,
                    databasePoints: dbHistory.length,
                    difference: apiPoints.length - dbHistory.length,
                    apiOldest: apiPoints.length > 0 ? new Date(apiPoints[0].t * 1000).toISOString() : null,
                    apiNewest: apiPoints.length > 0 ? new Date(apiPoints[apiPoints.length - 1].t * 1000).toISOString() : null,
                  };
                  
                  // Check which API points are missing from DB
                  const dbTimestampSet = new Set(dbHistory.map(h => Math.floor(h.timestamp / 1000)));
                  const missingFromDb = apiPoints.filter((p: any) => !dbTimestampSet.has(p.t));
                  
                  results.apiComparison.missingFromDatabase = missingFromDb.length;
                  results.apiComparison.sampleMissing = missingFromDb.slice(0, 5).map((p: any) => ({
                    timestamp: new Date(p.t * 1000).toISOString(),
                    price: p.p
                  }));
                }
              }
            }
          }
        }
      } catch (apiError) {
        results.apiError = String(apiError);
      }
      
      // 4. Check for timezone issues
      const hourCounts = Object.values(byHour);
      results.timezoneAnalysis = {
        hoursWithData: Object.keys(byHour).length,
        minPointsPerHour: Math.min(...hourCounts),
        maxPointsPerHour: Math.max(...hourCounts),
        // Check if gaps align with specific hours (e.g., UTC midnight)
        gapsAtMidnightUTC: gaps.filter(g => {
          const fromHour = new Date(g.from).getUTCHours();
          const toHour = new Date(g.to).getUTCHours();
          return fromHour <= 0 && toHour >= 0;
        }).length
      };
      
    } catch (error) {
      results.error = String(error);
      console.error("Debug error:", error);
    }
    
    console.log("=== DEBUG RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
    
    return results;
  },
});