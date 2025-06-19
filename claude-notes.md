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
  },
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
- Use api._ references for cron jobs, not internal._

## Development Roadmap with Best Practices

### Phase 1: MVP Voting System (1-2 weeks) 🚀

**Goal**: Validate user interest in voting feature with minimal complexity

1. **Client-Side Vote Storage**

   ```typescript
   // Use Zustand/Valtio for state management
   interface VoteStore {
     votes: Map<predictionId, "up" | "down" | null>;
     toggleVote: (id: string, type: "up" | "down") => void;
   }
   ```

   - SessionStorage for persistence across tabs
   - Optimistic UI updates with debouncing
   - Generate unique sessionId on first visit

2. **Backend Vote Tracking**

   ```typescript
   // convex/predictions.ts - Add to existing schema
   upvotes: v.optional(v.number()),
   downvotes: v.optional(v.number()),
   lastVoteUpdate: v.optional(v.number()),
   ```

   - Simple increment/decrement mutations
   - Rate limiting: 1 vote per prediction per session
   - No user tracking initially

3. **UI Components**
   - Accessible vote buttons (ARIA labels, keyboard nav)
   - Vote count badge with formatting (1.2K)
   - Loading states during vote submission
   - Toast notifications for vote feedback

### Phase 2: Enhanced Voting System (2-3 weeks) 📊

**Goal**: Add persistence and analytics while maintaining simplicity

1. **Database Schema Evolution**

   ```typescript
   // convex/schema.ts - New votes table
   votes: defineTable({
     sessionId: v.string(),
     predictionId: v.id("predictions"),
     voteType: v.union(v.literal("up"), v.literal("down")),
     timestamp: v.number(),
     userId: v.optional(v.string()), // For future auth
   })
     .index("by_session", ["sessionId", "predictionId"])
     .index("by_prediction", ["predictionId"]);
   ```

2. **Smart Aggregation**

   - Batch vote updates every 30 seconds
   - Materialized vote counts on predictions
   - Trending algorithm: (votes / hours_since_creation)^gravity
   - Cache popular predictions in Redis/memory

### Phase 3: Core Features & Analytics (2-3 weeks) 🎯

**Goal**: Add essential missing features and analytics

1. **PostHog Analytics Integration (PRIORITY)**

   - Implement pageview tracking on route changes
   - Track key events:
     - Market card clicks (which market, position)
     - Vote interactions (up/down, which prediction)
     - Chart hover time
     - External link clicks
   - User session tracking
   - A/B test different layouts

2. **Essential UI Features**

   - **Data Freshness**:
     - "Last updated" prominently displayed
     - Manual refresh button
     - Stale data indicator (>1hr old)
   - **Mobile Improvements**:
     - Touch-friendly vote buttons

3. **Data Export**
   - Share prediction via URL with anchor

### Phase 4: Multi-Source Reliability (3-4 weeks) 🔧

**Goal**: Ensure reliable data from all sources

1. **Fix Existing Sources**

   - Debug and fix Metaculus integration
   - Fix Kalshi API issues
   - Ensure Manifold search works
   - Add Polymarket support
   - Remove/fix broken sources

2. **Source Management**

   ```typescript
   // Track source health
   sourceStatus: defineTable({
     source: v.string(),
     lastSuccess: v.number(),
     lastError: v.optional(v.string()),
     successRate: v.number(),
     avgResponseTime: v.number(),
   });
   ```

   - Display source status on admin panel
   - Auto-disable failing sources
   - Email alerts for source failures

3. **Data Quality**
   - Show confidence indicator per prediction
   - Flag stale or suspicious data
   - Historical accuracy tracking
   - Source comparison view (same event, different sources)

### Technical Best Practices Throughout 🛠️

1. **Testing Strategy**

   - Unit tests for vote logic (Vitest)
   - Integration tests for API endpoints
   - E2E tests for critical user flows (Playwright)
   - Load testing for vote endpoints

2. **Monitoring & Observability**

   - Sentry for error tracking
   - PostHog for user analytics
   - Custom dashboards for vote metrics
   - Performance budgets for page load

3. **Security Considerations**

   - CSRF protection for vote endpoints
   - Rate limiting per IP/session
   - Input validation and sanitization
   - Regular security audits

4. **Development Workflow**
   - Feature flags for gradual rollout
   - A/B testing framework
   - Automated PR previews
   - Continuous deployment pipeline

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
5. `docs: update roadmap with comprehensive voting system implementation plan`
6. `docs: add practical features roadmap based on current site analysis`
7. `docs: simplify dashboard and data source requirements`
8. `docs: refocus phase 3-4 on dashboards and data feed improvements`
9. `docs: add manual update instructions for live site data`
10. `fix: move 'use node' directive to top of action files for Convex compatibility`
11. `refactor: implement reliable update system with health monitoring and best practices`
12. `docs: document update system architecture and best practices`
13. `feat: add robust update system with manual trigger and deployment hook`

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

