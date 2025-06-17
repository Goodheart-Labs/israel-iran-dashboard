# Dashboard System Design

## Overview

The dashboard system allows organizing markets into thematic collections, making it easier for users to focus on specific aspects of Iran's geopolitical situation. Each dashboard can have its own theme, custom market ordering, and clarification text.

## Dashboard Structure

### Core Dashboards

1. **All Markets** (default)
   - URL: `/`
   - Shows all active markets
   - Default sorting by probability change
   - No filtering

2. **Iran Nuclear** 
   - URL: `/nuclear`
   - Icon: ☢️
   - Keywords: nuclear, uranium, enrichment, IAEA, NPT, sanctions
   - Example markets:
     - "Will Iran reach 90% uranium enrichment by 2025?"
     - "Will the JCPOA be revived in 2025?"
     - "Will IAEA inspectors be expelled from Iran?"

3. **Iran Military**
   - URL: `/military`
   - Icon: ⚔️
   - Keywords: military, war, conflict, Israel, strike, attack
   - Example markets:
     - "Will Israel conduct airstrikes on Iran in 2025?"
     - "Will Iran close the Strait of Hormuz?"
     - "Will Iran test a ballistic missile in Q1 2025?"

4. **Iran Economy**
   - URL: `/economy`
   - Icon: 💰
   - Keywords: economy, oil, sanctions, trade, currency, inflation
   - Example markets:
     - "Will Iran's oil exports exceed 2M barrels/day?"
     - "Will the Iranian Rial fall below 600,000 to USD?"
     - "Will US sanctions on Iran be lifted in 2025?"

5. **Regional Relations**
   - URL: `/regional`
   - Icon: 🤝
   - Keywords: Saudi, UAE, Iraq, Syria, Lebanon, Yemen
   - Example markets:
     - "Will Iran and Saudi Arabia maintain diplomatic relations?"
     - "Will Iran reduce support for Houthis in Yemen?"
     - "Will Iran withdraw forces from Syria?"

## Auto-Categorization Logic

```typescript
// convex/utils/categorization.ts
export function categorizeMarket(title: string, description?: string): string[] {
  const text = `${title} ${description || ''}`.toLowerCase();
  const categories: string[] = [];
  
  // Nuclear keywords
  if (/nuclear|uranium|enrichment|iaea|jcpoa|atomic/.test(text)) {
    categories.push('nuclear');
  }
  
  // Military keywords
  if (/military|war|conflict|israel|strike|attack|missile|drone/.test(text)) {
    categories.push('military');
  }
  
  // Economy keywords
  if (/economy|oil|sanction|trade|currency|rial|export|inflation/.test(text)) {
    categories.push('economy');
  }
  
  // Regional keywords
  if (/saudi|uae|iraq|syria|lebanon|yemen|gulf|gcc/.test(text)) {
    categories.push('regional');
  }
  
  return categories.length > 0 ? categories : ['general'];
}
```

## Admin Features

### Dashboard Management UI

```typescript
// Admin dashboard manager component
function DashboardManager() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Dashboard List */}
      <div className="lg:col-span-2">
        <DashboardList />
      </div>
      
      {/* Quick Actions */}
      <div>
        <QuickActions>
          <AddMarketByUrl />
          <CreateDashboard />
          <BulkAssignment />
        </QuickActions>
      </div>
    </div>
  );
}
```

### Add Market by URL Flow

1. **Paste URL**
   ```
   https://polymarket.com/event/will-iran-reach-90-uranium-enrichment
   ```

2. **System fetches market data**
   - Title: "Will Iran reach 90% uranium enrichment by July 2025?"
   - Current probability: 34%
   - Volume: $125,000

3. **Auto-categorization**
   - Suggested dashboards: Nuclear (primary), Military (secondary)

4. **Admin can**:
   - Override dashboard assignments
   - Add custom clarification text
   - Set priority/pinning
   - Preview before saving

### Bulk Operations

