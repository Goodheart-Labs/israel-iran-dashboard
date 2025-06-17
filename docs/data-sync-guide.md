# Data Sync Guide

## Overview
This guide explains how to copy data between production and local environments for testing and development.

## Export Data from Production

1. Go to the Convex dashboard for production (striped-gopher-860)
2. Open the Functions console
3. Run this command:
```javascript
const data = await ctx.runQuery(internal.sync.syncData.exportAllData);
console.log(JSON.stringify(data));
```
4. Copy the entire output

## Import Data to Local

1. Save the exported data to a file (e.g., `prod-data.json`)
2. Go to your local Convex dashboard
3. Run this command:
```javascript
const data = /* paste the JSON data here */;
await ctx.runMutation(internal.sync.syncData.importAllData, { data });
```

## What Gets Synced

- ✅ Predictions (all markets)
- ✅ Prediction History (historical data)
- ✅ Dashboards
- ✅ Dashboard Markets (assignments)
- ✅ Users (be careful!)

## Safety Notes

⚠️ **WARNING**: The import function DELETES all existing data before importing!

- Always backup before importing
- Be very careful when syncing users
- Test in local first before production
- The sync preserves relationships between tables

## Use Cases

1. **Testing with real data**: Copy production data to local for testing
2. **Debugging production issues**: Reproduce exact production state locally
3. **Migration**: Move data between Convex deployments
4. **Backup**: Export data for safekeeping

## Alternative: Selective Sync

If you only want specific data:
```javascript
// Export only predictions from last 7 days
const recentPredictions = await ctx.db
  .query("predictions")
  .filter(q => q.gte(q.field("lastUpdated"), Date.now() - 7 * 24 * 60 * 60 * 1000))
  .collect();
```

## Automation Ideas

Future improvement: Create admin UI buttons for:
- "Export Current Data" → downloads JSON file
- "Import Data" → uploads JSON file
- "Sync from Production" → one-click sync