1. **Implement PostHog pageview tracking** - Add to route changes
2. **Start Phase 1 voting** - Session-based voting with localStorage
3. **Add basic filtering** - Probability ranges and categories
4. **Fix data source issues** - Debug Metaculus/Kalshi integration
5. ALWAYS follow architecture best practices above

### Additional Feature Ideas:

- Embed widget for other websites
- Email/SMS alerts for major probability swings
- Historical event resolution tracking
- Comparison view for similar predictions
- "Trending now" section based on vote velocity
- Dark/light theme toggle
- Keyboard navigation shortcuts
- PWA support for mobile install

## How to Manually Update Live Site Data

To update the prediction market data on the live site, you can run these Convex functions from the Convex dashboard:

### Quick Update (Just Polymarket featured markets):

1. Go to Convex dashboard → Functions
2. Run `predictions:fetchPolymarketDirectMarkets`
   - Updates the 8 featured Iran-related markets
   - This is what the cron job runs every 30 minutes

### Full Update (All sources):

1. Run `predictions:fetchAllPredictions`
   - Fetches from: Manifold, Metaculus, Kalshi, Polymarket, Adjacent News
   - Returns summary of fetched/saved from each source
   - Note: Some sources may fail (Metaculus/Kalshi have issues)

### Update Historical Data:

1. Run `predictions:fetchAllMarketHistory`
   - Fetches 7 days of historical data for all Polymarket markets
   - This runs weekly via cron

### Update Single Market:

1. Run `predictions:updateMarketProbability`
   - Pass `sourceUrl` parameter (e.g., "https://polymarket.com/event/...")
   - Updates just that specific market

### Via CLI:

```bash
npx convex run predictions:fetchPolymarketDirectMarkets
```

## Rethinking the Update Architecture

### Three Key Considerations:

1. **Reliability & Fault Tolerance**

   - Current issue: Single cron job fails silently if API is down
   - Need: Error recovery, fallback mechanisms, health monitoring
   - Question: How do we know when updates fail and recover gracefully?

2. **Update Frequency & Freshness**

   - Current: Fixed 30-minute intervals regardless of market activity
   - Need: Dynamic updates based on volatility, user interest, time to resolution
   - Question: Should high-activity markets update more frequently?

3. **Source Management & Priority**
   - Current: Try all sources equally, some consistently fail
   - Need: Prioritize reliable sources, track source health, fallback chains
   - Question: How do we handle multiple sources for the same event?

### Three Architectural Options:

#### Option 1: Event-Driven Pull System

```typescript
// Triggered by user views, votes, or external webhooks
interface UpdateTrigger {
  type: "user_view" | "vote_threshold" | "webhook" | "scheduled";
  priority: "high" | "normal" | "low";
  markets?: string[]; // Specific markets to update
}
```

- **Pros**: Updates when needed, reduces API calls, responsive to user interest
- **Cons**: Complex to implement, potential stampeding herd problem
- **Implementation**: Queue system, rate limiting, coalescing requests

#### Option 2: Tiered Update Strategy

```typescript
// Different update frequencies based on market characteristics
interface UpdateTier {
  tier: "hot" | "active" | "stable" | "stale";
  frequency: number; // minutes
  criteria: {
    votesPerHour?: number;
    volatility?: number;
    daysToResolve?: number;
    lastChangePercent?: number;
  };
}
```

- **Pros**: Efficient resource usage, focuses on important markets
- **Cons**: Complex tier assignment logic, needs monitoring
- **Implementation**: Background job to assign tiers, multiple cron schedules

#### Option 3: Resilient Pipeline with Health Tracking

```typescript
// Self-healing system with source health monitoring
interface UpdatePipeline {
  stages: ["fetch", "validate", "transform", "store", "verify"];
  retryPolicy: { attempts: number; backoff: "linear" | "exponential" };
  healthCheck: {
    source: string;
    successRate: number;
    avgResponseTime: number;
    lastError?: string;
    status: "healthy" | "degraded" | "failed";
  };
}
```

- **Pros**: Self-healing, transparent monitoring, graceful degradation
- **Cons**: More infrastructure, needs observability tools
- **Implementation**: State machine, health dashboard, alert system

### Recommended Approach: Hybrid Solution

Combine elements from all three:

