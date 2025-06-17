# API Sync Guide

## Overview
This guide explains how to sync historical data and update current prices from prediction market APIs.

## 1. Sync Historical Data (One-time setup)

To populate historical charts, run this in the Convex dashboard:

```javascript
// Fetch and store historical data for all Polymarket markets
await ctx.runAction(internal.actions.syncHistoricalData.syncAllHistoricalData);
```

This will:
- Fetch historical data for all Polymarket markets
- Store up to 30 days of history
- Replace any existing historical data

Expected output:
```
{
  updated: 8,
  failed: 0,
  errors: [],
  message: "Updated historical data for 8 markets"
}
```

## 2. Update Current Prices (Run regularly)

To update current market prices and record them in history:

```javascript
// Update prices from APIs and record current values
await ctx.runAction(internal.actions.updateCurrentPrices.updateAllCurrentPrices);
```

This will:
- Fetch latest prices from Polymarket
- Update the predictions table
- Record current values in history (one point per day)

Expected output:
```
{
  polymarketUpdated: 8,
  historyRecorded: 10,
  message: "Updated 8 markets and recorded 10 history points"
}
```

## 3. Schedule Regular Updates

For production, you can set up a cron job to run the update action:

```javascript
// In convex/crons.ts
crons.daily(
  "update-market-prices",
  { hourUTC: 0, minuteUTC: 0 }, // Run at midnight UTC
  internal.actions.updateCurrentPrices.updateAllCurrentPrices
);
```

## Notes

- Historical data sync only needs to run once to populate the charts
- Current price updates should run daily (or more frequently if needed)
- The system only stores one history point per day per market
- If APIs are down, the sync will continue with other markets