```typescript
// Bulk assign markets to dashboards
function BulkAssignment() {
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [targetDashboard, setTargetDashboard] = useState<string>('');
  
  return (
    <div>
      <MarketMultiSelect onChange={setSelectedMarkets} />
      <DashboardSelect onChange={setTargetDashboard} />
      <button onClick={() => assignMarkets(selectedMarkets, targetDashboard)}>
        Assign {selectedMarkets.length} markets
      </button>
    </div>
  );
}
```

## User Experience

### Navigation

```typescript
// Top-level navigation component
function DashboardNavigation() {
  const dashboards = useQuery(api.dashboards.getPublic);
  const currentPath = useLocation().pathname;
  
  return (
    <nav className="tabs tabs-boxed">
      <Link 
        to="/" 
        className={cn("tab", currentPath === "/" && "tab-active")}
      >
        🌍 All Markets
      </Link>
      
      {dashboards.map(dashboard => (
        <Link
          key={dashboard.id}
          to={`/${dashboard.slug}`}
          className={cn("tab", currentPath === `/${dashboard.slug}` && "tab-active")}
        >
          {dashboard.icon} {dashboard.name}
        </Link>
      ))}
    </nav>
  );
}
```

### Dashboard-Specific Features

1. **Custom Sorting**
   - Each dashboard can have default sort order
   - Pinned markets always appear first
   - User preference remembered per dashboard

2. **Themed Display**
   ```typescript
   // Apply dashboard theme
   function DashboardPage({ dashboard }) {
     const theme = dashboard.theme || {};
     
     return (
       <div style={{
         '--primary-color': theme.primaryColor || '#3B82F6',
         '--accent-color': theme.accentColor || '#F59E0B'
       }}>
         <DashboardHeader dashboard={dashboard} />
         <MarketGrid markets={dashboard.markets} />
       </div>
     );
   }
   ```

3. **Smart Filtering**
   - Hide irrelevant markets per dashboard
   - Show related markets from other categories
   - Suggest markets that might fit

## Database Schema

```typescript
// Enhanced schema for dashboards
dashboards: defineTable({
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  order: v.number(),
  isPublic: v.boolean(),
  isActive: v.boolean(),
  createdBy: v.string(),
  marketCategories: v.optional(v.array(v.string())),
  pinnedMarkets: v.optional(v.array(v.id("predictions"))),
  theme: v.optional(v.object({
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
  })),
  settings: v.optional(v.object({
    defaultSort: v.optional(v.string()),
    hideZeroVolume: v.optional(v.boolean()),
    minProbabilityChange: v.optional(v.number()),
  })),
})
  .index("by_slug", ["slug"])
  .index("by_public_order", ["isPublic", "isActive", "order"]),

dashboardMarkets: defineTable({
  dashboardId: v.id("dashboards"),
  marketId: v.id("predictions"),
  order: v.number(),
  isPinned: v.boolean(),
  clarificationOverride: v.optional(v.string()),
  hideFromDashboard: v.boolean(),
  addedBy: v.string(),
  addedAt: v.number(),
})
  .index("by_dashboard_order", ["dashboardId", "order"])
  .index("by_market", ["marketId"]),
```

## Analytics Tracking

```typescript
// Track dashboard usage
trackEvent('dashboard_view', {
  dashboard_slug: dashboard.slug,
  dashboard_name: dashboard.name,
  market_count: markets.length,
  user_session: getSessionId(),
});

// Track market addition
trackEvent('market_added_by_url', {
  market_url: url,
  market_source: source,
  assigned_dashboards: dashboardIds,
  auto_categorized: wasAutoCategorized,
  admin_id: adminId,
});
```

## Future Enhancements

1. **User-Created Dashboards**
   - Allow premium users to create custom dashboards
   - Share dashboards with others
   - Follow other users' dashboards

2. **Smart Recommendations**
   - ML-based market categorization
   - Suggest related markets
   - Predict user interests

3. **Dashboard Templates**
   - Pre-built dashboard configurations
   - Regional focus (Middle East, Global, etc.)
   - Time-based (Short-term, Long-term)

4. **Collaborative Features**
   - Comments per dashboard
   - Dashboard-specific discussions
   - Expert annotations