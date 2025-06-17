# Detailed Implementation Plan: Iran Geopolitical Risk Dashboard v2

## Executive Summary

This plan outlines the complete rebuild of the Iran Geopolitical Risk Dashboard with enhanced features including multi-source market integration (Kalshi, Metaculus, Manifold), anonymous voting, market suggestions, and comprehensive analytics. The rebuild prioritizes architectural simplicity to avoid the circular dependency issues that plagued the previous version.

## Project Goals

### Primary Objectives
1. **Multi-Source Integration**: Aggregate prediction markets from Polymarket, Kalshi, Metaculus, and Manifold
2. **Community Engagement**: Enable anonymous voting and market suggestions
3. **Data Persistence**: Store and display historical market data
4. **Analytics**: Comprehensive tracking via PostHog
5. **Admin Control**: Robust admin panel for market and suggestion management

### Technical Objectives
1. **Zero Circular Dependencies**: Strict module hierarchy
2. **Type Safety**: Full TypeScript coverage
3. **Performance**: Sub-2s page loads with all data sources
4. **Reliability**: Graceful degradation when APIs fail
5. **Scalability**: Support 1000+ markets without performance impact

## Architecture Overview

### Module Hierarchy
```
Layer 1: Types (No imports)
  └── convex/types.ts

Layer 2: Database (Imports: types only)
  ├── convex/db/markets.ts
  ├── convex/db/dashboards.ts
  ├── convex/db/votes.ts
  └── convex/db/suggestions.ts

Layer 3: External APIs (Imports: types, db/*)
  ├── convex/api/polymarket.ts
  ├── convex/api/kalshi.ts
  ├── convex/api/metaculus.ts
  └── convex/api/manifold.ts

Layer 4: Actions (Imports: types, db/*, api/*)
  ├── convex/actions/sync.ts
  ├── convex/actions/vote.ts
  └── convex/actions/suggest.ts

Layer 5: UI Components (Imports: all)
  └── src/components/*
```

### Data Flow
```
External APIs → Sync Actions → Database → Queries → UI Components
                                  ↑
                                  └── User Actions (votes, suggestions)
```

## Phase 1: Foundation (Days 1-5)

### Day 1: Type System Setup
**Goal**: Create a robust type system that prevents circular dependencies

**Tasks**:
1. Create `convex/types.ts` with zero imports
2. Define core types:
   ```typescript
   export type MarketSource = "polymarket" | "kalshi" | "metaculus" | "manifold";
   
   export type Market = {
     id: string;
     externalId: string;
     title: string;
     description?: string;
     probability: number;
     previousProbability?: number;
     source: MarketSource;
     sourceUrl: string;
     category: string;
     lastUpdated: number;
     volume?: number;
     liquidity?: number;
     closeDate?: number;
   };
   
   export type Vote = {
     marketId: string;
     sessionId: string;
     voteType: "up" | "down";
     timestamp: number;
   };
   
   export type Suggestion = {
     id: string;
     title: string;
     description?: string;
     sessionId: string;
     upvotes: number;
     status: "pending" | "approved" | "rejected";
     category: string;
     createdAt: number;
   };
   ```

3. Define transformation types for each API source
4. Create validation schemas using zod

**Deliverables**:
- Complete type definitions
- No import statements in file
- Full JSDoc documentation

### Day 2: Database Layer
**Goal**: Implement all database operations with clean interfaces

**Tasks**:
1. Update `convex/schema.ts`:
   ```typescript
   export default defineSchema({
     predictions: defineTable({
       externalId: v.string(),
       title: v.string(),
       description: v.optional(v.string()),
       probability: v.number(),
       previousProbability: v.optional(v.number()),
       source: v.string(),
       sourceUrl: v.string(),
       category: v.string(),
       lastUpdated: v.number(),
       volume: v.optional(v.number()),
       liquidity: v.optional(v.number()),
       closeDate: v.optional(v.number()),
       isActive: v.boolean(),
     })
       .index("by_source", ["source"])
       .index("by_external", ["source", "externalId"])
       .index("by_category", ["category", "isActive"]),
     
     votes: defineTable({
       marketId: v.id("predictions"),
       sessionId: v.string(),
       voteType: v.string(),
       timestamp: v.number(),
     })
       .index("by_market", ["marketId"])
       .index("by_session_market", ["sessionId", "marketId"]),
     
     suggestions: defineTable({
       title: v.string(),
       description: v.optional(v.string()),
       sessionId: v.string(),
       upvotes: v.number(),
       status: v.string(),
       category: v.string(),
       createdAt: v.number(),
     })
       .index("by_status", ["status"])
       .index("by_upvotes", ["upvotes"]),
   });
   ```

