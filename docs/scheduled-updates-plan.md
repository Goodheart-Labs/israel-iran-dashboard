# Scheduled Updates Plan

## Overview
Set up automatic regular updates for market prices and historical data.

## API Usage Calculation

### Current Markets
- ~10 active markets
- 1 API call per market (or could batch)
- Polymarket has reasonable rate limits

### Every 5 Minutes
- 12 updates per hour
- 288 updates per day
- ~10 API calls per update = 2,880 API calls/day
- Still well within reasonable usage

## Revised Proposal

### 1. **Price Updates Every 5 Minutes**
```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update prices every 5 minutes
crons.interval(
  "update-prices",
  { minutes: 5 },
  internal.actions.updateCurrentPrices.updateAllCurrentPrices
);

// Weekly historical sync (Sundays at 2 AM UTC)
crons.weekly(
  "sync-historical",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.actions.syncHistoricalData.syncAllHistoricalData
);

export default crons;
```

### Alternative: Using Scheduled Functions
```typescript
// If crons.interval isn't available, use scheduler
export const scheduleUpdates = internalMutation({
  handler: async (ctx) => {
    // Schedule next update in 5 minutes
    await ctx.scheduler.runAfter(
      5 * 60 * 1000, // 5 minutes in milliseconds
      internal.actions.updateCurrentPrices.updateAllCurrentPrices
    );
  }
});

// In the update action, reschedule itself
export const updateAllCurrentPrices = action({
  handler: async (ctx) => {
    // ... do the update ...
    
    // Schedule next run
    await ctx.runMutation(internal.crons.scheduleUpdates);
  }
});
```

## Benefits of 5-Minute Updates

1. **Near Real-Time**: Markets can move quickly during events
2. **Better User Experience**: Charts show very recent data
3. **Competitive**: Match what other dashboards offer
4. **Still Efficient**: Only one history point per day stored

## Implementation Details

1. **History Deduplication**: 
   - Even with 5-minute updates, we only store one history point per day
   - The `addHistoryPoint` function already handles this

2. **Performance**:
   - Each update is lightweight
   - Convex handles concurrent requests well
   - No impact on user experience

3. **Cost Estimate**:
   - 288 function executions per day
   - At Convex's pricing, still very minimal
   - Worth it for fresh data

## Error Handling

Since we're running so frequently:
- Log errors but don't alert unless multiple consecutive failures
- Built-in retry in the action
- Continue with other markets if one fails

## Next Steps

Should I implement the 5-minute update schedule using:
1. Convex cron jobs (if available in your plan)
2. Self-scheduling functions (works on any plan)
3. External cron service (if you prefer)

The 5-minute frequency makes total sense for a real-time dashboard!