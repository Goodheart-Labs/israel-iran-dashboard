import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { predictionCategories, predictionSources } from "./schema";

// Deactivate all current predictions - used before re-seeding
export const deactivateAll = mutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    for (const p of active) {
      await ctx.db.patch(p._id, { isActive: false });
    }
    return { deactivated: active.length };
  },
});

// Get all active predictions - USED IN FRONTEND
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

// Get historical data for a prediction
export const getHistory = query({
  args: { predictionId: v.id("predictions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", (q) => q.eq("predictionId", args.predictionId))
      .collect();
  },
});

// Get historical data stats
export const getHistoryStats = query({
  args: {},
  handler: async (ctx) => {
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    const stats = await Promise.all(
      predictions.map(async (p) => {
        const historyCount = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => q.eq("predictionId", p._id))
          .collect();
        
        return {
          title: p.title,
          source: p.source,
          historyPoints: historyCount.length,
          oldestPoint: historyCount.length > 0 ? Math.min(...historyCount.map(h => h.timestamp)) : null,
          newestPoint: historyCount.length > 0 ? Math.max(...historyCount.map(h => h.timestamp)) : null,
        };
      })
    );
    
    return stats;
  },
});

// Update clarification text for a prediction - USED IN ADMIN
export const updateClarificationText = mutation({
  args: {
    id: v.id("predictions"),
    clarificationText: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth check
    await ctx.db.patch(args.id, {
      clarificationText: args.clarificationText || undefined,
    });
  },
});

// Delete a prediction - USED IN ADMIN
export const deletePrediction = mutation({
  args: {
    id: v.id("predictions"),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth check
    // First delete all history for this prediction
    const history = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", (q) => q.eq("predictionId", args.id))
      .collect();
    
    for (const h of history) {
      await ctx.db.delete(h._id);
    }
    
    // Then delete the prediction itself
    await ctx.db.delete(args.id);
  },
});

// Helper: parse outcomePrices which may be a JSON string or native array
function parseOutcomePrices(outcomePrices: unknown): number[] {
  let prices: string[];
  if (typeof outcomePrices === "string") {
    prices = JSON.parse(outcomePrices);
  } else if (Array.isArray(outcomePrices)) {
    prices = outcomePrices;
  } else {
    throw new Error("Unexpected outcomePrices format: " + String(typeof outcomePrices));
  }
  return prices.map((p) => parseFloat(p));
}

// ============================================================
// DASHBOARD MARKET CONFIG — the single source of truth
// ============================================================

type MarketConfig = {
  source: "polymarket" | "kalshi" | "metaculus";
  category: "military_action" | "nuclear_program" | "regime_stability" | "sanctions" | "regional_conflict" | "israel_relations" | "protests";
  chartGroup: string; // Markets with same chartGroup render on one chart
  chartColor: string; // Hex color for this line
  sortOrder: number;  // Display order
  shortLabel?: string;     // Label shown in combined charts (e.g. "by June 30 · Polymarket")
  // Source-specific identifiers
  slug?: string;           // Polymarket event slug (for single-market events)
  marketSlug?: string;     // Polymarket market slug (for specific markets within multi-outcome events)
  kalshiTicker?: string;   // Kalshi ticker
  metaculusId?: number;    // Metaculus question ID
  // Date question config
  questionType?: "binary" | "date";
  scalingRangeMin?: number;
  scalingRangeMax?: number;
  scalingZeroPoint?: number;
};

// Consistent source colors
const SOURCE_COLORS = {
  polymarket: "#2563EB",  // dark blue
  kalshi: "#0D9488",      // teal
  metaculus: "#7C3AED",   // purple
} as const;

const DASHBOARD_MARKETS: MarketConfig[] = [
  // --- Combined chart: Nuclear Deal (Polymarket + Kalshi) ---
  {
    source: "polymarket", slug: "us-iran-nuclear-deal-before-2027",
    category: "nuclear_program", chartGroup: "nuclear_deal",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 2,
    shortLabel: "Polymarket",
  },
  {
    source: "kalshi", kalshiTicker: "KXUSAIRANAGREEMENT-27",
    category: "nuclear_program", chartGroup: "nuclear_deal",
    chartColor: SOURCE_COLORS.kalshi, sortOrder: 2,
    shortLabel: "Kalshi",
  },

  // --- Combined chart: Strait of Hormuz (Polymarket + Kalshi) ---
  {
    source: "polymarket", slug: "will-iran-close-the-strait-of-hormuz-by-2027",
    category: "military_action", chartGroup: "hormuz",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 4,
    shortLabel: "Polymarket",
  },
  {
    source: "kalshi", kalshiTicker: "KXCLOSEHORMUZ-27JAN",
    category: "military_action", chartGroup: "hormuz",
    chartColor: SOURCE_COLORS.kalshi, sortOrder: 4,
    shortLabel: "for 7+ days · Kalshi",
  },

  // --- Combined chart: US/Iran Ceasefire (Polymarket + Metaculus) ---
  {
    source: "polymarket", slug: "us-x-iran-ceasefire-by",
    category: "military_action", chartGroup: "ceasefire",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 3,
    shortLabel: "Polymarket",
  },
  {
    source: "metaculus", metaculusId: 42472,
    category: "military_action", chartGroup: "ceasefire",
    chartColor: SOURCE_COLORS.metaculus, sortOrder: 3,
    shortLabel: "Metaculus",
  },

  // --- Standalone: Conflict ends (Polymarket) ---
  {
    source: "polymarket",
    slug: "iran-x-israelus-conflict-ends-by", // event slug for URL
    marketSlug: "iran-x-israelus-conflict-ends-by-june-30",
    category: "military_action", chartGroup: "conflict_ends",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 7,
    shortLabel: "by June 30 · Polymarket",
  },

  // --- Standalone: Trump announces end of ops (Polymarket) ---
  {
    source: "polymarket",
    slug: "trump-announces-end-of-military-operations-against-iran-by",
    marketSlug: "trump-announces-end-of-military-operations-against-iran-by-june-30th",
    category: "military_action", chartGroup: "ops_end",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 8,
    shortLabel: "by June 30 · Polymarket",
  },

  // --- Standalone: US forces enter Iran / boots on ground (Polymarket) ---
  {
    source: "polymarket",
    slug: "us-forces-enter-iran-by",
    marketSlug: "us-forces-enter-iran-by-december-31-573-642-385-371-179",
    category: "military_action", chartGroup: "us_forces_enter",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 9,
    shortLabel: "by Dec 31 · Polymarket",
  },

  // --- Combined chart: US Invasion (Polymarket + Metaculus) ---
  {
    source: "polymarket", slug: "will-the-us-invade-iran-before-2027",
    category: "military_action", chartGroup: "us_invasion",
    chartColor: SOURCE_COLORS.polymarket, sortOrder: 5,
    shortLabel: "Polymarket",
  },
  {
    source: "metaculus", metaculusId: 38768,
    category: "military_action", chartGroup: "us_invasion",
    chartColor: SOURCE_COLORS.metaculus, sortOrder: 5,
    shortLabel: "Metaculus",
  },

  // --- Standalone: Nuclear Weapon (Metaculus only) ---
  {
    source: "metaculus", metaculusId: 5253,
    category: "nuclear_program", chartGroup: "nuclear_weapon",
    chartColor: SOURCE_COLORS.metaculus, sortOrder: 4,
  },

  // --- Standalone: Iran ceases to be Islamic Republic (Metaculus date question) ---
  {
    source: "metaculus", metaculusId: 7770,
    category: "regime_stability", chartGroup: "islamic_republic",
    chartColor: SOURCE_COLORS.metaculus, sortOrder: 6,
    questionType: "date" as const,
    scalingRangeMin: 1661904000, // Aug 31 2022
    scalingRangeMax: 4796668800, // Jan 1 2122
  },
];

