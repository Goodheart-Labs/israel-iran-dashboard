# Polymarket Data Fetching System - Complete Analysis

## Overview
The system fetches and displays prediction market data from Polymarket. There are two types of data:
1. **Current Price** - The latest probability for each market
2. **Historical Data** - Price history over time for charts

## Architecture

### Data Flow
```
Polymarket API → Convex Actions → Database → Frontend Charts
```

### Key Components

1. **fetchPolymarketDirectMarkets** (`convex/predictions.ts`)
   - Runs every 30 minutes via cron
   - Gets all active Polymarket predictions from database
   - For each market:
     - Fetches current price
     - Updates probability in database
     - Attempts to fetch historical data

2. **fetchMarketHistory** (`convex/predictions.ts`)
   - Fetches 7 days of historical price data
   - Uses CLOB API with 30-minute intervals
   - Stores data via `storeMarketHistory` mutation

3. **storeMarketHistory** (`convex/predictions.ts`)
   - Finds prediction by market slug in sourceUrl
   - Checks for duplicate timestamps
   - Stores new historical points

## The Problem: Sparse Chart Data

Charts show gaps in historical data despite the API returning complete data.

### Symptoms
- Charts show only a few data points over 7 days
- Large gaps between June 13-17
- Database has 746-768 points but API returns 336 new points
- 282 points are missing from the database

## Root Causes Discovered

### 1. ✅ FIXED: Wrong Slug Format
**Issue**: We were using truncated slugs like `"will-iran-strike-israel-by-july-14"`
**Fix**: Use full slugs like `"khamenei-out-as-supreme-leader-of-iran-by-june-30"`
**Status**: Fixed and deployed

### 2. ✅ FIXED: Market Lookup Failure
**Issue**: `storeMarketHistory` was looking for clobTokenId in sourceUrl
```javascript
// Was looking for: "82262334590322112..." (clobTokenId)
// But sourceUrl contains: "netanyahu-out-in-2025" (slug)
```
**Fix**: Added `marketSlug` parameter to properly find predictions
**Status**: Fixed and deployed

### 3. ❓ CURRENT ISSUE: Data Still Not Storing
Despite fixes, historical data is not being fully stored:
- API returns 336 points
- Only ~22 new points stored after update
- 282 points remain missing

## Theories for Remaining Issue

### Theory 1: Duplicate Prevention Too Strict
The duplicate check uses exact timestamp matching:
```javascript
.filter(q => q.eq(q.field("timestamp"), point.t * 1000))
```
This might reject valid data if timestamps vary slightly.

### Theory 2: Silent Failures in Store Loop
The store loop catches and logs errors but continues:
```javascript
} catch (error) {
  // Skip if error (likely duplicate)
  console.log("Skipping history point:", error);
}
```
We don't know if points are being skipped due to real duplicates or other errors.

### Theory 3: Rate Limiting or Timeouts
Storing 336 points individually might hit Convex limits or timeouts.

### Theory 4: Timestamp Conversion Issues
We convert seconds to milliseconds (`point.t * 1000`), but if there are floating point issues or the API sometimes returns milliseconds, this could cause mismatches.

## What We've Tested

### Debug Results Show:
1. **API Works**: Returns 336 points correctly
2. **Parsing Works**: clobTokenIds parse correctly
3. **Action Runs**: fetchMarketHistory executes successfully
4. **But Storage Fails**: `stored: 0` despite success

### Test Functions Created:
1. `debugHistorical.ts` - Tests different fidelity values and API responses
2. `debugDataGaps.ts` - Analyzes gaps in stored data vs API data
3. `testHistoricalFetch.ts` - Tests each step of the fetch process
4. `testDuplicateLogic.ts` - Tests duplicate prevention logic

## Next Steps to Try

1. **Add Detailed Logging**: Log every point that's skipped and why
2. **Batch Storage**: Store all points in one mutation instead of loop
3. **Remove Duplicate Check**: Temporarily disable to see if all data stores
4. **Check Convex Logs**: Look for timeout or rate limit errors
5. **Test Single Point**: Manually store one historical point to isolate issue

## Manual Testing Commands

```bash
# Check what markets exist
pnpx convex run simple:getMarkets

# Run manual update
# Click "Manual Update" button in admin panel

# Debug specific market
pnpx convex run debugDataGaps:debugDataGaps '{"predictionId": "j97be9mkybbepjqv6mx1srzng97hs65h", "marketSlug": "netanyahu-out-in-2025"}'

# Test historical fetch
pnpx convex run testHistoricalFetch:testHistoricalFetchTheories '{"marketSlug": "netanyahu-out-in-2025"}'
```

## Current Status
- Current price updates: ✅ Working
- Historical data fetch: ✅ Working (API returns data)
- Historical data storage: ❌ Failing (data not stored in DB)
- Chart display: ❌ Sparse (due to missing historical data)