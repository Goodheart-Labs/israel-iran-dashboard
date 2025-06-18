# Claude Code Session Notes

## Architecture Best Practices (CRITICAL - ALWAYS FOLLOW)

### 1. Module Organization Rules
- **Single-purpose files**: Each Convex file should do ONE thing only
- **Clear hierarchy**: actions → mutations → queries (never reverse)
- **No circular dependencies**: Files must NEVER import from each other
- **Schema isolation**: Shared types ONLY in schema.ts

### 2. Implementation Patterns

#### ✅ GOOD Patterns:
```typescript
// Self-contained query (like simple.ts)
export const getMarkets = query({
  handler: async (ctx) => {
    // Direct DB access only
    // All logic in one place
    // No imports from other queries
  }
});

// Clear action → mutation flow
// actions/updatePrices.ts → mutations/storePrices.ts
```

#### ❌ AVOID Anti-Patterns:
- Complex import chains (A → B → C → D)
- Queries importing from other queries
- Mixed concerns in single function
- Helper/utils files that create dependencies
- Circular imports between modules

### 3. New Feature Guidelines
- Start with simple, self-contained implementation
- Isolate each API source in its own action file
- Keep database queries simple, do joins in memory
- Use api.* references for cron jobs, not internal.*

## Updated Roadmap (Priority Order)

### Phase 1: Improve Data Structure 🗄️
1. **Add Votes Table**
   - New table: `votes` with userId, predictionId, voteType, timestamp
   - Self-contained mutations: `castVote.ts`, `removeVote.ts`
   - Query: `getVotesForPrediction.ts` (no dependencies)

2. **Add Dashboards Feature**
   - New table: `dashboards` for custom user dashboards
   - Schema: dashboardId, userId, name, marketIds[], layout
   - Isolated CRUD operations in separate files

3. **Enhance Predictions Schema**
   - Add fields: voteCount, sentiment, lastVoteTime
   - Migration strategy: optional fields first, then populate

### Phase 2: Multi-Source Integration 🔌
1. **Fix Existing Sources**
   - Debug Metaculus API integration
   - Fix Kalshi market data fetching
   - Ensure Manifold search works properly

2. **Add New Sources**
   - Each in isolated action file:
     - `convex/sources/predictit.ts`
     - `convex/sources/augur.ts`
     - `convex/sources/insight.ts`

3. **Source Aggregation**
   - Single query: `getAggregatedMarkets.ts`
   - Combines all sources in memory
   - No complex dependencies

### Phase 3: Frontend Reimplementation 🎨
1. **New Card Types**
   - VoteCard: Shows community sentiment
   - ComparisonCard: Multiple sources for same event
   - TrendCard: Momentum indicators
   - DashboardCard: User-curated collections

2. **Enhanced Market Display**
   - Show votes alongside probability
   - Source comparison view
   - Trend indicators (up/down/stable)
   - Community comments preview

3. **Dashboard Builder**
   - Drag-and-drop interface
   - Save custom layouts
   - Share dashboard URLs
   - Export dashboard data

## Current Session Progress

### Completed Today:
- ✅ Production deployment successful
- ✅ Fixed TypeScript build errors  
- ✅ Implemented 30-minute cron job
- ✅ Resolved Convex deployment issues

### Session Commits:
1. `fix: reduce cron frequency to 30 minutes for production stability`
2. `fix: TypeScript build errors and API references`
3. `fix: add --prod flag to Convex deploy command for non-interactive deployment`
4. `fix: use -y flag instead of --prod for Convex deploy`

### Production Status:
- Live on Vercel with Convex backend
- 30-minute market updates running
- Historical charts displaying
- Admin panel functional

## Important Context

### Technical Decisions:
- Using `simple.ts` pattern to avoid circular dependencies
- 30-minute cron frequency for API stability
- 50 historical data points per chart
- Admin approval required for new markets

### Environment Variables:
- `CONVEX_DEPLOYMENT`: Set in Vercel
- `ADJACENT_NEWS_API_KEY`: Required for Adjacent News
- `VITE_CONVEX_URL`: Auto-set by Convex deploy

### Next Session Priorities:
1. Start Phase 1: Add votes table and mutations
2. Create dashboard schema
3. Keep all new features in isolated modules
4. ALWAYS follow architecture best practices above