// Update market probability by source URL - USED BY UPDATER
export const updateMarketProbability = mutation({
  args: {
    sourceUrl: v.string(),
    probability: v.number(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const prediction = await ctx.db
      .query("predictions")
      .withIndex("by_source_url")
      .filter(q => q.eq(q.field("sourceUrl"), args.sourceUrl))
      .first();
    
    if (!prediction) {
      console.error(`No prediction found for URL: ${args.sourceUrl}`);
      return { success: false, error: "Prediction not found" };
    }
    
    const timestamp = args.timestamp || Date.now();
    
    // Only update if probability changed
    if (Math.abs(prediction.probability - args.probability) >= 1) {
      // Store history point
      await ctx.db.insert("predictionHistory", {
        predictionId: prediction._id,
        probability: args.probability,
        timestamp,
        source: prediction.source,
      });
      
      // Update prediction
      await ctx.db.patch(prediction._id, {
        previousProbability: prediction.probability,
        probability: args.probability,
        lastUpdated: timestamp,
      });
      
      console.log(`Updated ${prediction.title}: ${prediction.probability}% -> ${args.probability}%`);
    }
    
    return { success: true };
  },
});

// Fetch and update Polymarket markets from database - USED BY CRON
export const fetchPolymarketDirectMarkets = action({
  args: {},
  handler: async (ctx): Promise<{ updated: number; errors: string[]; message: string }> => {
    "use node";
    
    // Get all active Polymarket predictions from the database
    const activePredictions = await ctx.runQuery(api.predictions.getActive);
    console.log(`[POLYMARKET] Found ${activePredictions.length} active predictions total`);
    
    const polymarketPredictions = activePredictions.filter((p: any) => p.source === "polymarket");
    console.log(`[POLYMARKET] Found ${polymarketPredictions.length} Polymarket predictions`);
    
    if (polymarketPredictions.length === 0) {
      console.log("[POLYMARKET] No Polymarket predictions found in database to update");
      return { updated: 0, errors: [], message: "No Polymarket markets found in database" };
    }
    
    let updated = 0;
    const errors: string[] = [];
    
    for (const prediction of polymarketPredictions) {
      try {
        // Extract slug from sourceUrl (format: https://polymarket.com/event/slug-here)
        if (!prediction.sourceUrl) {
          throw new Error("No source URL for prediction");
        }
        
        const urlParts = prediction.sourceUrl.split('/');
        const slug = urlParts[urlParts.length - 1];
        
        if (!slug) {
          throw new Error("Could not extract slug from URL");
        }
        
        // First, fetch the event data with the slug
        const eventUrl = `https://gamma-api.polymarket.com/events?slug=${slug}`;
        console.log(`[POLYMARKET] Fetching event: ${eventUrl}`);
        
        const eventResponse = await fetch(eventUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!eventResponse.ok) {
          throw new Error(`Event API returned ${eventResponse.status}`);
        }
        
        const events = await eventResponse.json();
        
        if (!events || events.length === 0) {
          throw new Error("No events found for this slug");
        }
        
        const event = events[0];
        if (!event.markets || event.markets.length === 0) {
          throw new Error("No markets found for this event");
        }
        
        // Get the first market and its ID
        const market = event.markets[0];
        const marketId = market.id;
        
        // Now fetch the detailed market data using the market ID
        const marketDetailsUrl = `https://gamma-api.polymarket.com/markets/${marketId}`;
        console.log(`[POLYMARKET] Fetching market details: ${marketDetailsUrl}`);
        
        const marketResponse = await fetch(marketDetailsUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!marketResponse.ok) {
          throw new Error(`Market API returned ${marketResponse.status}`);
        }
        
        const marketDetails = await marketResponse.json();
        
        // Extract probability from outcomePrices
        const probability = Math.round(parseOutcomePrices(marketDetails.outcomePrices)[0] * 100);
        
        // Create the source URL using the market slug
        const sourceUrl = `https://polymarket.com/event/${marketDetails.slug}`;
        
        // Check if prediction exists
        const existing = await ctx.runQuery(api.predictions.getActive);
        const exists = existing.some((p: any) => p.sourceUrl === sourceUrl);
        
        if (!exists) {
          // This shouldn't happen since we're updating existing markets
          console.log(`Warning: Market ${sourceUrl} not found in database, skipping creation`);
        } else {
          await ctx.runMutation(api.predictions.updateMarketProbability, {
            sourceUrl,
            probability,
          });
          console.log(`✓ Updated: ${marketDetails.question} - ${probability}%`);
        }
        
        // Fetch historical data using clobTokenIds
        if (marketDetails.clobTokenIds) {
          try {
            const clobTokenIds = JSON.parse(marketDetails.clobTokenIds);
            const clobTokenId = clobTokenIds[0]; // Use first token ID
            
            console.log(`[POLYMARKET] Fetching history for CLOB token: ${clobTokenId}`);
            
            const historyResult = await ctx.runAction(api.predictions.fetchMarketHistory, {
              marketId: clobTokenId,
              marketSlug: slug, // Use event slug from sourceUrl (matches DB records)
              source: "polymarket",
              days: 7
            });
            
            if (historyResult.success) {
              console.log(`✓ Fetched ${historyResult.stored || 0} historical points`);
            }
          } catch (historyError) {
            console.error(`[POLYMARKET] Failed to fetch history: ${String(historyError)}`);
          }
        }
        
        updated++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        const errorMsg = `${prediction.title}: ${String(error)}`;
        errors.push(errorMsg);
        console.error(`[POLYMARKET] Error: ${errorMsg}`);
      }
    }
    
    return { updated, errors, message: `Updated ${updated} Polymarket markets from database` };
  },
});

// Upsert prediction - create or update based on source URL - USED BY UPDATER
export const upsert = mutation({
  args: {
    category: v.union(...predictionCategories.map(c => v.literal(c))),
    title: v.string(),
    description: v.optional(v.string()),
    probability: v.number(),
    source: v.union(...predictionSources.map(s => v.literal(s))),
    sourceUrl: v.string(),
    resolveDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if prediction already exists
    const existing = await ctx.db
      .query("predictions")
      .withIndex("by_source_url")
      .filter(q => q.eq(q.field("sourceUrl"), args.sourceUrl))
      .first();
    
    if (existing) {
      // Only update if probability has changed significantly (avoid noise)
      const probabilityDiff = Math.abs(existing.probability - args.probability);
      if (probabilityDiff >= 1) { // 1% threshold
        // Store historical data point
        await ctx.db.insert("predictionHistory", {
          predictionId: existing._id,
          probability: args.probability,
          timestamp: now,
          source: args.source,
        });
        
        // Update existing prediction
        await ctx.db.patch(existing._id, {
          previousProbability: existing.probability,
          probability: args.probability,
          lastUpdated: now,
          title: args.title,
          description: args.description,
          category: args.category,
          resolveDate: args.resolveDate,
        });
      }
      return existing._id;
    } else {
      // Create new prediction
      const predictionId = await ctx.db.insert("predictions", {
        ...args,
        lastUpdated: now,
        isActive: true,
      });
      
      // Store initial history point
      await ctx.db.insert("predictionHistory", {
        predictionId,
        probability: args.probability,
        timestamp: now,
        source: args.source,
      });
      
      return predictionId;
    }
  },
});

// Upsert prediction with chart group info
export const upsertWithGroup = mutation({
  args: {
    category: v.union(...predictionCategories.map(c => v.literal(c))),
    title: v.string(),
    description: v.optional(v.string()),
    probability: v.number(),
    source: v.union(...predictionSources.map(s => v.literal(s))),
    sourceUrl: v.string(),
    resolveDate: v.optional(v.number()),
    chartGroup: v.optional(v.string()),
    chartColor: v.optional(v.string()),
    shortLabel: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    questionType: v.optional(v.union(v.literal("binary"), v.literal("date"))),
    scalingRangeMin: v.optional(v.number()),
    scalingRangeMax: v.optional(v.number()),
    scalingZeroPoint: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("predictions")
      .withIndex("by_source_url")
      .filter(q => q.eq(q.field("sourceUrl"), args.sourceUrl))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        probability: args.probability,
        previousProbability: existing.probability,
        lastUpdated: now,
        isActive: true,
        chartGroup: args.chartGroup,
        chartColor: args.chartColor,
        shortLabel: args.shortLabel,
        sortOrder: args.sortOrder,
        questionType: args.questionType,
        scalingRangeMin: args.scalingRangeMin,
        scalingRangeMax: args.scalingRangeMax,
        scalingZeroPoint: args.scalingZeroPoint,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("predictions", {
      category: args.category,
      title: args.title,
      description: args.description,
      probability: args.probability,
      source: args.source,
      sourceUrl: args.sourceUrl,
      lastUpdated: now,
      resolveDate: args.resolveDate,
      isActive: true,
      chartGroup: args.chartGroup,
      chartColor: args.chartColor,
      shortLabel: args.shortLabel,
      sortOrder: args.sortOrder,
      questionType: args.questionType,
      scalingRangeMin: args.scalingRangeMin,
      scalingRangeMax: args.scalingRangeMax,
      scalingZeroPoint: args.scalingZeroPoint,
    });

    // Initial history point
    await ctx.db.insert("predictionHistory", {
      predictionId: id,
      probability: args.probability,
      timestamp: now,
      source: args.source,
    });

    return id;
  },
});

// Patch chart group info on existing prediction
export const patchGroupInfo = mutation({
  args: {
    id: v.id("predictions"),
    chartGroup: v.optional(v.string()),
    chartColor: v.optional(v.string()),
    shortLabel: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    questionType: v.optional(v.union(v.literal("binary"), v.literal("date"))),
    scalingRangeMin: v.optional(v.number()),
    scalingRangeMax: v.optional(v.number()),
    scalingZeroPoint: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      chartGroup: args.chartGroup,
      chartColor: args.chartColor,
      shortLabel: args.shortLabel,
      sortOrder: args.sortOrder,
      questionType: args.questionType,
      scalingRangeMin: args.scalingRangeMin,
      scalingRangeMax: args.scalingRangeMax,
      scalingZeroPoint: args.scalingZeroPoint,
    });
  },
});

