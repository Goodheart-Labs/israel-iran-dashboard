# New Update Architecture - Simplified Approach

## Overview
Instead of trying to incrementally update and manage duplicates, we'll:
1. **Fetch 30 days of historical data** - Every 15 minutes + on deploy
2. **Poll current prices** - Every minute for real-time updates
3. **Replace, don't merge** - Overwrite historical data each time

## Benefits
- No duplicate management needed
- Always have complete data
- Simple and predictable
- Real-time price updates

## Implementation Plan

### 1. Historical Data Update (Every 15 minutes)
```typescript
// convex/historicalUpdater.ts
export const updateHistoricalData = action({
  handler: async (ctx) => {
    const predictions = await ctx.runQuery(api.predictions.getActive);
    const polymarketPredictions = predictions.filter(p => p.source === "polymarket");
    
    for (const prediction of polymarketPredictions) {
      // Fetch 30 days of data
      const historyData = await fetchPolymarketHistory(prediction.slug, 30);
      
      // Clear old history for this prediction
      await ctx.runMutation(api.predictions.clearHistory, {
        predictionId: prediction._id
      });
      
      // Store new history (no duplicate checks needed!)
      await ctx.runMutation(api.predictions.storeFullHistory, {
        predictionId: prediction._id,
        historyData: historyData
      });
    }
  }
});
```

### 2. Current Price Update (Every minute)
```typescript
// convex/pricePoller.ts
export const pollCurrentPrices = action({
  handler: async (ctx) => {
    const predictions = await ctx.runQuery(api.predictions.getActive);
    
    for (const prediction of predictions) {
      const currentPrice = await fetchCurrentPrice(prediction);
      
      await ctx.runMutation(api.predictions.updateCurrentPrice, {
        predictionId: prediction._id,
        price: currentPrice,
        timestamp: Date.now()
      });
    }
  }
});
```

### 3. Cron Jobs
```typescript
// convex/crons.ts
const crons: Crons<DataModel> = {
  // Every 15 minutes - full historical update
  updateHistorical: {
    schedule: "*/15 * * * *",
    handler: api.historicalUpdater.updateHistoricalData,
  },
  
  // Every minute - current prices only
  pollPrices: {
    schedule: "* * * * *",
    handler: api.pricePoller.pollCurrentPrices,
  },
};
```

### 4. Deploy Hook
```typescript
// convex/deployHook.ts
export const onDeploy = action({
  handler: async (ctx) => {
    // Run historical update immediately on deploy
    await ctx.runAction(api.historicalUpdater.updateHistoricalData);
  }
});
```

## Database Schema Changes

### Add fields for better tracking
```typescript
predictions: defineTable({
  // ... existing fields ...
  currentPrice: v.number(),
  lastPriceUpdate: v.number(),
  lastHistoricalUpdate: v.optional(v.number()),
  historicalDataDays: v.optional(v.number()), // How many days we have
})
```

### Separate history storage
```typescript
// Option: Store as single blob per prediction
predictionHistoryBlob: defineTable({
  predictionId: v.id("predictions"),
  data: v.array(v.object({
    timestamp: v.number(),
    price: v.number()
  })),
  lastUpdated: v.number(),
})
.index("by_prediction", ["predictionId"])
```

## API Considerations

### Polymarket API Limits
- We need to check their rate limits
- 7 markets × 2 API calls = 14 calls per minute (for price polling)
- 7 markets × 2 API calls = 14 calls per 15 min (for historical)
- Should be well within limits

### Optimization
- Batch API calls where possible
- Cache market IDs to avoid repeated lookups
- Use Promise.all for parallel fetching

## Migration Steps

1. **Stop current cron jobs**
2. **Deploy new schema**
3. **Clear existing historical data**
4. **Deploy new update functions**
5. **Start new cron jobs**
6. **Monitor for first few cycles**

## Advantages Over Current System

1. **Simplicity**: No complex duplicate logic
2. **Completeness**: Always have 30 days of data
3. **Real-time**: Minute-by-minute price updates
4. **Predictable**: Know exactly when data updates
5. **Debuggable**: Clear separation of concerns

## Potential Issues to Consider

1. **Storage**: 30 days × 24 hours × 60 minutes = 43,200 points per market
   - But Polymarket API gives us 30-minute intervals, so ~1,440 points
   - Very manageable

2. **API Calls**: Make sure we're not hitting rate limits

3. **Data Gaps**: If API is down, we miss that window
   - But next update will fill it in

## Next Steps

1. Create new update functions
2. Test with one market first
3. Monitor API usage
4. Roll out to all markets
5. Remove old update system