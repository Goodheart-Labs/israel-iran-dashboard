import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { predictionCategories, predictionSources } from "./schema";

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

// Featured Polymarket markets to track - USED BY UPDATER
// Using full slugs (no UUIDs) - these are the actual Polymarket event slugs
const FEATURED_POLYMARKET_MARKETS = [
  // Removed: will-iran-strike-israel-by-july-14 (market not found)
  { slug: "us-military-action-against-iran-in-2025", category: "military_action" as const },
  { slug: "iran-nuclear-weapon-by-april-2025", category: "nuclear_program" as const },
  { slug: "israel-strikes-iranian-nuclear-sites-in-2025", category: "israel_relations" as const },
  { slug: "strait-of-hormuz-closure-in-2025", category: "military_action" as const },
  { slug: "khamenei-out-as-supreme-leader-of-iran-by-june-30", category: "regime_stability" as const },
  { slug: "nuclear-weapon-detonated-in-2025", category: "nuclear_program" as const },
  { slug: "netanyahu-leaves-office-in-2025", category: "israel_relations" as const },
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
        const probability = Math.round(parseFloat(marketDetails.outcomePrices[0]) * 100);
        
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
              marketSlug: marketDetails.slug, // Pass the slug for proper prediction lookup
              source: "polymarket",
              days: 7
            });
            
            if (historyResult.success) {
              console.log(`✓ Fetched ${historyResult.stored || 0} historical points`);
            }
          } catch (historyError) {
            console.error(`[POLYMARKET] Failed to fetch history: ${historyError}`);
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

// Store market history data
export const storeMarketHistory = mutation({
  args: {
    marketId: v.string(), // This is actually the clobTokenId for Polymarket
    marketSlug: v.optional(v.string()), // The actual market slug for finding the prediction
    historyData: v.array(v.object({
      p: v.number(), // probability
      t: v.number()  // timestamp
    })),
    source: v.union(v.literal("polymarket"), v.literal("kalshi"))
  },
  handler: async (ctx, args) => {
    // Find prediction by market slug in source URL
    const predictions = await ctx.db
      .query("predictions")
      .collect();
    
    let prediction = null;
    
    // If marketSlug provided, use that (more reliable)
    if (args.marketSlug) {
      for (const p of predictions) {
        if (p.sourceUrl && p.sourceUrl.includes(args.marketSlug)) {
          prediction = p;
          break;
        }
      }
    } else {
      // Fallback to old behavior for backward compatibility
      for (const p of predictions) {
        if (p.sourceUrl && p.sourceUrl.includes(args.marketId)) {
          prediction = p;
          break;
        }
      }
    }
    
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
    marketSlug: v.optional(v.string()), // Add marketSlug for better prediction lookup
    source: v.union(v.literal("polymarket"), v.literal("kalshi")),
    days: v.optional(v.number()) // Days of history to fetch, max 7 for Polymarket
  },
  handler: async (ctx, args): Promise<{ success: boolean; stored?: number; totalPoints?: number; error?: string }> => {
    "use node";
    
    const days = Math.min(args.days || 7, 7); // Polymarket has a 7-day max limit
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - (days * 24 * 60 * 60);
    
    try {
      if (args.source === "polymarket") {
        // Polymarket historical prices API - using higher granularity for better charts
        const params = new URLSearchParams({
          market: args.marketId,
          fidelity: "30", // 30 minutes gives us more data points for smoother charts
          startTs: startTs.toString(),
          endTs: endTs.toString()
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
        
        // Store historical data through mutation
        const storeResult: { success: boolean; stored: number } = await ctx.runMutation(api.predictions.storeMarketHistory, {
          marketId: args.marketId,
          marketSlug: args.marketSlug, // Pass the slug for better lookup
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

// Fetch historical data for all featured markets
export const fetchAllMarketHistory = action({
  args: {},
  handler: async (ctx): Promise<{ results: any[]; total: number }> => {
    "use node";
    
    console.log("Starting to fetch historical data for all featured markets...");
    
    // Get all active predictions to find their market IDs
    const predictions = await ctx.runQuery(api.predictions.getActive);
    const polymarketPredictions = predictions.filter((p: any) => p.source === "polymarket");
    
    const results = [];
    
    for (const prediction of polymarketPredictions) {
      try {
        // Extract market ID from the source URL
        // URLs are like: https://polymarket.com/event/will-iran-carry-out-a-strike-on-israel-on-4d1fb6bc-d08f-4fcc-b913-c0c59ab7eff5
        if (!prediction.sourceUrl) continue;
        
        const urlParts = prediction.sourceUrl.split('/');
        const slug = urlParts[urlParts.length - 1];
        
        // For now, we'll use the slug as the market ID since we need the actual numeric market ID
        // which requires fetching from the Polymarket API first
        console.log(`Fetching history for: ${prediction.title}`);
        
        // Extract clean slug (remove UUID if present)
        const cleanSlug = slug.includes('-') && slug.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/) 
          ? slug.substring(0, slug.lastIndexOf('-'))
          : slug;
        
        // First, get the actual market ID from the event
        const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${cleanSlug}`);
        if (eventResponse.ok) {
          const events = await eventResponse.json();
          if (events && events.length > 0 && events[0].markets && events[0].markets.length > 0) {
            const market = events[0].markets[0];
            
            // Fetch full market details to get clobTokenIds
            const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
            if (marketResponse.ok) {
              const marketDetails = await marketResponse.json();
              
              if (marketDetails.clobTokenIds) {
                const clobTokenIds = JSON.parse(marketDetails.clobTokenIds);
                const clobTokenId = clobTokenIds[0];
                
                const result: any = await ctx.runAction(api.predictions.fetchMarketHistory, {
                  marketId: clobTokenId,
                  marketSlug: marketDetails.slug, // Pass the slug for proper lookup
                  source: "polymarket",
                  days: 7 // Max allowed by Polymarket
                });
                
                results.push({ 
                  marketId: clobTokenId, 
                  slug: slug,
                  title: prediction.title,
                  ...result 
                });
                
                console.log(`✓ Fetched ${result.stored || 0} history points for ${prediction.title}`);
              }
            }
          }
        }
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching history for ${prediction.title}:`, error);
        results.push({ 
          title: prediction.title,
          success: false, 
          error: String(error) 
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`Completed fetching history: ${successful}/${results.length} successful`);
    
    return { results, total: results.length };
  },
});

// Seed initial markets - ONLY FOR INITIAL SETUP
export const seedInitialMarkets = action({
  args: {},
  handler: async (ctx): Promise<{ message: string; created: number; errors: string[] }> => {
    "use node";
    
    console.log("[SEED] Adding initial Polymarket markets to database...");
    
    let created = 0;
    const errors: string[] = [];
    
    // Only use hardcoded list for initial seeding
    for (const { slug, category } of FEATURED_POLYMARKET_MARKETS) {
      try {
        const eventUrl = `https://gamma-api.polymarket.com/events?slug=${slug}`;
        const eventResponse = await fetch(eventUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!eventResponse.ok) {
          throw new Error(`Event API returned ${eventResponse.status}`);
        }
        
        const events = await eventResponse.json();
        if (!events?.[0]?.markets?.[0]) {
          throw new Error("No markets found");
        }
        
        const market = events[0].markets[0];
        const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${market.id}`);
        
        if (!marketResponse.ok) {
          throw new Error(`Market API returned ${marketResponse.status}`);
        }
        
        const marketDetails = await marketResponse.json();
        const probability = Math.round(parseFloat(marketDetails.outcomePrices[0]) * 100);
        const sourceUrl = `https://polymarket.com/event/${marketDetails.slug}`;
        
        // Check if already exists
        const existing = await ctx.runQuery(api.predictions.getActive);
        const exists = existing.some((p: any) => p.sourceUrl === sourceUrl);
        
        if (!exists) {
          await ctx.runMutation(api.predictions.upsert, {
            category,
            title: marketDetails.question,
            description: marketDetails.description?.slice(0, 500),
            probability,
            source: "polymarket",
            sourceUrl,
            resolveDate: marketDetails.endDate ? new Date(marketDetails.endDate).getTime() : undefined,
          });
          created++;
          console.log(`✓ Created: ${marketDetails.question}`);
        } else {
          console.log(`- Skipped (exists): ${marketDetails.question}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        errors.push(`${slug}: ${String(error)}`);
        console.error(`[SEED] Error: ${slug} - ${error}`);
      }
    }
    
    return {
      message: `Seeded ${created} new markets`,
      created,
      errors
    };
  },
});