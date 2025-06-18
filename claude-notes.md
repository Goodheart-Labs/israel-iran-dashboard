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

## Development Roadmap with Best Practices

### Phase 1: MVP Voting System (1-2 weeks) 🚀
**Goal**: Validate user interest in voting feature with minimal complexity

1. **Client-Side Vote Storage**
   ```typescript
   // Use Zustand/Valtio for state management
   interface VoteStore {
     votes: Map<predictionId, 'up' | 'down' | null>
     toggleVote: (id: string, type: 'up' | 'down') => void
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
   }).index("by_session", ["sessionId", "predictionId"])
     .index("by_prediction", ["predictionId"])
   ```

2. **Smart Aggregation**
   - Batch vote updates every 30 seconds
   - Materialized vote counts on predictions
   - Trending algorithm: (votes / hours_since_creation)^gravity
   - Cache popular predictions in Redis/memory

3. **Analytics & Insights**
   - Track vote patterns per session
   - A/B test vote UI variations
   - Measure engagement lift from voting
   - Admin dashboard for vote analytics

### Phase 3: Social Features (3-4 weeks) 🌟
**Goal**: Build community around high-quality predictions

1. **User Authentication Integration**
   - Migrate anonymous votes to user accounts
   - Vote history in user profile
   - Reputation system based on early correct votes
   - OAuth with Twitter/Google for easy sharing

2. **Advanced Features**
   - Comments on predictions (nested, voteable)
   - "Explain your vote" optional text
   - Follow other users with good track records
   - Weekly digest of top-voted predictions

3. **Gamification**
   - Badges for consistent voting
   - Leaderboards for prediction accuracy
   - Points for upvoting eventual correct predictions
   - Achievements system

### Phase 4: Platform Expansion (4-6 weeks) 🔧
**Goal**: Scale to handle multiple prediction sources efficiently

1. **Multi-Source Architecture**
   ```typescript
   // convex/sources/base.ts
   interface PredictionSource {
     fetchMarkets(): Promise<Market[]>
     normalizeData(raw: any): NormalizedMarket
     validateData(market: Market): boolean
   }
   ```
   - Adapter pattern for each source
   - Parallel fetching with error boundaries
   - Automatic retry with exponential backoff
   - Source health monitoring dashboard

2. **Data Quality Pipeline**
   - Deduplication across sources
   - Confidence scoring per source
   - Automated flagging of anomalies
   - Manual review queue for edge cases

3. **Performance Optimization**
   - GraphQL/tRPC for efficient data fetching
   - Incremental Static Regeneration (ISR)
   - Edge caching for global performance
   - WebSocket for real-time vote updates

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