2. Create database modules:
   - `convex/db/markets.ts`: CRUD operations for markets
   - `convex/db/votes.ts`: Vote tracking and aggregation
   - `convex/db/suggestions.ts`: Suggestion management

**Deliverables**:
- Complete database schema
- All CRUD operations implemented
- Proper indexes for performance

### Day 3: Session Management & Voting
**Goal**: Implement anonymous voting system

**Frontend Tasks**:
1. Create `src/utils/session.ts`:
   ```typescript
   export const getSessionId = (): string => {
     const SESSION_KEY = 'iran_dashboard_session';
     let sessionId = localStorage.getItem(SESSION_KEY);
     
     if (!sessionId) {
       sessionId = crypto.randomUUID();
       localStorage.setItem(SESSION_KEY, sessionId);
       
       // Track new session
       trackEvent('session_created', { session_id: sessionId });
     }
     
     return sessionId;
   };
   ```

2. Create voting components:
   - `VoteButtons.tsx`: Up/down vote UI
   - `VoteCount.tsx`: Display vote totals
   - Optimistic updates for instant feedback

**Backend Tasks**:
1. Implement vote mutations:
   - Rate limiting (max 1 vote per market per session)
   - Vote changing (up to down, etc.)
   - Vote aggregation queries

**Deliverables**:
- Working voting system
- Session persistence
- Rate limiting implemented

### Day 4: Suggestion System
**Goal**: Allow users to suggest new markets with community upvoting

**Tasks**:
1. Create suggestion form component
2. Implement suggestion list with filtering
3. Add upvoting to suggestions
4. Build admin approval interface
5. Auto-convert approved suggestions to tracked markets

**Deliverables**:
- Complete suggestion workflow
- Admin moderation tools
- Analytics on suggestion quality

### Day 5: Market Addition by URL & Dashboard System
**Goal**: Enable adding markets via URL and implement multiple dashboard support

**Market Addition by URL**:
1. Create URL parser that detects market source:
   ```typescript
   // convex/actions/addMarketByUrl.ts
   export async function addMarketByUrl(url: string) {
     // Detect source from URL
     if (url.includes('polymarket.com')) {
       const slug = extractPolymarketSlug(url);
       return await fetchPolymarketMarket(slug);
     } else if (url.includes('kalshi.com')) {
       const id = extractKalshiId(url);
       return await fetchKalshiMarket(id);
     } else if (url.includes('metaculus.com')) {
       const id = extractMetaculusId(url);
       return await fetchMetaculusQuestion(id);
     } else if (url.includes('manifold.markets')) {
       const slug = extractManifoldSlug(url);
       return await fetchManifoldMarket(slug);
     }
     throw new Error('Unsupported market URL');
   }
   ```

2. Admin UI for adding markets:
   - Paste URL input
   - Preview market details before adding
   - Select which dashboard(s) to add to
   - Set custom clarification text

**Multiple Dashboard System Design**:

```typescript
// Enhanced dashboard type
export type Dashboard = {
  id: string;
  name: string;
  slug: string; // URL-friendly name
  description?: string;
  icon?: string; // emoji or icon name
  order: number;
  isPublic: boolean;
  isActive: boolean;
  createdBy: string; // admin who created it
  marketCategories?: string[]; // auto-include markets with these categories
  pinnedMarkets?: string[]; // always show these markets first
  theme?: {
    primaryColor?: string;
    accentColor?: string;
  };
};

// Dashboard-market relationship
export type DashboardMarket = {
  dashboardId: string;
  marketId: string;
  order: number;
  isPinned: boolean;
  clarificationOverride?: string; // dashboard-specific clarification
  hideFromDashboard: boolean; // soft remove without deleting
};
```

**Dashboard Examples**:
1. **Iran Nuclear** - Nuclear deal, sanctions, enrichment
2. **Iran Military** - Conflicts, military actions, defense
3. **Iran Economy** - Oil prices, currency, trade
4. **Regional Stability** - Relations with neighbors
5. **Global Powers** - US, Russia, China relations

**Dashboard Features**:
- Auto-assignment by category/keywords
- Manual market assignment
- Per-dashboard clarification text
- Custom ordering within each dashboard
- Public/private visibility
- Dashboard-specific themes

**Navigation UI**:
```typescript
// Tab-based navigation
<DashboardTabs>
  <Tab icon="🌍" href="/">All Markets</Tab>
  <Tab icon="☢️" href="/nuclear">Nuclear</Tab>
  <Tab icon="⚔️" href="/military">Military</Tab>
  <Tab icon="💰" href="/economy">Economy</Tab>
  <Tab icon="🤝" href="/regional">Regional</Tab>
</DashboardTabs>
```