// Store market history data (Polymarket/Kalshi format: {p, t} where p is 0-1 and t is seconds)
export const storeMarketHistory = mutation({
  args: {
    marketId: v.string(),
    marketSlug: v.optional(v.string()),
    historyData: v.array(v.object({
      p: v.number(), // probability (0-1 for Polymarket, already % for others)
      t: v.number()  // timestamp (seconds)
    })),
    source: v.union(v.literal("polymarket"), v.literal("kalshi"))
  },
  handler: async (ctx, args) => {
    // Find prediction by market slug in source URL (prefer active ones)
    const predictions = await ctx.db
      .query("predictions")
      .collect();

    let prediction = null;

    const slug = args.marketSlug || args.marketId;
    const matches = predictions.filter(
      (p) => p.sourceUrl && p.sourceUrl.includes(slug)
    );
    // Prefer active prediction when multiple match the same slug
    prediction = matches.find((p) => p.isActive) || matches[0] || null;
    
    if (!prediction) {
      return { success: false, error: "Prediction not found", stored: 0 };
    }
    
    // Store historical data points
    let stored = 0;
    for (const point of args.historyData) {
      try {
        // Check if this data point already exists
        const existing = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => 
            q.eq("predictionId", prediction._id)
          )
          .filter(q => q.eq(q.field("timestamp"), point.t * 1000))
          .first();
        
        if (!existing) {
          await ctx.db.insert("predictionHistory", {
            predictionId: prediction._id,
            probability: Math.round(point.p * 100), // Convert to percentage
            timestamp: point.t * 1000, // Convert to milliseconds
            source: args.source,
          });
          stored++;
        }
      } catch (error) {
        // Skip if error (likely duplicate)
        console.log("Skipping history point:", error);
      }
    }
    
    return { success: true, stored };
  },
});

