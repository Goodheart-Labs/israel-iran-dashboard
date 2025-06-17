# Implementation Roadmap

## Week 1: Foundation & Infrastructure

### Day 1-2: Module Restructuring
- [ ] Create `convex/types.ts` with all shared types (no imports)
- [ ] Create `convex/db/` directory structure
- [ ] Move market queries to `convex/db/markets.ts`
- [ ] Move dashboard queries to `convex/db/dashboards.ts`
- [ ] Test that no circular dependencies exist

### Day 3-4: Voting System
- [ ] Add votes table to schema
- [ ] Create `convex/db/votes.ts` with:
  - `castVote` mutation
  - `getVotesForMarket` query
  - `getUserVotes` query
- [ ] Add session ID management to frontend
- [ ] Create voting UI component
- [ ] Add vote counts to market cards

### Day 5: Suggestions System
- [ ] Add suggestions table to schema
- [ ] Create `convex/db/suggestions.ts`
- [ ] Build suggestion form component
- [ ] Add suggestion list with upvoting
- [ ] Create admin approval UI

## Week 2: Market Sources & Analytics

### Day 6-7: Kalshi Integration
- [ ] Create `convex/api/kalshi.ts`
- [ ] Add Kalshi types to `types.ts`
- [ ] Build market fetching function
- [ ] Add to sync action
- [ ] Test with real API

### Day 8-9: Metaculus Integration
- [ ] Create `convex/api/metaculus.ts`
- [ ] Add Metaculus types
- [ ] Build question fetching
- [ ] Handle probability format differences
- [ ] Add to sync action

### Day 10: Manifold Integration
- [ ] Create `convex/api/manifold.ts`
- [ ] Add Manifold types
- [ ] Build market search
- [ ] Add to sync action

## Week 3: UI Features & Polish

### Day 11-12: Historical Charts
- [ ] Create `HistoricalChart` component
- [ ] Add chart to market cards
- [ ] Implement data fetching
- [ ] Add loading states
- [ ] Style charts properly

### Day 13: Dashboard Management
- [ ] Create dashboard CRUD UI
- [ ] Add market assignment interface
- [ ] Build reordering with drag-and-drop
- [ ] Test with multiple dashboards

### Day 14-15: PostHog & Polish
- [ ] Create `utils/analytics.ts`
- [ ] Add event tracking to all interactions
- [ ] Set up feature flags
- [ ] Add user identification
- [ ] Create analytics dashboard
- [ ] Final testing and bug fixes

## Quick Start Commands

```bash
# 1. Create the new structure
mkdir -p convex/db convex/api src/utils

# 2. Create types file (no imports!)
touch convex/types.ts

# 3. Create database modules
touch convex/db/markets.ts
touch convex/db/dashboards.ts
touch convex/db/votes.ts
touch convex/db/suggestions.ts

# 4. Create API modules
touch convex/api/kalshi.ts
touch convex/api/metaculus.ts
touch convex/api/manifold.ts
touch convex/api/polymarket.ts

# 5. Create utilities
touch src/utils/analytics.ts
touch src/utils/session.ts
```

## Critical Success Factors

1. **No Circular Dependencies**
   - Run `pnpm tsc --noEmit` after each module
   - Check imports are unidirectional

2. **Test Each Integration**
   - Each API source works independently
   - Graceful fallbacks for API failures

3. **Incremental Deployment**
   - Deploy after each major feature
   - Use feature flags for new features
   - Monitor with PostHog

4. **User Experience**
   - Page loads fast even with multiple sources
   - Voting is instant and optimistic
   - Clear feedback on all actions

## Risk Mitigation

### If Circular Dependencies Appear:
1. Check which module is importing incorrectly
2. Move shared code to `types.ts`
3. Use dynamic imports as last resort

### If API Rate Limits Hit:
1. Implement caching layer
2. Stagger API calls
3. Use webhooks where available

### If Performance Degrades:
1. Implement pagination
2. Use React Query for caching
3. Lazy load charts

## Definition of Done

- [ ] All market sources integrated and displaying
- [ ] Anonymous voting working
- [ ] Suggestions system live
- [ ] Historical charts showing
- [ ] PostHog tracking all events
- [ ] No circular dependencies
- [ ] All TypeScript errors resolved
- [ ] Deployed to production