1. **Base layer**: Resilient pipeline (Option 3) for reliability
2. **Optimization**: Tiered updates (Option 2) for efficiency
3. **Enhancement**: Event triggers (Option 1) for responsiveness

## Implemented Update System

### Architecture Decisions:

1. **Separated concerns**: Mutations in separate files from actions
2. **Health tracking**: `sourceStatus` table tracks reliability
3. **Smart retries**: Exponential backoff for failed sources
4. **Update logging**: Track all significant changes
5. **Simple cron**: One reliable function that handles errors gracefully

### Key Files:

- `convex/simpleUpdater.ts` - Main update orchestrator
- `convex/updateSystem.ts` - Health tracking and monitoring
- `convex/historyMutations.ts` - Database mutations
- `convex/schema.ts` - Added sourceStatus and updateLog tables

### How to Update Data:

1. **Manual**: Run `simpleUpdater:updatePredictions` in Convex dashboard
2. **Automatic**: Cron runs every 30 minutes
3. **Monitor**: Run `simpleUpdater:getUpdateDashboard` to see health

### Best Practices Applied:

- ✅ Single responsibility per file
- ✅ Proper error handling with recovery
- ✅ Observable system with health metrics
- ✅ Graceful degradation when sources fail
- ✅ No circular dependencies
- ✅ Clear separation of actions/mutations/queries

---

## Current Feature: Update System Implementation

### Status: In Progress - Fixing Polymarket Integration

Working on implementing a robust update system for the Iran geopolitical dashboard.

### Commits Made This Session:

1. Initial commit - setting up update system architecture
2. feat: implement simple cron job with health monitoring for Phase 1
3. feat: add admin UI for manual updates and status tracking
4. feat: complete Phase 1 update system with health monitoring and manual triggers
5. fix: update Polymarket slugs to match correct format from live site
6. fix: add marketSlug parameter to storeMarketHistory for proper prediction lookup
7. feat: implement new update architecture with 30-day historical fetches and 1-minute price polling

### Progress:

- ✅ Created simple cron job that runs every 30 minutes
- ✅ Added health monitoring and status tracking
- ✅ Stored update results in database
- ✅ Added admin UI showing update status
- ✅ Added manual update button in admin panel
- ✅ Created deployment hook for automatic updates
- ✅ Successfully deployed to Convex
- ✅ Fixed Polymarket API integration (discovered issue from H5N1 dashboard analysis)
- ✅ Debugged and fixed market slug format issues
- ✅ Fixed storeMarketHistory to properly find predictions by slug
- ✅ Implemented new update architecture:
  - 30-day historical data fetch every 15 minutes
  - Current price polling every minute
  - Failure protection (don't delete old data if update fails)

### New Update Architecture:

1. **Historical Updates (15 min)**: 
   - Fetches 30 days of data for all markets
   - Replaces old data only if successful
   - Tracks update status in admin panel

2. **Price Polling (1 min)**:
   - Quick current price check
   - Updates only if price changed
   - Minimal API load

3. **Admin Panel Features**:
   - Shows last historical update status
   - Manual update buttons for testing
   - Error tracking and reporting
   - Initial data load button for setup

### Deployment Issues Encountered:

1. **"use node" directive placement**: Must be at the very top of action files
2. **Internal mutations in action files**: Convex doesn't allow mutations in Node.js action files - must separate into dedicated mutation files
3. **Circular type inference**: Avoid self-referential queries, use explicit typing
4. **Missing dependencies**: Always check and add required packages (e.g., date-fns)
5. **Unterminated JSX**: Double-check closing tags in React components
6. **Convex deployment**: Use `pnpx convex deploy` and ensure all TypeScript errors are resolved first

### Task List:

1. ✅ Fix Polymarket API integration to match H5N1 dashboard approach
2. ✅ Test Polymarket data fetching with corrected implementation
3. ✅ Debug why historical data has gaps - test theories
4. Implement PostHog analytics (HIGH PRIORITY)
5. Phase 2: Session-based voting system
6. Phase 3: Dashboard organization system
7. Phase 4: Multi-source integration (Metaculus, Kalshi, Manifold)

### Important Context:

- User wants simple implementation, no complex reliability features
- Removed clone/share dashboards and templates functionality
- No user management features needed
- Focus on getting data feeds working properly
- PostHog analytics is a priority
- User wants to test deployment before continuing with other features

### Technical Decisions:

- Using Convex actions for Node.js API calls
- Separated internal mutations into statusMutations.ts (Convex requirement)
- Tracking 24-hour update history
- Using deployment hook to trigger updates after deploy
- Following H5N1 dashboard's approach for Polymarket integration
