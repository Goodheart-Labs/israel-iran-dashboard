# H5N1 Bird Flu Risk Dashboard - How It Works

## Overview
The H5N1 dashboard (https://h5n1risk.com) tracks bird flu pandemic risk using prediction markets and health data. It's built with Next.js and displays a unified risk assessment.

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **Data Fetching**: API routes that proxy to external services
- **Charts**: Custom React components with D3/Recharts
- **Deployment**: Vercel

### No Database
Unlike our Iran dashboard, H5N1 has **no database**:
- All data is fetched fresh from APIs
- No historical data storage
- No Convex or other backend
- Simple and stateless

## Data Sources

### 1. Polymarket
- **Market**: "Another state declare emergency over bird flu before February"
- **Slug**: `another-state-declare-a-state-of-emergency-over-bird-flu-before-february`
- **What it tracks**: Probability of bird flu emergency declarations

### 2. Metaculus
- **Question ID**: 30960
- **What it tracks**: Community predictions about H5N1 pandemic risk

### 3. Manifold Markets
- **Slug**: `will-there-be-more-than-1000-confir`
- **What it tracks**: Confirmed H5N1 cases predictions

### 4. Kalshi
- **Market**: Bird flu related prediction markets
- **Authentication**: Uses email/password stored in environment variables

### 5. CDC Data
- **Source**: USDA H5N1 detections data
- **What it tracks**: Actual confirmed bird flu cases in animals/humans

## How Polymarket Integration Works

### 1. Two-Step API Process
```javascript
// Step 1: Get event data using slug
const eventResponse = await fetch(`${GAMMA_API}/events?slug=${slug}`);
const event = eventResponse.json();
const marketId = event.markets[0].id;

// Step 2: Get detailed market data
const marketResponse = await fetch(`${GAMMA_API}/markets/${marketId}`);
const marketData = await marketResponse.json();
```

### 2. Historical Data Fetching
```javascript
// Extract clobTokenId from market data
const clobTokenId = JSON.parse(marketData.clobTokenIds)[0];

// Fetch price history using CLOB API
const historyUrl = `https://clob.polymarket.com/prices-history?market=${clobTokenId}&fidelity=60`;
```

### 3. Key Differences from Our Implementation
- **Clean slugs**: No UUID suffixes in their slugs
- **clobTokenIds**: They properly use these for historical data
- **No storage**: Data is fetched on each page load
- **API routes**: All external calls go through Next.js API routes

## Data Flow

```
User visits site
    ↓
Next.js page component
    ↓
Fetch from API routes (/api/polymarket, /api/metaculus, etc.)
    ↓
API routes fetch from external services
    ↓
Transform data to common format
    ↓
Display in charts and risk meter
```

## Risk Calculation

### Combines Multiple Sources
```javascript
// Simplified logic
const polymarketRisk = polymarketData.probability * 100;
const metaculusRisk = metaculusData.probability * 100;
const manifoldRisk = manifoldData.probability * 100;

// Weighted average or other algorithm
const overallRisk = calculateWeightedAverage([
  polymarketRisk,
  metaculusRisk,
  manifoldRisk
]);
```

## Key Files

### API Routes
- `/src/app/api/polymarket/route.ts` - Fetches Polymarket data
- `/src/app/api/polymarket-timeseries/route.ts` - Fetches historical prices
- `/src/app/api/metaculus/route.ts` - Fetches Metaculus predictions
- `/src/app/api/kalshi/route.ts` - Fetches Kalshi markets
- `/src/app/api/cdc-data/route.ts` - Fetches CDC case data

### Services
- `/src/lib/services/polymarket.ts` - Polymarket data fetching logic
- `/src/lib/services/metaculus.ts` - Metaculus integration
- `/src/lib/services/kalshi.ts` - Kalshi integration

### Configuration
- `/src/lib/config.ts` - Market slugs and IDs
- Uses environment variables for API keys

## Lessons for Our Dashboard

### 1. Polymarket Slug Format
They use complete slugs without modifications:
```javascript
POLYMARKET: {
  SLUG: "another-state-declare-a-state-of-emergency-over-bird-flu-before-february",
}
```

### 2. Historical Data Approach
- They fetch it fresh each time (no storage)
- Use `fidelity: "60"` for hourly data
- Parse clobTokenIds correctly

### 3. Simple Architecture
- No database complexity
- Stateless design
- All data fetching in API routes

### 4. Error Handling
- Fallback to example data if API fails
- Graceful degradation
- Clear error messages

## Why Their Charts Work

1. **Fresh data**: Always fetch latest from API
2. **No duplicate issues**: No storage = no duplicate prevention needed
3. **Simple flow**: API → Transform → Display
4. **Correct parameters**: Right slugs, right token IDs

## Trade-offs

### Pros of H5N1 Approach
- Simple and maintainable
- No database issues
- Always shows latest data
- Easier to debug

### Cons of H5N1 Approach
- Slower page loads (fetches every time)
- No historical tracking beyond API limits
- Can't work offline
- More API calls = potential rate limits

## Key Takeaway
The H5N1 dashboard works because it keeps things simple. By avoiding data storage and fetching fresh each time, they sidestep all the complexity we're facing with duplicate prevention and data synchronization.