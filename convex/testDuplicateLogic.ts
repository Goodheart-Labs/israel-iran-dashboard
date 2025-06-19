"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const testDuplicatePreventionLogic = action({
  args: {
    predictionId: v.id("predictions"),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("=== TESTING DUPLICATE PREVENTION LOGIC ===");
    
    // Get current history
    const history: any[] = await ctx.runQuery(api.predictions.getHistory, {
      predictionId: args.predictionId
    });
    
    // Create a map of existing timestamps (in seconds)
    const existingTimestamps = new Set(
      history.map(h => Math.floor(h.timestamp / 1000))
    );
    
    console.log(`Current history points: ${history.length}`);
    console.log(`Unique timestamps (seconds): ${existingTimestamps.size}`);
    
    // Check for near-duplicates (within 1 minute)
    const timestampArray = Array.from(existingTimestamps).sort();
    const nearDuplicates = [];
    
    for (let i = 1; i < timestampArray.length; i++) {
      const diff = timestampArray[i] - timestampArray[i-1];
      if (diff < 60) { // Less than 60 seconds
        nearDuplicates.push({
          t1: timestampArray[i-1],
          t2: timestampArray[i],
          diff: diff,
          date1: new Date(timestampArray[i-1] * 1000).toISOString(),
          date2: new Date(timestampArray[i] * 1000).toISOString()
        });
      }
    }
    
    console.log(`Near duplicates found: ${nearDuplicates.length}`);
    if (nearDuplicates.length > 0) {
      console.log("Sample near duplicates:", nearDuplicates.slice(0, 5));
    }
    
    // Test what happens when we try to store a point that might be considered duplicate
    const testTimestamp = 1750195806; // A timestamp from the API
    const testTimestampMs = testTimestamp * 1000;
    
    console.log("\nTesting timestamp storage:");
    console.log(`Test timestamp (seconds): ${testTimestamp}`);
    console.log(`Test timestamp (ms): ${testTimestampMs}`);
    console.log(`Test date: ${new Date(testTimestampMs).toISOString()}`);
    console.log(`Exists in history (exact match): ${existingTimestamps.has(testTimestamp)}`);
    
    // Check the exact duplicate check logic from storeMarketHistory
    const exactMatch = history.find(h => h.timestamp === testTimestampMs);
    console.log(`Would be rejected by exact match: ${!!exactMatch}`);
    
    // Check if there's a close match (within 1 second)
    const closeMatches = history.filter(h => {
      const diff = Math.abs(h.timestamp - testTimestampMs);
      return diff < 1000 && diff > 0;
    });
    
    if (closeMatches.length > 0) {
      console.log(`\nFound ${closeMatches.length} close matches within 1 second:`);
      closeMatches.forEach(match => {
        console.log(`  Existing: ${new Date(match.timestamp).toISOString()} (diff: ${match.timestamp - testTimestampMs}ms)`);
      });
    }
    
    return {
      currentHistoryCount: history.length,
      uniqueTimestamps: existingTimestamps.size,
      nearDuplicates: nearDuplicates.length,
      sampleNearDuplicates: nearDuplicates.slice(0, 5),
      testTimestamp: {
        seconds: testTimestamp,
        milliseconds: testTimestampMs,
        date: new Date(testTimestampMs).toISOString(),
        wouldBeRejected: !!exactMatch
      }
    };
  }
});