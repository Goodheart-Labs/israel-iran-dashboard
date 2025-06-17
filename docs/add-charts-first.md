# Add Historical Charts - Priority Fix

## Current Situation
- Markets are displaying on the homepage
- Historical data exists in the database (from previous work)
- Charts show "Chart coming soon" placeholder
- This looks incomplete for a live site

## Quick Implementation Plan

### Step 1: Add Historical Data to Simple Query
```typescript
// convex/simple.ts - UPDATE the existing query
export const getMarkets = query({
  args: {},
  handler: async (ctx) => {
    // Get all active predictions
    const predictions = await ctx.db
      .query("predictions")
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
    
    // For each prediction, get its history
    const predictionsWithHistory = await Promise.all(
      predictions.map(async (prediction) => {
        // Get historical data from predictionHistory table
        const history = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => 
            q.eq("predictionId", prediction._id)
          )
          .order("desc")
          .take(30) // Last 30 data points
          .collect();
        
        return {
          _id: prediction._id,
          title: prediction.title,
          probability: prediction.probability,
          previousProbability: prediction.previousProbability,
          source: prediction.source,
          sourceUrl: prediction.sourceUrl,
          lastUpdated: prediction.lastUpdated,
          clarificationText: prediction.clarificationText,
          // Add the historical data
          history: history.reverse().map(h => ({
            timestamp: h.timestamp,
            probability: h.probability
          }))
        };
      })
    );
    
    return predictionsWithHistory;
  }
});
```

### Step 2: Add Chart Component
```typescript
// src/components/MarketChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function MarketChart({ history }: { history: Array<{ timestamp: number; probability: number }> }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No historical data available</p>
      </div>
    );
  }

  const chartData = history.map(point => ({
    date: new Date(point.timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    probability: point.probability
  }));

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height: '260px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            interval="preserveStartEnd"
            angle={-45}
            textAnchor="end"
            height={40}
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            label={{ value: '%', angle: 0, position: 'top' }}
            width={30}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB'
            }}
            formatter={(value) => [`${String(value)}%`, 'Probability']}
          />
          <Line 
            type="monotone" 
            dataKey="probability" 
            stroke="#3B82F6" 
            strokeWidth={2.5}
            dot={{ fill: '#3B82F6', strokeWidth: 0, r: 0 }}
            activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Step 3: Update Homepage to Use Charts
```typescript
// src/routes/index.tsx - Replace the placeholder
import { MarketChart } from '@/components/MarketChart';

// In the component, replace:
{/* Placeholder for chart - we'll add this back later */}
<div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
  <p>Chart coming soon</p>
</div>

// With:
<MarketChart history={market.history} />
```

### Step 4: Verify Existing Historical Data
```typescript
// convex/debug/checkHistory.ts - Temporary debug query
export const checkHistoricalData = query({
  handler: async (ctx) => {
    const predictions = await ctx.db.query("predictions").take(5);
    
    const results = await Promise.all(
      predictions.map(async (pred) => {
        const historyCount = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => 
            q.eq("predictionId", pred._id)
          )
          .collect();
        
        return {
          title: pred.title,
          historyPoints: historyCount.length,
          firstDate: historyCount[0]?.timestamp 
            ? new Date(historyCount[0].timestamp).toLocaleDateString() 
            : 'No data',
          lastDate: historyCount[historyCount.length - 1]?.timestamp 
            ? new Date(historyCount[historyCount.length - 1].timestamp).toLocaleDateString() 
            : 'No data'
        };
      })
    );
    
    return results;
  }
});
```

## Implementation Order

1. **First**: Check what historical data exists in the database
2. **Second**: Update the simple.ts query to include history
3. **Third**: Create the MarketChart component
4. **Fourth**: Update homepage to use the chart
5. **Test**: Verify charts display with real data
6. **Deploy**: Push to production

## Notes
- This uses the historical data that should already exist from the previous implementation
- If no historical data exists for some markets, they'll show "No historical data available"
- The chart styling matches what was working before
- After this is live, we can proceed with the dashboard system

## Quick Commands
```bash
# 1. Create the chart component
mkdir -p src/components
touch src/components/MarketChart.tsx

# 2. Test locally
pnpm dev

# 3. Once working, commit and push
git add -A
git commit -m "feat: add historical charts using existing data"
git push
```