// Fetch historical data for a specific market
export const fetchMarketHistory = action({
  args: {
    marketId: v.string(),
    marketSlug: v.optional(v.string()),
    source: v.union(v.literal("polymarket"), v.literal("kalshi")),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; stored?: number; totalPoints?: number; error?: string }> => {
    "use node";

    try {
      if (args.source === "polymarket") {
        // Fetch full market history (no day limit — agi-timelines pattern)
        const params = new URLSearchParams({
          market: args.marketId,
          interval: "1m",
          fidelity: "60",
        });

        const url = `https://clob.polymarket.com/prices-history?${params.toString()}`;
        console.log(`Fetching from URL: ${url}`);

        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Polymarket API error: ${response.status} - ${errorText}`);
          return { success: false, error: `API error: ${response.status} - ${errorText}` };
        }

        const data = await response.json();

        const storeResult: { success: boolean; stored: number } = await ctx.runMutation(api.predictions.storeMarketHistory, {
          marketId: args.marketId,
          marketSlug: args.marketSlug,
          historyData: data.history || [],
          source: args.source
        });

        return { success: true, stored: storeResult.stored, totalPoints: data.history?.length || 0 };
      }

      return { success: false, error: "Source not implemented yet" };

    } catch (error) {
      console.error("Error fetching market history:", error);
      return { success: false, error: String(error) };
    }
  },
});

// Store Metaculus history data (already in percentage, timestamps in ms)
export const storeMetaculusHistory = mutation({
  args: {
    predictionId: v.id("predictions"),
    historyData: v.array(v.object({
      probability: v.number(),
      timestamp: v.number(),
      lowerBound: v.optional(v.number()),
      upperBound: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    // Get existing timestamps in one scan to avoid N queries hitting the 32K read limit
    const existingPoints = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", (q) =>
        q.eq("predictionId", args.predictionId)
      )
      .collect();
    const existingTimestamps = new Set(existingPoints.map(p => p.timestamp));

    let stored = 0;
    for (const point of args.historyData) {
      if (!existingTimestamps.has(point.timestamp)) {
        await ctx.db.insert("predictionHistory", {
          predictionId: args.predictionId,
          probability: point.probability,
          timestamp: point.timestamp,
          source: "metaculus",
          ...(point.lowerBound !== undefined && { lowerBound: point.lowerBound }),
          ...(point.upperBound !== undefined && { upperBound: point.upperBound }),
        });
        stored++;
      }
    }
    return { stored };
  },
});

// Fetch historical data for ALL active markets (Polymarket + Kalshi + Metaculus)
export const fetchAllMarketHistory = action({
  args: {},
  handler: async (ctx): Promise<{ results: any[]; total: number }> => {
    "use node";

    console.log("[HISTORY] Fetching historical data for all active markets...");

    const predictions = await ctx.runQuery(api.predictions.getActive);
    const results: any[] = [];

    // --- Polymarket history ---
    const polyPredictions = predictions.filter((p: any) => p.source === "polymarket");
    for (const prediction of polyPredictions) {
      try {
        if (!prediction.sourceUrl) continue;

        const urlParts = prediction.sourceUrl.split('/');
        const slug = urlParts[urlParts.length - 1];

        console.log(`[HISTORY] Polymarket: ${prediction.title}`);

        const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
        if (!eventResponse.ok) throw new Error(`Events API ${eventResponse.status}`);

        const events = await eventResponse.json();
        if (!events?.[0]?.markets?.[0]) throw new Error("No markets found");

        const market = events[0].markets[0];
        const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
        if (!marketResponse.ok) throw new Error(`Market API ${marketResponse.status}`);

        const md = await marketResponse.json();
        if (!md.clobTokenIds) throw new Error("No clobTokenIds");

        const clobTokenIds = JSON.parse(md.clobTokenIds);
        const clobTokenId = clobTokenIds[0];

        const result: any = await ctx.runAction(api.predictions.fetchMarketHistory, {
          marketId: clobTokenId,
          marketSlug: slug,
          source: "polymarket",
        });

        results.push({ title: prediction.title, source: "polymarket", ...result });
        console.log(`[HISTORY] ✓ Polymarket ${prediction.title}: ${result.stored || 0} new points`);

        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[HISTORY] ✗ Polymarket ${prediction.title}:`, error);
        results.push({ title: prediction.title, source: "polymarket", success: false, error: String(error) });
      }
    }

    // --- Kalshi history (candlestick API) ---
    const kalshiPredictions = predictions.filter((p: any) => p.source === "kalshi");
    for (const prediction of kalshiPredictions) {
      try {
        if (!prediction.sourceUrl) continue;

        // Extract series ticker from sourceUrl (format: https://kalshi.com/markets/kxusairanagreement)
        const urlParts = prediction.sourceUrl.split("/");
        const seriesSlug = urlParts[urlParts.length - 1];
        const seriesTicker = seriesSlug.toUpperCase();

        console.log(`[HISTORY] Kalshi: ${prediction.title} (series: ${seriesTicker})`);

        // Fetch markets in this series to find the matching ticker
        const seriesResp = await fetch(
          `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${seriesTicker}&limit=20`
        );
        if (!seriesResp.ok) throw new Error(`Kalshi series API ${seriesResp.status}`);

        const seriesData = await seriesResp.json();
        const kalshiMarkets = seriesData.markets || [];

        // Find matching market by title, or fallback to first active
        const matchedMarket =
          kalshiMarkets.find(
            (m: any) =>
              m.title === prediction.title ||
              prediction.title.includes(m.title) ||
              m.title.includes(prediction.title.replace(/\?$/, ""))
          ) ||
          kalshiMarkets.find((m: any) => m.status === "active") ||
          kalshiMarkets[0];

        if (!matchedMarket) throw new Error("No matching Kalshi market found");

        const ticker = matchedMarket.ticker;
        const openTime = matchedMarket.open_time
          ? Math.floor(new Date(matchedMarket.open_time).getTime() / 1000)
          : undefined;
        const closeTime = matchedMarket.close_time
          ? Math.floor(new Date(matchedMarket.close_time).getTime() / 1000)
          : Math.floor(Date.now() / 1000);

        if (!openTime) throw new Error("No open_time on market");

        // Kalshi only allows period_interval of 1, 60, or 1440 (min)
        // Max 5000 candlesticks per request
        const totalMinutes = (closeTime - openTime) / 60;
        // Use hourly if under 5000 candles, otherwise daily
        const periodInterval = totalMinutes / 60 <= 4500 ? 60 : 1440;
        console.log(`[HISTORY] Time span: ${Math.round(totalMinutes / 60 / 24)} days, interval: ${periodInterval} min`);

        // Fetch candlestick data
        const candleUrl = `https://api.elections.kalshi.com/trade-api/v2/series/${seriesTicker}/markets/${ticker}/candlesticks?start_ts=${openTime}&end_ts=${closeTime}&period_interval=${periodInterval}`;
        console.log(`[HISTORY] Fetching candlesticks: ${candleUrl}`);

        const candleResp = await fetch(candleUrl);
        if (!candleResp.ok) {
          const errText = await candleResp.text();
          throw new Error(`Kalshi candlestick API ${candleResp.status}: ${errText}`);
        }

        const candleData = await candleResp.json();
        const candlesticks = candleData.candlesticks || [];

        // Convert to our {p, t} format — price.mean is in cents (0-100)
        const historyData = candlesticks
          .filter((c: any) => {
            const mean = c.price?.mean;
            return mean !== null && mean !== undefined && mean > 0;
          })
          .map((c: any) => ({
            p: c.price.mean / 100, // Convert cents → 0-1 (storeMarketHistory will × 100)
            t: c.end_period_ts,
          }));

        if (historyData.length === 0) {
          throw new Error("No valid candlestick data points");
        }

        const storeResult: { success: boolean; stored: number } =
          await ctx.runMutation(api.predictions.storeMarketHistory, {
            marketId: ticker,
            marketSlug: seriesSlug, // lowercase matches sourceUrl
            historyData,
            source: "kalshi",
          });

        results.push({
          title: prediction.title,
          source: "kalshi",
          success: true,
          stored: storeResult.stored,
          totalPoints: historyData.length,
        });
        console.log(
          `[HISTORY] ✓ Kalshi ${prediction.title}: ${storeResult.stored} new points (${historyData.length} total)`
        );

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[HISTORY] ✗ Kalshi ${prediction.title}:`, error);
        results.push({
          title: prediction.title,
          source: "kalshi",
          success: false,
          error: String(error),
        });
      }
    }

    // --- Metaculus history (from aggregations.recency_weighted.history) ---
    const metaculusPredictions = predictions.filter((p: any) => p.source === "metaculus");
    for (const prediction of metaculusPredictions) {
      try {
        if (!prediction.sourceUrl) continue;

        const match = prediction.sourceUrl.match(/questions\/(\d+)/);
        if (!match) throw new Error("Could not extract question ID");
        const questionId = match[1];

        console.log(`[HISTORY] Metaculus: ${prediction.title} (Q${questionId})`);

        const metaculusToken = process.env.METACULUS_API_KEY || "";
        const headers: Record<string, string> = { Accept: "application/json" };
        if (metaculusToken) headers["Authorization"] = `Token ${metaculusToken}`;

        const resp = await fetch(
          `https://www.metaculus.com/api/posts/${questionId}/`,
          { headers }
        );
        if (!resp.ok) throw new Error(`Metaculus API ${resp.status}`);

        const data = await resp.json();
        const history = data.question?.aggregations?.recency_weighted?.history;

        if (!history || !Array.isArray(history)) {
          throw new Error("No history in aggregations.recency_weighted");
        }

        // Convert to our format: each entry has centers[0] (probability) and start_time
        // start_time is Unix seconds — multiply by 1000 for milliseconds
        // Also extract interval bounds for date questions
        const historyData = history
          .filter((h: any) => h.centers?.[0] !== undefined && h.start_time)
          .map((h: any) => ({
            probability: Math.round(h.centers[0] * 100),
            timestamp: typeof h.start_time === "number" && h.start_time < 1e12
              ? h.start_time * 1000  // seconds → ms
              : new Date(h.start_time).getTime(), // ISO string or already ms
            ...(h.interval_lower_bounds?.[0] !== undefined && {
              lowerBound: h.interval_lower_bounds[0],
            }),
            ...(h.interval_upper_bounds?.[0] !== undefined && {
              upperBound: h.interval_upper_bounds[0],
            }),
          }));

        const storeResult = await ctx.runMutation(api.predictions.storeMetaculusHistory, {
          predictionId: prediction._id,
          historyData,
        });

        results.push({
          title: prediction.title,
          source: "metaculus",
          success: true,
          stored: storeResult.stored,
          totalPoints: historyData.length,
        });
        console.log(`[HISTORY] ✓ Metaculus ${prediction.title}: ${storeResult.stored} new points (${historyData.length} total)`);

        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[HISTORY] ✗ Metaculus ${prediction.title}:`, error);
        results.push({ title: prediction.title, source: "metaculus", success: false, error: String(error) });
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`[HISTORY] Complete: ${successful}/${results.length} successful`);

    return { results, total: results.length };
  },
});

// Seed all dashboard markets (Polymarket + Kalshi + Metaculus)
export const seedInitialMarkets = action({
  args: {},
  handler: async (ctx): Promise<{ message: string; created: number; errors: string[] }> => {
    "use node";

    console.log("[SEED] Seeding all dashboard markets...");

    let created = 0;
    const errors: string[] = [];
    const existing = await ctx.runQuery(api.predictions.getActive);

    for (const config of DASHBOARD_MARKETS) {
      try {
        let title = "";
        let description = "";
        let probability = 0;
        let sourceUrl = "";
        let resolveDate: number | undefined;

        if (config.source === "polymarket" && (config.slug || config.marketSlug)) {
          let md: any;
          if (config.marketSlug) {
            // Direct market slug lookup (for specific markets within multi-outcome events)
            const mktResp = await fetch(
              `https://gamma-api.polymarket.com/markets?slug=${config.marketSlug}`,
              { headers: { 'Accept': 'application/json' } }
            );
            if (!mktResp.ok) throw new Error(`Polymarket API ${mktResp.status}`);
            const mkts = await mktResp.json();
            if (!mkts?.[0]) throw new Error("No markets found");
            md = mkts[0];
          } else {
            const eventResponse = await fetch(
              `https://gamma-api.polymarket.com/events?slug=${config.slug}`,
              { headers: { 'Accept': 'application/json' } }
            );
            if (!eventResponse.ok) throw new Error(`Polymarket API ${eventResponse.status}`);

            const events = await eventResponse.json();
            if (!events?.[0]?.markets?.[0]) throw new Error("No markets found");

            const market = events[0].markets[0];
            const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
            if (!marketResponse.ok) throw new Error(`Market API ${marketResponse.status}`);
            md = await marketResponse.json();
          }

          probability = Math.round(parseOutcomePrices(md.outcomePrices)[0] * 100);
          title = md.question;
          description = md.description?.slice(0, 500);
          // For marketSlug markets, store the market slug in sourceUrl so the poller can look it up directly.
          // For event-slug markets, store the event slug (poller uses events API).
          sourceUrl = config.marketSlug
            ? `https://polymarket.com/event/${config.marketSlug}`
            : `https://polymarket.com/event/${config.slug}`;
          resolveDate = md.endDate ? new Date(md.endDate).getTime() : undefined;

        } else if (config.source === "kalshi" && config.kalshiTicker) {
          const resp = await fetch(
            `https://api.elections.kalshi.com/trade-api/v2/markets/${config.kalshiTicker}`
          );
          if (!resp.ok) throw new Error(`Kalshi API ${resp.status}`);

          const data = await resp.json();
          const m = data.market;
          probability = m.last_price; // Kalshi prices are already 0-100 (cents)
          title = m.title;
          description = m.rules_primary?.slice(0, 500);
          sourceUrl = `https://kalshi.com/markets/${m.ticker.split('-')[0].toLowerCase()}`;
          resolveDate = m.expiration_time ? new Date(m.expiration_time).getTime() : undefined;

        } else if (config.source === "metaculus" && config.metaculusId) {
          const metaculusToken = process.env.METACULUS_API_KEY || "";
          const mcHeaders: Record<string, string> = { Accept: "application/json" };
          if (metaculusToken) mcHeaders["Authorization"] = `Token ${metaculusToken}`;
          const resp = await fetch(
            `https://www.metaculus.com/api/posts/${config.metaculusId}/`,
            { headers: mcHeaders }
          );
          if (!resp.ok) throw new Error(`Metaculus API ${resp.status}`);

          const data = await resp.json();
          title = data.title;
          description = data.question?.description?.slice(0, 500) || "";
          sourceUrl = `https://www.metaculus.com/questions/${config.metaculusId}/`;

          // Extract community prediction
          const q = data.question;
          if (q?.aggregations?.recency_weighted?.latest?.centers?.[0] !== undefined) {
            probability = Math.round(q.aggregations.recency_weighted.latest.centers[0] * 100);
          } else if (q?.my_forecasts?.latest?.forecast_values?.[1] !== undefined) {
            probability = Math.round(q.my_forecasts.latest.forecast_values[1] * 100);
          } else {
            probability = 0; // No community prediction yet
          }

          resolveDate = data.scheduled_close_time ? new Date(data.scheduled_close_time).getTime() : undefined;
        }

        if (!title) {
          throw new Error("Could not fetch market data");
        }

        // Check if already exists
        const exists = existing.some((p: any) => p.sourceUrl === sourceUrl);

        if (!exists) {
          await ctx.runMutation(api.predictions.upsertWithGroup, {
            category: config.category,
            title,
            description,
            probability,
            source: config.source,
            sourceUrl,
            resolveDate,
            chartGroup: config.chartGroup,
            chartColor: config.chartColor,
            shortLabel: config.shortLabel,
            sortOrder: config.sortOrder,
            questionType: config.questionType,
            scalingRangeMin: config.scalingRangeMin,
            scalingRangeMax: config.scalingRangeMax,
            scalingZeroPoint: config.scalingZeroPoint,
          });
          created++;
          console.log(`✓ ${config.source}: ${title} (${probability}%)`);
        } else {
          // Update chartGroup/color/sortOrder on existing
          const match = existing.find((p: any) => p.sourceUrl === sourceUrl);
          if (match) {
            await ctx.runMutation(api.predictions.patchGroupInfo, {
              id: match._id,
              chartGroup: config.chartGroup,
              chartColor: config.chartColor,
              shortLabel: config.shortLabel,
              sortOrder: config.sortOrder,
              questionType: config.questionType,
              scalingRangeMin: config.scalingRangeMin,
              scalingRangeMax: config.scalingRangeMax,
              scalingZeroPoint: config.scalingZeroPoint,
            });
            console.log(`- Updated group info: ${title}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        const label = config.slug || config.kalshiTicker || String(config.metaculusId);
        errors.push(`${label}: ${String(error)}`);
        console.error(`[SEED] Error: ${label} - ${String(error)}`);
      }
    }

    return { message: `Seeded ${created} new markets`, created, errors };
  },
});

// Fix sourceUrls to use event-level slugs (one-time migration)
export const fixPolymarketUrls = mutation({
  args: {},
  handler: async (ctx) => {
    // Map of wrong market-level URLs → correct event-level URLs
    const urlFixes: Record<string, string> = {
      "https://polymarket.com/event/iran-x-israelus-conflict-ends-by-march-7":
        "https://polymarket.com/event/iran-x-israelus-conflict-ends-by",
      "https://polymarket.com/event/us-x-iran-ceasefire-by-march-31":
        "https://polymarket.com/event/us-x-iran-ceasefire-by",
      "https://polymarket.com/event/will-iran-close-the-strait-of-hormuz-by-2027-969-911-654-431-667":
        "https://polymarket.com/event/will-iran-close-the-strait-of-hormuz-by-2027",
    };

    let fixed = 0;
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    for (const p of predictions) {
      if (p.sourceUrl && urlFixes[p.sourceUrl]) {
        await ctx.db.patch(p._id, { sourceUrl: urlFixes[p.sourceUrl] });
        console.log(`Fixed URL: ${p.sourceUrl} → ${urlFixes[p.sourceUrl]}`);
        fixed++;
      }
    }

    return { fixed };
  },
});

// Fix Metaculus history timestamps that were stored in seconds instead of milliseconds
// Processes one prediction at a time to stay under 32K read limit
export const fixMetaculusTimestamps = mutation({
  args: { predictionId: v.id("predictions") },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", (q) =>
        q.eq("predictionId", args.predictionId)
      )
      .collect();

    let fixed = 0;
    for (const point of history) {
      if (point.timestamp < 1e12) {
        await ctx.db.patch(point._id, { timestamp: point.timestamp * 1000 });
        fixed++;
      }
    }

    return { fixed, total: history.length };
  },
});

// Fix all Metaculus timestamps (action that calls mutation per prediction)
export const fixAllMetaculusTimestamps = action({
  args: {},
  handler: async (ctx): Promise<Array<{ title: string; fixed: number; total: number }>> => {
    const predictions: any[] = await ctx.runQuery(api.predictions.getActive);
    const metaculusPredictions = predictions.filter((p: any) => p.source === "metaculus");

    const results: Array<{ title: string; fixed: number; total: number }> = [];
    for (const p of metaculusPredictions) {
      const result: { fixed: number; total: number } = await ctx.runMutation(api.predictions.fixMetaculusTimestamps, {
        predictionId: p._id,
      });
      results.push({ title: p.title, ...result });
      console.log(`Fixed ${p.title}: ${result.fixed}/${result.total} timestamps`);
    }
    return results;
  },
});

// Re-import Metaculus Q7770 history with bounds (one-off to backfill lowerBound/upperBound)
export const reimportMetaculusWithBounds = action({
  args: { predictionId: v.id("predictions") },
  handler: async (ctx, args): Promise<{ stored: number; totalPoints: number }> => {
    "use node";

    const prediction: any = await ctx.runQuery(api.predictions.getActive);
    const match = prediction.find((p: any) => p._id === args.predictionId);
    if (!match?.sourceUrl) throw new Error("Prediction not found or no sourceUrl");

    const urlMatch = match.sourceUrl.match(/questions\/(\d+)/);
    if (!urlMatch) throw new Error("Could not extract question ID");
    const questionId = urlMatch[1];

    console.log(`[REIMPORT BOUNDS] Fetching Metaculus Q${questionId}...`);

    const token = process.env.METACULUS_API_KEY || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Token ${token}`;

    const resp = await fetch(
      `https://www.metaculus.com/api/posts/${questionId}/`,
      { headers }
    );
    if (!resp.ok) throw new Error(`Metaculus API ${resp.status}`);

    const data = await resp.json();
    const history = data.question?.aggregations?.recency_weighted?.history;
    if (!history?.length) throw new Error("No history");

    const historyData = history
      .filter((h: any) => h.centers?.[0] !== undefined && h.start_time)
      .map((h: any) => ({
        probability: Math.round(h.centers[0] * 100),
        timestamp: typeof h.start_time === "number" && h.start_time < 1e12
          ? h.start_time * 1000
          : new Date(h.start_time).getTime(),
        ...(h.interval_lower_bounds?.[0] !== undefined && {
          lowerBound: h.interval_lower_bounds[0],
        }),
        ...(h.interval_upper_bounds?.[0] !== undefined && {
          upperBound: h.interval_upper_bounds[0],
        }),
      }));

    // Delete existing history
    const existing = await ctx.runQuery(api.predictions.getHistoryCount, {
      predictionId: args.predictionId,
    });
    console.log(`[REIMPORT BOUNDS] Deleting ${existing} existing points...`);
    await ctx.runMutation(api.predictions.deleteHistory, {
      predictionId: args.predictionId,
    });

    // Re-store with bounds
    const result: { stored: number } = await ctx.runMutation(api.predictions.storeMetaculusHistory, {
      predictionId: args.predictionId,
      historyData,
    });

    console.log(`[REIMPORT BOUNDS] Stored ${result.stored} points with bounds`);
    return { stored: result.stored, totalPoints: historyData.length };
  },
});

