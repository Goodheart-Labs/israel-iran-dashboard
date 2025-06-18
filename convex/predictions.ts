import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { predictionCategories, predictionSources } from "./schema";

// Get all active predictions (approved only) - USED IN FRONTEND
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter(q => q.eq(q.field("isApproved"), true))
      .collect();
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

// Featured Polymarket markets to track - USED BY UPDATER
const FEATURED_POLYMARKET_MARKETS = [
  { slug: "will-iran-carry-out-a-strike-on-israel-on-4d1fb6bc-d08f-4fcc-b913-c0c59ab7eff5", category: "military_action" as const },
  { slug: "will-the-us-military-take-action-against-52e970f7-12f8-4b48-8c6f-9d03e6aa02d4", category: "military_action" as const },
  { slug: "will-iran-develop-a-nuclear-weapon-before-e659dcc4-23fe-4bb7-8c79-f614bc3e9c02", category: "nuclear_program" as const },
  { slug: "will-the-us-iran-nuclear-deal-be-restored", category: "nuclear_program" as const },
  { slug: "will-iran-close-the-strait-of-hormuz-in", category: "military_action" as const },
  { slug: "will-ali-khamenei-cease-to-be-the-supreme-cf30bc96-d95f-4d42-8f4b-c1b18bb088aa", category: "regime_stability" as const },
  { slug: "will-a-nuclear-weapon-be-detonated-in-an-a005bfcc-9241-456f-a61f-6bb3c8b2c8bb", category: "nuclear_program" as const },
  { slug: "will-benjamin-netanyahu-cease-to-be-the-49f9b891-e968-4fef-b93e-b91c3df92f14", category: "israel_relations" as const },
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

// Fetch and update Polymarket featured markets directly - USED BY CRON
export const fetchPolymarketDirectMarkets = action({
  args: {},
  handler: async (ctx): Promise<{ updated: number; errors: string[]; message: string }> => {
    "use node";
    
    console.log(`[POLYMARKET] Fetching ${FEATURED_POLYMARKET_MARKETS.length} featured markets...`);
    
    let updated = 0;
    const errors: string[] = [];
    
    for (const { slug, category } of FEATURED_POLYMARKET_MARKETS) {
      try {
        // Extract the actual slug from the full URL slug
        const cleanSlug = slug.split('-').slice(0, -5).join('-');
        const marketUrl = `https://gamma-api.polymarket.com/events?slug=${slug}`;
        
        const response = await fetch(marketUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const events = await response.json();
        
        if (!events || events.length === 0 || !events[0].markets || events[0].markets.length === 0) {
          throw new Error("No market data found");
        }
        
        const market = events[0].markets[0];
        const probability = Math.round(parseFloat(market.outcomePrices[0]) * 100);
        
        // Create prediction if it doesn't exist
        const sourceUrl = `https://polymarket.com/event/${slug}`;
        const existing = await ctx.runQuery(api.predictions.getActive);
        const exists = existing.some((p: any) => p.sourceUrl === sourceUrl);
        
        if (!exists) {
          await ctx.runMutation(api.predictions.upsert, {
            category,
            title: market.question,
            description: market.description?.slice(0, 500),
            probability,
            source: "polymarket",
            sourceUrl,
            resolveDate: market.endDate ? new Date(market.endDate).getTime() : undefined,
          });
        } else {
          await ctx.runMutation(api.predictions.updateMarketProbability, {
            sourceUrl,
            probability,
          });
        }
        
        updated++;
        console.log(`✓ Updated: ${market.question} - ${probability}%`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errors.push(`Error fetching ${slug}: ${String(error)}`);
      }
    }
    
    return { updated, errors, message: `Updated ${updated} Polymarket markets directly` };
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
      // Create new prediction (pending approval by default)
      const predictionId = await ctx.db.insert("predictions", {
        ...args,
        lastUpdated: now,
        isActive: true,
        isApproved: true, // Auto-approve for now
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

// Seed initial data - KEEP FOR SETUP
export const seedData = action({
  args: {},
  handler: async (ctx): Promise<{ message: string; updated: number; errors: string[] }> => {
    "use node";
    
    // Run the Polymarket fetch to seed initial data
    const result = await ctx.runAction(api.predictions.fetchPolymarketDirectMarkets, {});
    
    return {
      ...result,
      message: `Seeded database with Polymarket featured markets: ${result.message}`,
    };
  },
});