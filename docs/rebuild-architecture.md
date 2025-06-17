# Solid Architecture for Rebuilding Features

## Core Principles to Avoid Previous Errors

### 1. **No Circular Dependencies**
- Each module has a single responsibility
- Clear dependency hierarchy: `types → db → api → ui`
- No module imports from a module that imports from it
- Use dynamic imports only when absolutely necessary

### 2. **Simple Module Structure**
```
convex/
├── schema.ts          # Database schema only
├── types.ts           # Shared types (no imports)
├── db/               # Database queries (import types only)
│   ├── markets.ts    # Market CRUD operations
│   ├── dashboards.ts # Dashboard CRUD operations
│   └── votes.ts      # Voting operations
├── api/              # External API calls (import db/* only)
│   ├── polymarket.ts
│   ├── kalshi.ts
│   ├── metaculus.ts
│   └── manifold.ts
└── actions/          # Orchestration (import api/* and db/*)
    ├── sync.ts       # Sync all markets
    └── export.ts     # Export functionality
```

### 3. **Database Schema Changes**
```typescript
// schema.ts additions
export default defineSchema({
  // Existing tables...
  
  votes: defineTable({
    marketId: v.id("predictions"),
    sessionId: v.string(), // Anonymous user identifier
    voteType: v.union(v.literal("up"), v.literal("down")),
    timestamp: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_session_market", ["sessionId", "marketId"]),
    
  suggestions: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    sessionId: v.string(),
    upvotes: v.number(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_upvotes", ["upvotes"]),
});
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. **Restructure Convex modules**
   - Create types.ts with all shared types
   - Move all database queries to db/* files
   - No cross-imports between modules

2. **Add voting system**
   - Anonymous session tracking (localStorage UUID)
   - Vote storage and counting
   - Rate limiting by session

3. **Add suggestions system**
   - Submit new market suggestions
   - Upvote suggestions
   - Admin approval workflow

### Phase 2: Market Sources (Week 1-2)
1. **Kalshi Integration**
   ```typescript
   // convex/api/kalshi.ts
   export async function fetchKalshiMarkets() {
     // Direct API calls, no imports from other modules
     const response = await fetch("https://api.kalshi.com/v1/markets");
     // Transform to our Market type
     return markets;
   }
   ```

2. **Metaculus Integration**
   ```typescript
   // convex/api/metaculus.ts
   export async function fetchMetaculusQuestions() {
     // Similar pattern
   }
   ```

3. **Manifold Integration**
   ```typescript
   // convex/api/manifold.ts
   export async function fetchManifoldMarkets() {
     // Similar pattern
   }
   ```

### Phase 3: UI Features (Week 2)
1. **Historical Charts**
   - Simple component that takes data array
   - No complex data fetching in component
   - Data passed down from parent

2. **Dashboard Management**
   - Simple CRUD UI
   - Each operation is independent
   - No complex state management

3. **Market Reordering**
   - Drag and drop or simple arrows
   - Batch updates to avoid conflicts

## Avoiding Previous Pitfalls

### 1. **API Imports**
```typescript
// BAD - causes circular dependencies
import { api } from "../_generated/api";
await ctx.runAction(api.predictions.sync);

// GOOD - direct function calls
import { syncMarkets } from "./sync";
await syncMarkets(ctx);
```

### 2. **Type Definitions**
```typescript
// types.ts - NO IMPORTS
export type Market = {
  id: string;
  title: string;
  probability: number;
  source: MarketSource;
};

export type MarketSource = "polymarket" | "kalshi" | "metaculus" | "manifold";
```

### 3. **Component Structure**
```typescript
// BAD - component does too much
function MarketCard() {
  const data = useQuery(api.markets.getWithHistory);
  const vote = useMutation(api.votes.cast);
  // Complex logic...
}

// GOOD - simple, focused components
function MarketCard({ market, onVote }) {
  // Just display logic
}

function MarketContainer() {
  const markets = useQuery(api.simple.getMarkets);
  const handleVote = useMutation(api.votes.cast);
  return <MarketCard market={market} onVote={handleVote} />;
}
```

## New Features Implementation

### 1. **Anonymous Voting**
```typescript
// Frontend session management
const getSessionId = () => {
  let sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

// Vote tracking
const voteOnMarket = useMutation(api.votes.cast);
await voteOnMarket({ 
  marketId, 
  sessionId: getSessionId(), 
  voteType: 'up' 
});
```

### 2. **Market Suggestions**
```typescript
// Simple suggestion form
function SuggestMarket() {
  const suggest = useMutation(api.suggestions.create);
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      suggest({
        title: e.target.title.value,
        sessionId: getSessionId()
      });
    }}>
      <input name="title" placeholder="Suggest a prediction market" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### 3. **Multi-Source Dashboard**