// Helper: count history points for a prediction
export const getHistoryCount = query({
  args: { predictionId: v.id("predictions") },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", (q) => q.eq("predictionId", args.predictionId))
      .collect();
    return history.length;
  },
});

// Helper: delete all history for a prediction (for reimport)
export const deleteHistory = mutation({
  args: { predictionId: v.id("predictions") },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("predictionHistory")
      .withIndex("by_prediction_time", (q) => q.eq("predictionId", args.predictionId))
      .collect();
    for (const point of history) {
      await ctx.db.delete(point._id);
    }
    return { deleted: history.length };
  },
});

// Deactivate a market by title substring
export const deactivateByTitle = mutation({
  args: { titleSubstring: v.string() },
  handler: async (ctx, args) => {
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    let deactivated = 0;
    for (const p of predictions) {
      if (p.title.toLowerCase().includes(args.titleSubstring.toLowerCase())) {
        await ctx.db.patch(p._id, { isActive: false });
        console.log(`Deactivated: ${p.title}`);
        deactivated++;
      }
    }
    return { deactivated };
  },
});

// Debug: fetch Metaculus question scaling info
export const getMetaculusScaling = action({
  args: { questionId: v.number() },
  handler: async (_ctx, args) => {
    "use node";
    const token = process.env.METACULUS_API_KEY || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Token ${token}`;

    const resp = await fetch(
      `https://www.metaculus.com/api/posts/${args.questionId}/`,
      { headers }
    );
    if (!resp.ok) throw new Error(`Metaculus API ${resp.status}`);
    const data = await resp.json();
    const q = data.question;
    const hist = q?.aggregations?.recency_weighted?.history || [];
    const last = hist[hist.length - 1];
    return {
      type: q?.type,
      scaling: q?.scaling,
      historyPoints: hist.length,
      latest: last ? {
        centers: last.centers,
        lower: last.interval_lower_bounds,
        upper: last.interval_upper_bounds,
        start_time: last.start_time,
      } : null,
    };
  },
});

