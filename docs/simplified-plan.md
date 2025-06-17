# Simplified Implementation Plan

## Core Concept
A dashboard system where each dashboard contains various types of cards (markets, titles, images, news). The top dashboard displays at the homepage.

## Card Types
1. **Market Card** - Real prediction market (Polymarket, Kalshi, etc.)
2. **Placeholder Market** - Suggested market that users can upvote
3. **Title Card** - Section header/divider
4. **Image Card** - Visual content
5. **News Card** - News link or update

## Phase 1: Foundation (Days 1-3)

### Day 1: Types & Database
```typescript
// convex/types.ts (NO IMPORTS)
export type CardType = "market" | "placeholder" | "title" | "image" | "news";

export type BaseCard = {
  id: string;
  dashboardId: string;
  type: CardType;
  order: number;
  createdAt: number;
};

export type MarketCard = BaseCard & {
  type: "market";
  externalId: string;
  source: string;
  title: string;
  probability: number;
  url: string;
};

export type PlaceholderCard = BaseCard & {
  type: "placeholder";
  title: string;
  description?: string;
  upvotes: number;
};

export type TitleCard = BaseCard & {
  type: "title";
  text: string;
  size: "large" | "medium" | "small";
};

export type ImageCard = BaseCard & {
  type: "image";
  imageUrl: string;
  caption?: string;
  link?: string;
};

export type NewsCard = BaseCard & {
  type: "news";
  headline: string;
  description?: string;
  link: string;
  source?: string;
};
```

### Day 2: Basic Queries
```typescript
// convex/db/dashboards.ts
export const getAllDashboards = query({
  handler: async (ctx) => {
    return await ctx.db.query("dashboards").collect();
  }
});

// convex/db/cards.ts  
export const getCardsForDashboard = query({
  args: { dashboardId: v.id("dashboards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_dashboard_order", q => 
        q.eq("dashboardId", args.dashboardId)
      )
      .collect();
  }
});
```

### Day 3: Admin UI Structure
- `/admin` with two tabs: "Manage Dashboards" | "Manage Cards"
- Start with Iran dashboard pre-created
- Basic display of existing markets

## Phase 2: Core Features (Days 4-6)

### Day 4: Dashboard Management
- Create/edit/delete dashboards
- Drag and drop reorder dashboards
- Top dashboard logic (no slug needed)
- Dashboard switching updates "Manage Cards" tab

### Day 5: Add Market by URL
```typescript
// Admin UI: Manage Cards tab
function AddMarketByUrl({ currentDashboard }) {
  const [url, setUrl] = useState("");
  
  const handleAdd = async () => {
    // Parse URL, fetch data
    const marketData = await fetchMarketByUrl(url);
    
    // Create card in current dashboard
    await createCard({
      dashboardId: currentDashboard.id,
      type: "market",
      ...marketData
    });
  };
  
  return (
    <input placeholder="Paste market URL" />
    <button onClick={handleAdd}>Add to {currentDashboard.name}</button>
  );
}
```

### Day 6: Card Reordering
- Drag and drop cards within dashboard
- Update order in database
- Optimistic updates for smooth UX

## Phase 3: Card Types (Days 7-9)

### Day 7: Placeholder Markets & Voting
- Create placeholder market cards
- Anonymous upvoting system
- Session-based vote tracking
- Display vote counts

### Day 8: Content Cards
- Title cards (section headers)
- Image cards (upload or URL)
- News cards (manual entry)
- Card preview in admin

### Day 9: Frontend Display
- Render different card types
- Responsive grid layout
- Click handlers per card type
- Loading states

## Phase 4: Polish (Days 10-12)

### Day 10: Historical Data
- Add charts to market cards
- Store historical data
- Graceful fallbacks

### Day 11: External APIs
- Integrate Kalshi
- Integrate Metaculus  
- Integrate Manifold
- Error handling

### Day 12: Analytics & Deploy
- PostHog integration
- Performance optimization
- Production deployment

## Simple Architecture Rules

1. **No Circular Dependencies**
   ```
   types.ts → schema.ts → db/*.ts → api/*.ts → components
   ```

2. **Each Module = One Job**
   - `db/dashboards.ts` - CRUD for dashboards only
   - `db/cards.ts` - CRUD for cards only
   - `api/polymarket.ts` - Fetch from Polymarket only

3. **Start Simple**
   - Get basic dashboards working first
   - Add card types one at a time
   - External APIs last

## Initial State

```typescript
// Start with one dashboard
{
  name: "Iran",
  slug: "iran",
  order: 0,
  isPublic: true
}

// Existing markets become cards
markets.map(market => ({
  dashboardId: iranDashboard.id,
  type: "market",
  title: market.title,
  probability: market.probability,
  source: market.source,
  url: market.sourceUrl,
  order: market.order || 0
}))
```

## Admin Panel Layout

```
/admin
  ├── Manage Dashboards
  │   ├── Dashboard list (drag to reorder)
  │   ├── Add dashboard button
  │   └── Edit/delete buttons
  │
  └── Manage Cards (for current dashboard)
      ├── Dashboard selector dropdown
      ├── Add card section
      │   ├── Add market by URL
      │   ├── Create placeholder
      │   ├── Add title
      │   ├── Add image
      │   └── Add news
      └── Card list (drag to reorder)
```

## Key Differences from Before
- Everything is a "card" (unified model)
- Markets must belong to a dashboard (no orphans)
- Simple two-tab admin interface
- Start with working Iran dashboard
- Add features incrementally