```typescript
// Unified market display
const markets = useQuery(api.markets.getAllSources);
// Returns markets from all sources with unified schema

markets.map(market => (
  <MarketCard
    key={market.id}
    market={market}
    source={market.source} // "kalshi", "metaculus", etc.
  />
));
```

## Analytics Integration (PostHog)

### 1. **Event Tracking Structure**
```typescript
// utils/analytics.ts - Centralized analytics
export const trackEvent = (eventName: string, properties?: any) => {
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(eventName, properties);
  }
};

// Event naming convention
export const EVENTS = {
  // Page views
  PAGE_VIEW: 'page_view',
  
  // Market interactions
  MARKET_VOTE: 'market_vote',
  MARKET_CLICK: 'market_click',
  MARKET_VIEW_SOURCE: 'market_view_source',
  
  // Suggestions
  SUGGESTION_CREATE: 'suggestion_create',
  SUGGESTION_UPVOTE: 'suggestion_upvote',
  
  // Admin actions
  ADMIN_LOGIN: 'admin_login',
  ADMIN_EDIT_MARKET: 'admin_edit_market',
  ADMIN_APPROVE_SUGGESTION: 'admin_approve_suggestion',
} as const;
```

### 2. **Implementation Examples**
```typescript
// In components
import { trackEvent, EVENTS } from '@/utils/analytics';

// Track votes
const handleVote = async (voteType: 'up' | 'down') => {
  await voteOnMarket({ marketId, voteType });
  trackEvent(EVENTS.MARKET_VOTE, {
    market_id: marketId,
    market_title: market.title,
    vote_type: voteType,
    source: market.source,
    probability: market.probability,
  });
};

// Track page views with context
useEffect(() => {
  trackEvent(EVENTS.PAGE_VIEW, {
    page: 'home',
    market_count: markets.length,
    has_user: !!userId,
  });
}, [markets.length, userId]);
```

### 3. **User Identification**
```typescript
// Anonymous users - use session ID
const sessionId = getSessionId();
if (window.posthog && !userId) {
  window.posthog.identify(sessionId);
}

// Logged in users - use Clerk ID
useEffect(() => {
  if (userId && window.posthog) {
    window.posthog.identify(userId, {
      email: user?.email,
      is_admin: isAdmin,
    });
  }
}, [userId, user, isAdmin]);
```

### 4. **Feature Flags via PostHog**
```typescript
// Use PostHog feature flags for gradual rollout
const useFeatureFlag = (flagName: string) => {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    if (window.posthog) {
      const value = window.posthog.isFeatureEnabled(flagName);
      setEnabled(!!value);
    }
  }, [flagName]);
  
  return enabled;
};

// Usage
function HomePage() {
  const showNewVoting = useFeatureFlag('new_voting_system');
  const showSuggestions = useFeatureFlag('market_suggestions');
  
  return (
    <>
      {showNewVoting && <VotingUI />}
      {showSuggestions && <SuggestMarket />}
    </>
  );
}
```

### 5. **Analytics Dashboard Setup**
- Track conversion funnel: Visit → Vote → Suggest → Return
- Monitor API performance by source
- Track most/least popular markets
- Identify voting patterns
- Admin action audit trail

## Testing Strategy

1. **Module Independence**
   - Each module can be tested in isolation
   - No complex mocking required
   - Clear input/output contracts

2. **Integration Tests**
   - Test each API integration separately
   - Mock external APIs for reliability
   - Test error handling

3. **UI Tests**
   - Simple component tests
   - No complex state management to test
   - Visual regression tests

## Deployment Strategy

1. **Incremental Rollout**
   - Deploy base infrastructure first
   - Add one market source at a time
   - Enable features via feature flags

2. **Monitoring**
   - Track API failures by source
   - Monitor vote rates for abuse
   - Track suggestion quality

3. **Rollback Plan**
   - Each feature can be disabled independently
   - Database migrations are additive only
   - No breaking changes to existing functionality