// One-off: clean re-import of all Polymarket history from their API
// Wipes existing Polymarket history and replaces with fresh full data
export const reimportPolymarketHistory = action({
  args: {},
  handler: async (ctx): Promise<Array<{ title: string; replaced: number; stored: number }>> => {
    "use node";

    const predictions: any[] = await ctx.runQuery(api.predictions.getActive);
    const polyPredictions = predictions.filter((p: any) => p.source === "polymarket");

    const results: Array<{ title: string; replaced: number; stored: number }> = [];

    for (const prediction of polyPredictions) {
      try {
        if (!prediction.sourceUrl) continue;

        const urlParts = prediction.sourceUrl.split("/");
        const slug = urlParts[urlParts.length - 1];

        // Get CLOB token
        const eventResp = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
        if (!eventResp.ok) throw new Error(`Events API ${eventResp.status}`);
        const events = await eventResp.json();
        if (!events?.[0]?.markets?.[0]) throw new Error("No markets found");

        const market = events[0].markets[0];
        const marketResp = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
        if (!marketResp.ok) throw new Error(`Market API ${marketResp.status}`);
        const md = await marketResp.json();
        if (!md.clobTokenIds) throw new Error("No clobTokenIds");

        const clobTokenIds = JSON.parse(md.clobTokenIds);
        const clobTokenId = clobTokenIds[0];

        // Fetch full history
        const histResp = await fetch(
          `https://clob.polymarket.com/prices-history?market=${clobTokenId}&interval=1m&fidelity=60`
        );
        if (!histResp.ok) throw new Error(`History API ${histResp.status}`);
        const histData = await histResp.json();
        const points = histData.history || [];

        // Replace all history for this prediction
        const result: { success: boolean; stored: number; replaced: number } =
          await ctx.runMutation(internal.historicalMutations.replaceHistory, {
            predictionId: prediction._id,
            historyData: points.map((p: any) => ({
              timestamp: p.t * 1000,
              probability: Math.round(p.p * 100),
            })),
            source: "polymarket" as const,
          });

        results.push({ title: prediction.title, replaced: result.replaced, stored: result.stored });
        console.log(`[REIMPORT] ${prediction.title}: replaced ${result.replaced} → ${result.stored} points`);

        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[REIMPORT] ${prediction.title}: ${String(error)}`);
        results.push({ title: prediction.title, replaced: 0, stored: 0 });
      }
    }

    return results;
  },
});