**Deliverables**:
- URL-based market addition
- Multiple dashboard support
- Dashboard management UI
- Auto-categorization system

## Phase 2: External API Integration (Days 6-10)

### Day 6-7: Kalshi Integration
**Goal**: Integrate Kalshi prediction markets

**Research Tasks**:
1. Study Kalshi API documentation
2. Identify Iran-related markets
3. Map Kalshi data to our schema

**Implementation**:
```typescript
// convex/api/kalshi.ts
const KALSHI_MARKETS = [
  "IRAN-NUCLEAR-DEAL-2025",
  "IRAN-ISRAEL-CONFLICT-2025",
  "IRAN-SANCTIONS-LIFTED-2025"
];

export async function fetchKalshiMarkets(): Promise<Market[]> {
  const markets = [];
  
  for (const marketId of KALSHI_MARKETS) {
    try {
      const response = await fetch(`https://api.kalshi.com/v1/markets/${marketId}`);
      const data = await response.json();
      
      markets.push({
        id: `kalshi_${data.id}`,
        externalId: data.id,
        title: data.title,
        probability: data.last_price * 100,
        source: "kalshi",
        sourceUrl: `https://kalshi.com/markets/${data.ticker}`,
        category: "geopolitical",
        lastUpdated: Date.now(),
        volume: data.volume,
        liquidity: data.open_interest,
      });
    } catch (error) {
      console.error(`Failed to fetch Kalshi market ${marketId}:`, error);
    }
  }
  
  return markets;
}
```

**Deliverables**:
- Working Kalshi integration
- Error handling and retries
- Proper data transformation

### Day 8-9: Metaculus Integration
**Goal**: Integrate Metaculus forecasting questions

**Implementation Challenges**:
- Metaculus uses community predictions, not markets
- Need to aggregate multiple forecasts
- Different time resolution than markets

**Tasks**:
1. Implement Metaculus API client
2. Search for Iran-related questions
3. Calculate aggregate probability
4. Handle question resolution

**Deliverables**:
- Metaculus questions displayed
- Proper probability calculation
- Update scheduling

### Day 10: Manifold Integration
**Goal**: Add Manifold Markets integration

**Implementation**:
```typescript
// convex/api/manifold.ts
export async function searchManifoldMarkets(query: string): Promise<Market[]> {
  const response = await fetch(
    `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(query)}&limit=20`
  );
  
  const markets = await response.json();
  
  return markets
    .filter(m => m.probability !== undefined)
    .map(m => ({
      id: `manifold_${m.id}`,
      externalId: m.id,
      title: m.question,
      probability: m.probability * 100,
      source: "manifold",
      sourceUrl: m.url,
      category: "geopolitical",
      lastUpdated: new Date(m.lastUpdatedTime).getTime(),
      volume: m.volume,
    }));
}
```

**Deliverables**:
- Dynamic market search
- Manifold integration complete
- Unified display with other sources

## Phase 3: Advanced Features (Days 11-15)

### Day 11-12: Historical Charts
**Goal**: Restore beautiful historical data visualization

**Implementation Strategy**:
1. Store historical data points during sync
2. Limit to last 30 days to prevent bloat
3. Use Recharts for visualization
4. Implement data decimation for performance

**Chart Features**:
- Interactive tooltips
- Zoom and pan
- Multiple series (if applicable)
- Responsive design
- Loading states

### Day 13: Dashboard Management & Market Addition
**Goal**: Multiple dashboards with URL-based market addition

**Dashboard Features**:
1. Create/edit/delete dashboards
2. Tab-based navigation between dashboards
3. Auto-categorization of markets
4. Dashboard-specific themes and settings
5. Pinned markets per dashboard

**Market Addition by URL**:
1. Admin interface for adding markets:
   ```typescript
   function AddMarketByUrl() {
     const [url, setUrl] = useState('');
     const [preview, setPreview] = useState(null);
     const [selectedDashboards, setSelectedDashboards] = useState([]);
     
     const handlePreview = async () => {
       const marketData = await fetchMarketByUrl(url);
       const suggestedDashboards = categorizeMarket(marketData.title);
       setPreview(marketData);
       setSelectedDashboards(suggestedDashboards);
     };
     
     return (
       <div className="card">
         <input 
           placeholder="Paste Polymarket, Kalshi, Metaculus, or Manifold URL"
           value={url}
           onChange={(e) => setUrl(e.target.value)}
         />
         <button onClick={handlePreview}>Preview</button>
         
         {preview && (
           <MarketPreview 
             market={preview}
             dashboards={selectedDashboards}
             onConfirm={addMarket}
           />
         )}
       </div>
     );
   }
   ```

2. URL parsing for each platform:
   - Polymarket: `/event/[slug]`
   - Kalshi: `/markets/[ticker]`
   - Metaculus: `/questions/[id]/[slug]`
   - Manifold: `/[username]/[market-slug]`

**Implementation**:
- Drag-and-drop for market ordering within dashboards
- Bulk assignment of markets to dashboards
- Real-time preview of dashboard changes
- Responsive tab navigation

### Day 14: PostHog Analytics
**Goal**: Comprehensive analytics and feature flags

**Setup Tasks**:
1. Configure PostHog for production
2. Implement event tracking:
   ```typescript
   // src/utils/analytics.ts
   export const EVENTS = {
     // Navigation
     PAGE_VIEW: 'page_view',
     TAB_SWITCH: 'tab_switch',
     
     // Market interactions
     MARKET_VOTE: 'market_vote',
     MARKET_CLICK: 'market_click',
     MARKET_HOVER: 'market_hover',
     MARKET_SOURCE_CLICK: 'market_source_click',
     
     // Suggestions
     SUGGESTION_CREATE: 'suggestion_create',
     SUGGESTION_UPVOTE: 'suggestion_upvote',
     SUGGESTION_VIEW: 'suggestion_view',
     
     // Admin
     ADMIN_LOGIN: 'admin_login',
     ADMIN_MARKET_EDIT: 'admin_market_edit',
     ADMIN_SUGGESTION_MODERATE: 'admin_suggestion_moderate',
     
     // Performance
     API_LATENCY: 'api_latency',
     PAGE_LOAD_TIME: 'page_load_time',
   };
   ```

3. Create custom dashboards:
   - User engagement funnel
   - Market popularity
   - API performance
   - Error tracking

### Day 15: Performance Optimization
**Goal**: Ensure fast, smooth experience

**Optimization Tasks**:
1. Implement query result caching
2. Add pagination for large datasets
3. Lazy load components
4. Optimize bundle size
5. Add service worker for offline

**Performance Targets**:
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Lighthouse Score: > 90

## Phase 4: Testing & Deployment (Days 16-20)

### Testing Strategy
1. **Unit Tests**: Each module in isolation
2. **Integration Tests**: API integrations
3. **E2E Tests**: Critical user flows
4. **Load Tests**: 1000+ markets
5. **Accessibility Tests**: WCAG compliance

### Deployment Strategy
1. **Staging Environment**: Full testing
2. **Feature Flags**: Gradual rollout
3. **Monitoring**: Real-time alerts
4. **Rollback Plan**: Quick reversion

### Documentation
1. **User Guide**: How to use voting/suggestions
2. **Admin Guide**: Dashboard management
3. **API Docs**: For future integrations
4. **Troubleshooting**: Common issues

## Risk Management

### Technical Risks
1. **API Rate Limits**
   - Mitigation: Implement caching, use webhooks where available
   
2. **Data Inconsistency**
   - Mitigation: Validation at every layer, reconciliation jobs

3. **Performance Degradation**
   - Mitigation: Pagination, lazy loading, CDN

### Business Risks
1. **Low User Engagement**
   - Mitigation: Gamification, social features
   
2. **Spam/Abuse**
   - Mitigation: Rate limiting, moderation tools

3. **API Costs**
   - Mitigation: Efficient caching, batch requests

## Success Metrics

### Technical Metrics
- Zero circular dependencies
- 100% TypeScript coverage  
- < 2s page load time
- > 99.9% uptime

### Business Metrics
- 1000+ daily active users
- 50+ votes per day
- 10+ quality suggestions per week
- 5+ approved suggestions per month

### User Experience Metrics
- < 3% bounce rate
- > 2 min average session
- > 30% returning users
- > 4.5/5 user satisfaction

## Timeline Summary

**Week 1**: Foundation & Core Features
- Type system, database, voting, suggestions

**Week 2**: API Integrations & UI
- Kalshi, Metaculus, Manifold, charts

**Week 3**: Polish & Deploy  
- Analytics, optimization, testing, launch

**Total Duration**: 15-20 working days

## Next Steps

1. Review and approve plan
2. Set up development environment
3. Create project board with all tasks
4. Begin Phase 1 implementation
5. Daily progress updates

This plan provides a clear path forward with minimal risk of the circular dependency issues that plagued the previous version. The modular architecture ensures each piece can be built and tested independently.