import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { predictionCategories, predictionSources } from "./schema";

// Get all active predictions (approved only)
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

// Get predictions by category (approved only)
export const getByCategory = query({
  args: { 
    category: v.union(...predictionCategories.map(c => v.literal(c)))
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("predictions")
      .withIndex("by_category_active", (q) => 
        q.eq("category", args.category).eq("isActive", true)
      )
      .filter(q => q.eq(q.field("isApproved"), true))
      .collect();
  },
});

// Get predictions grouped by category (approved only)
export const getGroupedByCategory = query({
  args: {},
  handler: async (ctx) => {
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter(q => q.eq(q.field("isApproved"), true))
      .collect();
    
    const grouped = predictionCategories.reduce((acc, category) => {
      acc[category] = predictions.filter(p => p.category === category);
      return acc;
    }, {} as Record<typeof predictionCategories[number], typeof predictions>);
    
    return grouped;
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

// Get time series data for category aggregation (H5N1 style)
export const getCategoryTimeSeries = query({
  args: { 
    category: v.union(...predictionCategories.map(c => v.literal(c))),
    days: v.optional(v.number()) // Default to 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Get all active predictions in this category (approved only)
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_category_active", (q) => 
        q.eq("category", args.category).eq("isActive", true)
      )
      .filter(q => q.eq(q.field("isApproved"), true))
      .collect();
    
    // Get historical data for all predictions in category
    const allHistory = [];
    for (const prediction of predictions) {
      const history = await ctx.db
        .query("predictionHistory")
        .withIndex("by_prediction_time", (q) => q.eq("predictionId", prediction._id))
        .filter(q => q.gte(q.field("timestamp"), cutoffTime))
        .collect();
      allHistory.push(...history.map(h => ({ ...h, title: prediction.title })));
    }
    
    // Sort by timestamp
    allHistory.sort((a, b) => a.timestamp - b.timestamp);
    
    return allHistory;
  },
});

// Calculate weighted geopolitical risk score
export const getGeopoliticalRiskScore = query({
  args: {},
  handler: async (ctx) => {
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter(q => q.eq(q.field("isApproved"), true))
      .collect();
    
    // Category weights for Iran geopolitical risk
    const categoryWeights = {
      military_action: 0.25,     // Direct conflict risk
      nuclear_program: 0.20,     // Nuclear escalation risk
      israel_relations: 0.15,    // Regional war risk
      regional_conflict: 0.15,   // Proxy conflict risk
      sanctions: 0.10,           // Economic pressure
      protests: 0.10,            // Internal instability
      regime_stability: 0.05,    // Regime change (inverted - higher stability = lower risk)
    };
    
    // Calculate weighted scores by category
    const categoryScores: Record<string, { score: number; count: number; weight: number }> = {};
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [category, weight] of Object.entries(categoryWeights)) {
      const categoryPredictions = predictions.filter(p => p.category === category);
      if (categoryPredictions.length > 0) {
        let categoryScore = categoryPredictions.reduce((sum, p) => sum + p.probability, 0) / categoryPredictions.length;
        
        // Invert regime_stability score (higher stability = lower risk)
        if (category === 'regime_stability') {
          categoryScore = 100 - categoryScore;
        }
        
        categoryScores[category] = {
          score: Math.round(categoryScore),
          count: categoryPredictions.length,
          weight
        };
        
        weightedSum += categoryScore * weight;
        totalWeight += weight;
      }
    }
    
    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    
    return {
      overallScore,
      categoryScores,
      totalPredictions: predictions.length,
      lastUpdated: Math.max(...predictions.map(p => p.lastUpdated), 0)
    };
  },
});

// Store market history data
export const storeMarketHistory = mutation({
  args: {
    marketId: v.string(),
    historyData: v.array(v.object({
      p: v.number(), // probability
      t: v.number()  // timestamp
    })),
    source: v.union(v.literal("polymarket"), v.literal("kalshi"))
  },
  handler: async (ctx, args) => {
    // Find prediction by market ID in source URL - try both slug and numeric ID formats
    let prediction = await ctx.db
      .query("predictions")
      .filter(q => q.eq(q.field("sourceUrl"), `https://polymarket.com/event/${args.marketId}`))
      .first();
    
    // If not found by numeric ID, look up the slug mapping
    if (!prediction) {
      const slugMap: Record<string, string> = {
        "551458": "iran-strike-on-israel-in-june",
        "532741": "us-military-action-against-iran-before-july", 
        "520927": "iran-nuke-in-2025",
        "521878": "us-x-iran-nuclear-deal-in-2025",
        "519695": "will-iran-close-the-strait-of-hormuz-in-2025",
        "514497": "khamenei-out-as-supreme-leader-of-iran-by-june-30",
        "516717": "nuclear-weapon-detonation-in-2025",
        "516721": "netanyahu-out-in-2025"
      };
      
      const slug = slugMap[args.marketId];
      if (slug) {
        prediction = await ctx.db
          .query("predictions")
          .filter(q => q.eq(q.field("sourceUrl"), `https://polymarket.com/event/${slug}`))
          .first();
      }
    }
    
    if (!prediction) {
      return { success: false, error: "Prediction not found", stored: 0 };
    }
    
    // Store historical data points
    let stored = 0;
    for (const point of args.historyData) {
      try {
        await ctx.db.insert("predictionHistory", {
          predictionId: prediction._id,
          probability: Math.round(point.p * 100), // Convert to percentage
          timestamp: point.t * 1000, // Convert to milliseconds
          source: args.source,
        });
        stored++;
      } catch {
        // Skip if already exists (duplicate key error)
        console.log("Skipping duplicate history point");
      }
    }
    
    return { success: true, stored };
  },
});

// Add a new prediction (admin only in future)
export const create = mutation({
  args: {
    category: v.union(...predictionCategories.map(c => v.literal(c))),
    title: v.string(),
    description: v.optional(v.string()),
    probability: v.number(),
    source: v.union(...predictionSources.map(s => v.literal(s))),
    sourceUrl: v.optional(v.string()),
    resolveDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const prediction = await ctx.db.insert("predictions", {
      ...args,
      lastUpdated: Date.now(),
      isActive: true,
    });
    return prediction;
  },
});

// Update prediction probability
export const updateProbability = mutation({
  args: { 
    id: v.id("predictions"),
    probability: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Prediction not found");
    
    await ctx.db.patch(args.id, {
      previousProbability: existing.probability,
      probability: args.probability,
      lastUpdated: Date.now(),
    });
  },
});

// Upsert prediction - create or update based on source URL
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
        isApproved: false, // Require admin approval for new predictions
        isRejected: false,
      });
      
      // Store initial historical data point
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

// Helper to categorize predictions based on keywords
function categorizePrediction(title: string, description: string = ""): typeof predictionCategories[number] | null {
  const text = (title + " " + description).toLowerCase();
  
  if (text.match(/iran.*military|military.*iran|strike|attack|invasion|war|conflict/)) {
    return "military_action";
  }
  if (text.match(/iran.*nuclear|nuclear.*iran|enrichment|uranium|iaea|weapons/)) {
    return "nuclear_program";
  }
  if (text.match(/iran.*sanction|sanction.*iran|embargo|economic pressure/)) {
    return "sanctions";
  }
  if (text.match(/hezbollah|hamas|proxy|syria|yemen|houthis|lebanon|gaza/)) {
    return "regional_conflict";
  }
  if (text.match(/iran.*israel|israel.*iran|idf|mossad|normalization/)) {
    return "israel_relations";
  }
  if (text.match(/iran.*protest|protest.*iran|uprising|demonstration|mahsa amini/)) {
    return "protests";
  }
  if (text.match(/iran.*regime|regime.*iran|ayatollah|government|stability|collapse/)) {
    return "regime_stability";
  }
  
  return null;
}

// Fetch from Manifold Markets
export const fetchManifoldMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    const searchTerms = [
      "Iran military",
      "Iran nuclear",
      "Iran sanctions",
      "Iran Israel",
      "Hezbollah",
      "Iran protests",
      "Iran regime"
    ];
    
    const allMarkets = [];
    
    for (const term of searchTerms) {
      try {
        const response = await fetch(
          `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&limit=50`
        );
        const markets = await response.json();
        allMarkets.push(...markets);
      } catch (error) {
        console.error(`Error fetching Manifold markets for "${term}":`, error);
      }
    }
    
    // Deduplicate by ID
    const uniqueMarkets = Array.from(
      new Map(allMarkets.map(m => [m.id, m])).values()
    );
    
    // Process and save relevant markets
    let saved = 0;
    for (const market of uniqueMarkets) {
      const category = categorizePrediction(market.question, market.description || "");
      if (category && market.probability !== undefined) {
        try {
          await ctx.runMutation(api.predictions.upsert, {
            category,
            title: market.question,
            description: market.description?.slice(0, 500),
            probability: Math.round(market.probability * 100),
            source: "manifold",
            sourceUrl: market.url,
            resolveDate: market.closeTime,
          });
          saved++;
        } catch (error) {
          console.error("Error saving Manifold market:", error);
        }
      }
    }
    
    return { fetched: uniqueMarkets.length, saved };
  },
});

// Fetch from Metaculus
export const fetchMetaculusQuestions = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    const searchTerms = [
      "Iran military",
      "Iran nuclear",
      "Iran sanctions", 
      "Iran Israel",
      "Iran regime"
    ];
    
    const allQuestions = [];
    
    for (const term of searchTerms) {
      try {
        const response = await fetch(
          `https://www.metaculus.com/api2/questions/?search=${encodeURIComponent(term)}&status=open&limit=50`
        );
        const data = await response.json();
        if (data.results) {
          allQuestions.push(...data.results);
        }
      } catch (error) {
        console.error(`Error fetching Metaculus questions for "${term}":`, error);
      }
    }
    
    // Deduplicate by ID
    const uniqueQuestions = Array.from(
      new Map(allQuestions.map(q => [q.id, q])).values()
    );
    
    // Process and save relevant questions
    let saved = 0;
    for (const question of uniqueQuestions) {
      const category = categorizePrediction(question.title, "");
      if (category && question.community_prediction?.full?.q2 !== undefined) {
        try {
          await ctx.runMutation(api.predictions.upsert, {
            category,
            title: question.title,
            description: question.description?.slice(0, 500),
            probability: Math.round(question.community_prediction.full.q2 * 100),
            source: "metaculus",
            sourceUrl: `https://www.metaculus.com/questions/${question.id}`,
            resolveDate: question.resolve_time ? new Date(question.resolve_time).getTime() : undefined,
          });
          saved++;
        } catch (error) {
          console.error("Error saving Metaculus question:", error);
        }
      }
    }
    
    return { fetched: uniqueQuestions.length, saved };
  },
});

// Fetch historical data for a specific market
export const fetchMarketHistory = action({
  args: { 
    marketId: v.string(),
    source: v.union(v.literal("polymarket"), v.literal("kalshi")),
    days: v.optional(v.number()) // Days of history to fetch, default 30
  },
  handler: async (ctx, args): Promise<{ success: boolean; stored?: number; totalPoints?: number; error?: string }> => {
    "use node";
    
    const days = args.days || 30;
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - (days * 24 * 60 * 60);
    
    try {
      if (args.source === "polymarket") {
        // Polymarket historical prices API
        const url = `https://clob.polymarket.com/prices-history?market=${args.marketId}&startTs=${startTs}&endTs=${endTs}&interval=1h`;
        console.log(`Fetching from URL: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Polymarket API error: ${response.status} - ${errorText}`);
          return { success: false, error: `API error: ${response.status} - ${errorText}` };
        }
        
        const data = await response.json();
        
        // Actions can't access db directly, need to use mutations
        // Store historical data through mutation
        const storeResult: { success: boolean; stored: number } = await ctx.runMutation(api.predictions.storeMarketHistory, {
          marketId: args.marketId,
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
    
    const featuredMarkets = [
      { id: "551458", source: "polymarket" as const }, // iran-strike-on-israel-in-june
      { id: "532741", source: "polymarket" as const }, // us-military-action-against-iran-before-july
      { id: "520927", source: "polymarket" as const }, // iran-nuke-in-2025
      { id: "521878", source: "polymarket" as const }, // us-x-iran-nuclear-deal-in-2025
      { id: "519695", source: "polymarket" as const }, // will-iran-close-the-strait-of-hormuz-in-2025
      { id: "514497", source: "polymarket" as const }, // khamenei-out-as-supreme-leader-of-iran-by-june-30
      { id: "516717", source: "polymarket" as const }, // nuclear-weapon-detonation-in-2025
      { id: "516721", source: "polymarket" as const }  // netanyahu-out-in-2025
    ];
    
    const results = [];
    
    for (const market of featuredMarkets) {
      try {
        const result: any = await ctx.runAction(api.predictions.fetchMarketHistory, {
          marketId: market.id,
          source: market.source,
          days: 7
        });
        results.push({ marketId: market.id, ...result });
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching history for ${market.id}:`, error);
        results.push({ marketId: market.id, success: false, error: String(error) });
      }
    }
    
    return { results, total: results.length };
  },
});

// Get fresh historical data from Polymarket (H5N1 approach - no storage)
export const getPolymarketHistoricalData = action({
  args: { slug: v.string() },
  handler: async (_ctx, args) => {
    "use node";
    
    try {
      // Step 1: Get market metadata (H5N1 approach)
      const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${args.slug}`, {
        headers: { Accept: "application/json" }
      });
      
      if (!eventResponse.ok) {
        throw new Error("Event API failed");
      }
      
      const events = await eventResponse.json();
      if (!events?.[0]) {
        throw new Error("No events found for this slug");
      }
      
      const event = events[0];
      if (!event.markets?.[0]) {
        throw new Error("No markets found for this event");
      }
      
      // Step 2: Get market details
      const marketId = event.markets[0].id;
      const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
        headers: { Accept: "application/json" }
      });
      
      if (!marketResponse.ok) {
        throw new Error("Market API failed");
      }
      
      const marketData = await marketResponse.json();
      
      // Step 3: Get clobTokenId for historical data
      const clobTokenIds = JSON.parse(marketData.clobTokenIds);
      const clobTokenId = clobTokenIds[0];
      
      // Step 4: Fetch historical data using CLOB API (H5N1 approach)
      const historyUrl = new URL("https://clob.polymarket.com/prices-history");
      const params = new URLSearchParams({
        market: clobTokenId,
        fidelity: "60" // 60-minute intervals like H5N1
      });
      
      // For active markets, use interval parameter (H5N1 exact approach)
      if (!marketData.closed) {
        params.set("interval", "1m"); // This gets 1 month of data
      } else {
        // Use start/end timestamps for closed markets
        params.set("startTs", Math.floor(new Date(marketData.startDate).getTime() / 1000).toString());
        params.set("endTs", Math.floor(new Date(marketData.endDate).getTime() / 1000).toString());
      }
      
      historyUrl.search = params.toString();
      
      console.log("Fetching history from:", historyUrl.toString());
      
      const historyResponse = await fetch(historyUrl, {
        headers: { Accept: "application/json" }
      });
      
      if (!historyResponse.ok) {
        throw new Error("Timeseries API failed");
      }
      
      const historyData = await historyResponse.json();
      
      // Transform data to our format (H5N1 approach)
      if (!historyData?.history) {
        return [];
      }
      
      return historyData.history.map((point: any) => ({
        date: new Date(point.t * 1000).toISOString(),
        probability: Math.round(point.p * 100)
      }));
      
    } catch (error) {
      console.error("Error fetching Polymarket data:", error);
      // Return empty array on error (H5N1 approach)
      return [];
    }
  },
});

// Fetch specific markets directly from Polymarket (H5N1 approach)
export const fetchPolymarketDirectMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    // Specific Iran-related market slugs we want to track
    const targetSlugs = [
      "iran-strike-on-israel-in-june",
      "us-military-action-against-iran-before-july", 
      "iran-nuke-in-2025",
      "us-x-iran-nuclear-deal-in-2025",
      "will-iran-close-the-strait-of-hormuz-in-2025",
      "khamenei-out-as-supreme-leader-of-iran-by-june-30",
      "nuclear-weapon-detonation-in-2025",
      "netanyahu-out-in-2025"
    ];
    
    let updated = 0;
    const errors = [];
    
    for (const slug of targetSlugs) {
      try {
        // Fetch event data by slug (H5N1 approach)
        const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
        
        if (eventResponse.ok) {
          const events = await eventResponse.json();
          
          if (events && events.length > 0) {
            const event = events[0];
            const market = event.markets?.[0];
            
            if (market && market.outcomePrices) {
              // Parse the JSON string to get the array of prices
              const pricesArray = JSON.parse(market.outcomePrices);
              const currentProbability = Math.round(parseFloat(pricesArray[0]) * 100);
              
              // Update our database with current probability
              const result: any = await ctx.runMutation(api.predictions.updateMarketProbability, {
                sourceUrl: `https://polymarket.com/event/${slug}`,
                probability: currentProbability
              });
              
              if (result.success) {
                updated++;
                console.log(`Updated ${slug}: ${currentProbability}%`);
              } else {
                errors.push(`Failed to update ${slug}: ${result.error}`);
              }
            }
          }
        } else {
          errors.push(`API error for ${slug}: ${eventResponse.status}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errors.push(`Error fetching ${slug}: ${String(error)}`);
      }
    }
    
    return { updated, errors, message: `Updated ${updated} Polymarket markets directly` };
  },
});

// Fetch from Polymarket (public data only) - LEGACY
export const fetchPolymarketMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    try {
      // Polymarket uses REST API, not GraphQL
      const response = await fetch("https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100");
      
      const markets = await response.json();
      
      // Process relevant markets
      let saved = 0;
      for (const market of markets || []) {
        // Filter for Iran-related markets
        if (market.question && market.question.toLowerCase().includes('iran')) {
          const category = categorizePrediction(market.question, market.description || "");
          if (category && market.outcomePrices && market.outcomePrices.length > 0) {
            try {
              await ctx.runMutation(api.predictions.upsert, {
                category,
                title: market.question,
                description: market.description?.slice(0, 500),
                probability: Math.round(parseFloat(market.outcomePrices[0]) * 100),
                source: "polymarket",
                sourceUrl: `https://polymarket.com/market/${market.slug || market.id}`,
                resolveDate: market.endDate ? new Date(market.endDate).getTime() : undefined,
              });
              saved++;
            } catch (error) {
              console.error("Error saving Polymarket market:", error);
            }
          }
        }
      }
      
      return { fetched: markets.length, saved };
    } catch (error) {
      console.error("Error fetching Polymarket markets:", error);
      return { fetched: 0, saved: 0, error: String(error) };
    }
  },
});

// Fetch markets from Adjacent News API
export const fetchAdjacentNewsMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    try {
      // Use the correct Adjacent News endpoint with API key
      const response = await fetch("https://api.data.adj.news/api/markets?limit=100", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.ADJACENT_NEWS_API_KEY}`
        }
      });
      
      if (!response.ok) {
        console.error(`Adjacent News API error: ${response.status}`);
        return { savedFromAdjacent: 0, error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      const markets = data.data || data.markets || data || []; // Handle different response formats
      
      let savedFromAdjacent = 0;
      
      for (const market of markets) {
        // Map Adjacent News market data to our format
        const category = categorizePrediction(market.title || market.question || "", market.description || "");
        
        if (category && market.probability !== undefined) {
          try {
            // Convert probability format if needed (Adjacent News might use different scales)
            let probability = market.probability;
            if (probability <= 1) {
              probability = Math.round(probability * 100); // Convert 0-1 to 0-100
            } else if (probability > 100) {
              probability = Math.min(100, Math.round(probability / 100)); // Handle basis points
            }
            
            await ctx.runMutation(api.predictions.upsert, {
              category,
              title: market.title || market.question || "Unknown Market",
              description: market.description?.slice(0, 500),
              probability: Math.round(probability),
              source: "adjacent",
              sourceUrl: market.url || market.market_url || `https://api.data.adj.news/api/markets/${market.id}`,
              resolveDate: market.resolve_date ? new Date(market.resolve_date).getTime() : undefined,
            });
            savedFromAdjacent++;
          } catch (error) {
            console.error("Error saving Adjacent News market:", error);
          }
        }
      }
      
      return { savedFromAdjacent, totalFetched: markets.length };
      
    } catch (error) {
      console.error("Error fetching Adjacent News markets:", error);
      return { savedFromAdjacent: 0, error: String(error) };
    }
  },
});

// Enhanced news-based market search using Adjacent News semantic search
export const fetchNewsBasedMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    const iranKeywords = [
      "Iran military strike attack",
      "Iran nuclear enrichment uranium", 
      "Iran sanctions economic pressure",
      "Iran Israel conflict tension",
      "Hezbollah Hamas proxy forces",
      "Iran protests uprising demonstrations",
      "Iran regime ayatollah stability",
      "IAEA Iran nuclear deal"
    ];
    
    let savedFromNews = 0;
    
    // Try Adjacent News semantic search first
    try {
      for (const searchTerm of iranKeywords) {
        const response = await fetch(
          `https://api.data.adj.news/api/search?q=${encodeURIComponent(searchTerm)}&limit=20`,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.ADJACENT_NEWS_API_KEY}`
            }
          }
        );
        
        if (response.ok) {
          const searchData = await response.json();
          const markets = searchData.markets || searchData.results || [];
          
          for (const market of markets) {
            const category = categorizePrediction(market.title || market.question || "", market.description || "");
            if (category && market.probability !== undefined) {
              try {
                let probability = market.probability;
                if (probability <= 1) {
                  probability = Math.round(probability * 100);
                } else if (probability > 100) {
                  probability = Math.min(100, Math.round(probability / 100));
                }
                
                await ctx.runMutation(api.predictions.upsert, {
                  category,
                  title: market.title || market.question || "Unknown Market",
                  description: market.description?.slice(0, 500),
                  probability: Math.round(probability),
                  source: "adjacent",
                  sourceUrl: market.url || market.market_url || `https://api.data.adj.news/api/markets/${market.id}`,
                  resolveDate: market.resolve_date ? new Date(market.resolve_date).getTime() : undefined,
                });
                savedFromNews++;
              } catch (error) {
                console.error("Error saving Adjacent News search result:", error);
              }
            }
          }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error("Error with Adjacent News semantic search:", error);
    }
    
    // Fallback to direct platform searches if Adjacent News doesn't work
    if (savedFromNews === 0) {
      console.log("Falling back to direct platform searches...");
      
      for (const keyword of ["Iran attack", "Iran nuclear", "Iran sanctions", "Iran protests"]) {
        try {
          // Search Manifold as fallback
          const manifoldResponse = await fetch(
            `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(keyword)}&limit=10&sort=newest`
          );
          
          if (manifoldResponse.ok) {
            const manifoldMarkets = await manifoldResponse.json();
            
            for (const market of manifoldMarkets.slice(0, 5)) { // Limit to avoid spam
              const category = categorizePrediction(market.question, market.description || "");
              if (category && market.probability !== undefined) {
                try {
                  await ctx.runMutation(api.predictions.upsert, {
                    category,
                    title: market.question,
                    description: market.description?.slice(0, 500),
                    probability: Math.round(market.probability * 100),
                    source: "manifold",
                    sourceUrl: market.url,
                    resolveDate: market.closeTime,
                  });
                  savedFromNews++;
                } catch (error) {
                  console.error("Error saving fallback Manifold market:", error);
                }
              }
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error with fallback search for "${keyword}":`, error);
        }
      }
    }
    
    return { savedFromNews, searchedKeywords: iranKeywords.length };
  },
});

// Master fetch function to get data from all sources
export const fetchAllPredictions = action({
  args: {},
  handler: async (ctx): Promise<{
    manifold: { fetched: number; saved: number; error?: any };
    metaculus: { fetched: number; saved: number; error?: any };
    polymarket: { fetched: number; saved: number; error?: any };
    adjacentNews: { savedFromAdjacent: number; totalFetched: number; error?: any };
    newsBased: { savedFromNews: number; searchedKeywords: number; error?: any };
  }> => {
    "use node";
    
    const results = await Promise.allSettled([
      ctx.runAction(api.predictions.fetchManifoldMarkets, {}),
      ctx.runAction(api.predictions.fetchMetaculusQuestions, {}),
      ctx.runAction(api.predictions.fetchPolymarketMarkets, {}),
      ctx.runAction(api.predictions.fetchAdjacentNewsMarkets, {}),
      ctx.runAction(api.predictions.fetchNewsBasedMarkets, {}),
    ]);
    
    const summary = {
      manifold: results[0].status === "fulfilled" ? results[0].value : { fetched: 0, saved: 0, error: results[0].reason },
      metaculus: results[1].status === "fulfilled" ? results[1].value : { fetched: 0, saved: 0, error: results[1].reason },
      polymarket: results[2].status === "fulfilled" ? results[2].value : { fetched: 0, saved: 0, error: results[2].reason },
      adjacentNews: results[3].status === "fulfilled" 
        ? { ...results[3].value, totalFetched: results[3].value.totalFetched || 0 }
        : { savedFromAdjacent: 0, totalFetched: 0, error: results[3].reason },
      newsBased: results[4].status === "fulfilled" ? results[4].value : { savedFromNews: 0, searchedKeywords: 0, error: results[4].reason },
    };
    
    return summary;
  },
});

// Admin: Approve a prediction
export const approvePrediction = mutation({
  args: { 
    id: v.id("predictions"),
  },
  handler: async (ctx, args) => {
    
    await ctx.db.patch(args.id, {
      isApproved: true,
      isRejected: false,
    });
  },
});

// Admin: Reject a prediction
export const rejectPrediction = mutation({
  args: { 
    id: v.id("predictions"),
  },
  handler: async (ctx, args) => {
    
    await ctx.db.patch(args.id, {
      isApproved: false,
      isRejected: true,
    });
  },
});

// Admin: Get pending predictions for review
export const getPendingPredictions = query({
  args: {},
  handler: async (ctx) => {
    
    return await ctx.db
      .query("predictions")
      .filter(q => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.or(
            q.eq(q.field("isApproved"), undefined),
            q.eq(q.field("isApproved"), false)
          ),
          q.neq(q.field("isRejected"), true)
        )
      )
      .collect();
  },
});

// Admin: Get all predictions for management
export const getAllPredictionsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    
    return await ctx.db
      .query("predictions")
      .collect();
  },
});

// Admin: Bulk approve predictions
export const bulkApprovePredictions = mutation({
  args: { 
    ids: v.array(v.id("predictions")),
  },
  handler: async (ctx, args) => {
    
    for (const id of args.ids) {
      await ctx.db.patch(id, {
        isApproved: true,
        isRejected: false,
      });
    }
  },
});

// Admin: Fix invalid prediction probabilities
export const fixInvalidProbabilities = mutation({
  args: {},
  handler: async (ctx) => {
    
    const allPredictions = await ctx.db.query("predictions").collect();
    let fixed = 0;
    
    for (const prediction of allPredictions) {
      if (prediction.probability > 100) {
        // Convert probability to percentage if it's > 100 (likely stored as basis points)
        const newProbability = Math.min(100, Math.round(prediction.probability / 100));
        await ctx.db.patch(prediction._id, {
          probability: newProbability,
        });
        fixed++;
      }
    }
    
    return { fixed };
  },
});

// Admin: Test Adjacent News API connection
export const testAdjacentNewsConnection = action({
  args: {},
  handler: async (_ctx) => {
    "use node";
    
    try {
      console.log("Testing Adjacent News API connection...");
      
      // Test basic markets endpoint
      const marketsResponse = await fetch("https://api.data.adj.news/api/markets?limit=5", {
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      const marketsSuccess = marketsResponse.ok;
      const marketsStatus = marketsResponse.status;
      let marketsData = null;
      
      if (marketsSuccess) {
        marketsData = await marketsResponse.json();
      }
      
      // Test search endpoint
      const searchResponse = await fetch("https://api.data.adj.news/api/search?q=US%20election&limit=3", {
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      const searchSuccess = searchResponse.ok;
      const searchStatus = searchResponse.status;
      let searchData = null;
      
      if (searchSuccess) {
        searchData = await searchResponse.json();
      }
      
      return {
        marketsEndpoint: {
          success: marketsSuccess,
          status: marketsStatus,
          sampleData: marketsData ? {
            totalResults: marketsData.length || marketsData.markets?.length || 0,
            firstMarket: marketsData[0] || marketsData.markets?.[0] || null
          } : null
        },
        searchEndpoint: {
          success: searchSuccess,
          status: searchStatus,
          sampleData: searchData ? {
            totalResults: searchData.length || searchData.results?.length || 0,
            firstResult: searchData[0] || searchData.results?.[0] || null
          } : null
        },
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error("Error testing Adjacent News connection:", error);
      return {
        error: String(error),
        timestamp: Date.now()
      };
    }
  },
});

// Get data point counts for each market
export const getMarketDataCounts = query({
  args: {},
  handler: async (ctx) => {
    const featuredUrls = [
      "https://www.metaculus.com/questions/31298/1000-deaths-due-to-israel-iran-conflict-in-2025/",
      "https://polymarket.com/event/iran-strike-on-israel-in-june",
      "https://polymarket.com/event/us-military-action-against-iran-before-july",
      "https://polymarket.com/event/iran-nuke-in-2025",
      "https://polymarket.com/event/us-x-iran-nuclear-deal-in-2025",
      "https://kalshi.com/markets/kxusairanagreement/us-iran-nuclear-deal",
      "https://polymarket.com/event/will-iran-close-the-strait-of-hormuz-in-2025",
      "https://polymarket.com/event/khamenei-out-as-supreme-leader-of-iran-by-june-30",
      "https://polymarket.com/event/nuclear-weapon-detonation-in-2025",
      "https://polymarket.com/event/netanyahu-out-in-2025"
    ];

    const counts = [];
    for (const url of featuredUrls) {
      const prediction = await ctx.db
        .query("predictions")
        .filter(q => q.eq(q.field("sourceUrl"), url))
        .first();
      
      if (prediction) {
        const historyCount = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction", (q) => q.eq("predictionId", prediction._id))
          .collect();
        
        counts.push({
          title: prediction.title,
          source: prediction.source,
          historyCount: historyCount.length,
          probability: prediction.probability
        });
      }
    }
    
    return counts;
  },
});

// Get featured predictions for homepage
export const getFeaturedPredictions = query({
  args: {},
  handler: async (ctx) => {
    // List of featured market URLs
    const featuredUrls = [
      "https://www.metaculus.com/questions/31298/1000-deaths-due-to-israel-iran-conflict-in-2025/",
      "https://polymarket.com/event/iran-strike-on-israel-in-june",
      "https://polymarket.com/event/us-military-action-against-iran-before-july",
      "https://polymarket.com/event/iran-nuke-in-2025",
      "https://polymarket.com/event/us-x-iran-nuclear-deal-in-2025",
      "https://kalshi.com/markets/kxusairanagreement/us-iran-nuclear-deal",
      "https://polymarket.com/event/will-iran-close-the-strait-of-hormuz-in-2025",
      "https://polymarket.com/event/khamenei-out-as-supreme-leader-of-iran-by-june-30",
      "https://polymarket.com/event/nuclear-weapon-detonation-in-2025",
      "https://polymarket.com/event/netanyahu-out-in-2025"
    ];

    const predictions = [];
    for (const url of featuredUrls) {
      // Try to find by exact URL or partial match
      const prediction = await ctx.db
        .query("predictions")
        .filter(q => q.or(
          q.eq(q.field("sourceUrl"), url),
          q.eq(q.field("sourceUrl"), url.split("?")[0]) // Without query params
        ))
        .first();
      
      if (prediction) {
        // Get historical data for the prediction
        const history = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => q.eq("predictionId", prediction._id))
          .collect();
        
        predictions.push({
          ...prediction,
          history: history.map(h => ({
            timestamp: h.timestamp,
            probability: h.probability
          }))
        });
      }
    }
    
    return predictions;
  },
});

// Clear all predictions and history (admin only) - paginated for large datasets
export const clearAllPredictions = mutation({
  args: {},
  handler: async (ctx) => {
    let deletedPredictions = 0;
    let deletedHistory = 0;
    
    // Clear predictions in batches
    let predictions = await ctx.db.query("predictions").take(100);
    while (predictions.length > 0) {
      for (const prediction of predictions) {
        await ctx.db.delete(prediction._id);
        deletedPredictions++;
      }
      predictions = await ctx.db.query("predictions").take(100);
    }
    
    // Clear history in batches  
    let history = await ctx.db.query("predictionHistory").take(100);
    while (history.length > 0) {
      for (const historyItem of history) {
        await ctx.db.delete(historyItem._id);
        deletedHistory++;
      }
      history = await ctx.db.query("predictionHistory").take(100);
    }
    
    return { 
      deletedPredictions,
      deletedHistory 
    };
  },
});

// Clear only markets with minimal historical data (< 10 points)
export const clearMinimalDataMarkets = mutation({
  args: {},
  handler: async (ctx) => {
    const predictions = await ctx.db.query("predictions").take(50);
    let deletedPredictions = 0;
    let deletedHistory = 0;
    
    for (const prediction of predictions) {
      const historyCount = await ctx.db
        .query("predictionHistory")
        .withIndex("by_prediction", (q) => q.eq("predictionId", prediction._id))
        .collect();
      
      // Delete predictions with very few historical data points
      if (historyCount.length < 10) {
        // Delete the history first
        for (const hist of historyCount) {
          await ctx.db.delete(hist._id);
          deletedHistory++;
        }
        
        // Delete the prediction
        await ctx.db.delete(prediction._id);
        deletedPredictions++;
      }
    }
    
    return { deletedPredictions, deletedHistory };
  },
});

// Fetch real market data from Polymarket to get current prices and market IDs
export const fetchRealMarketData = action({
  args: {},
  handler: async (_ctx) => {
    "use node";
    
    const featuredSlugs = [
      "iran-strike-on-israel-in-june",
      "us-military-action-against-iran-before-july", 
      "iran-nuke-in-2025",
      "us-x-iran-nuclear-deal-in-2025",
      "will-iran-close-the-strait-of-hormuz-in-2025",
      "khamenei-out-as-supreme-leader-of-iran-by-june-30",
      "nuclear-weapon-detonation-in-2025",
      "netanyahu-out-in-2025"
    ];
    
    const results = [];
    
    for (const slug of featuredSlugs) {
      try {
        // Fetch market data from Polymarket Gamma API
        const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.length > 0) {
            const event = data[0];
            const market = event.markets?.[0];
            
            if (market) {
              results.push({
                slug,
                marketId: market.id,
                title: event.title,
                description: event.description,
                currentPrice: market.outcomePrices?.[0] || 0,
                probability: Math.round((market.outcomePrices?.[0] || 0) * 100),
                endDate: event.endDate
              });
            }
          }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`Error fetching ${slug}:`, error);
        results.push({ slug, error: String(error) });
      }
    }
    
    return { results, total: results.length };
  },
});

// Update featured markets with real current probabilities from Adjacent News API
export const updateRealMarketProbabilities = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    let updated = 0;
    const errors = [];
    
    try {
      // Fetch Iran-related markets from Adjacent News
      const response = await fetch("https://api.data.adj.news/api/search/query?q=Iran", {
        headers: {
          "Authorization": `Bearer ${process.env.ADJACENT_NEWS_API_KEY}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const markets = data.data || [];
        
        // Map real market data to our featured markets
        const marketMappings = [
          {
            sourceUrl: "https://www.metaculus.com/questions/31298/1000-deaths-due-to-israel-iran-conflict-in-2025/",
            searchTerm: "1000-deaths-due-to-israel-iran-conflict-in-2025"
          },
          {
            sourceUrl: "https://polymarket.com/event/iran-strike-on-israel-in-june", 
            searchTerm: "iran-strike-on-israel-in-june"
          },
          {
            sourceUrl: "https://polymarket.com/event/iran-nuke-in-2025",
            searchTerm: "will-iran-possess-a-nuclear-weapon-before-2026" // Using closest match
          },
          {
            sourceUrl: "https://polymarket.com/event/us-x-iran-nuclear-deal-in-2025",
            searchTerm: "us-iran-nuclear-deal-before-sep-2025"
          }
        ];
        
        for (const market of markets) {
          // Find matching markets by slug
          for (const mapping of marketMappings) {
            if (market.market_slug === mapping.searchTerm) {
              const probability = Math.round(market.probability || 0);
              
              const result: any = await ctx.runMutation(api.predictions.updateMarketProbability, {
                sourceUrl: mapping.sourceUrl,
                probability
              });
              
              if (result.success) {
                updated++;
              } else {
                errors.push(`Failed to update ${mapping.sourceUrl}: ${result.error}`);
              }
            }
          }
        }
      }
    } catch (error) {
      errors.push(`Adjacent News API: ${String(error)}`);
    }
    
    return { updated, errors, message: `Updated ${updated} markets with real probabilities` };
  },
});

// Fetch real historical data from Adjacent News API using direct market IDs
export const fetchRealHistoricalData = action({
  args: {},
  handler: async (ctx): Promise<{ updated: number; errors: string[]; message: string }> => {
    "use node";
    
    let updated = 0;
    const errors = [];
    
    // Direct market ID mappings based on Adjacent News API structure
    const marketMappings = [
      {
        sourceUrl: "https://polymarket.com/event/iran-strike-on-israel-in-june",
        marketId: "polymarket_0xb0ede82fa0c5604bf0dccd32d8ba909f5cebe1c594357754cb18a74d365f6e5b"
      },
      {
        sourceUrl: "https://polymarket.com/event/us-military-action-against-iran-before-july",
        marketId: "polymarket_0x532741" // Using numeric ID as fallback
      },
      {
        sourceUrl: "https://polymarket.com/event/iran-nuke-in-2025",
        marketId: "polymarket_0x520927"
      },
      {
        sourceUrl: "https://polymarket.com/event/nuclear-weapon-detonation-in-2025",
        marketId: "polymarket_0x516717"
      }
    ];
    
    for (const mapping of marketMappings) {
      try {
        console.log(`Fetching history for ${mapping.sourceUrl} with market ID: ${mapping.marketId}`);
        
        // Fetch historical data directly using market ID (hourly intervals for more granular data)
        const historyResponse = await fetch(
          `https://api.data.adj.news/api/trade/price-history?market_id=${mapping.marketId}&interval=1h`,
          {
            headers: {
              "Authorization": `Bearer ${process.env.ADJACENT_NEWS_API_KEY}`
            }
          }
        );
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const dataPoints = historyData.data || [];
          
          console.log(`Found ${dataPoints.length} historical points for ${mapping.sourceUrl}`);
          
          if (dataPoints.length > 0) {
            // Store historical data through mutation
            const result: any = await ctx.runMutation(api.predictions.storeRealHistoricalData, {
              sourceUrl: mapping.sourceUrl,
              historyData: dataPoints.map((point: any) => ({
                price: point.price,
                timestamp: point.timestamp
              }))
            });
            
            if (result.success) {
              updated++;
              console.log(`Successfully stored ${result.stored} historical points for ${mapping.sourceUrl}`);
            } else {
              errors.push(`Failed to store history for ${mapping.sourceUrl}: ${result.error}`);
            }
          } else {
            console.log(`No historical data available for ${mapping.sourceUrl}`);
          }
        } else {
          const errorText = await historyResponse.text();
          errors.push(`API error for ${mapping.sourceUrl}: ${historyResponse.status} - ${errorText}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        errors.push(`Error fetching history for ${mapping.sourceUrl}: ${String(error)}`);
      }
    }
    
    return { updated, errors, message: `Updated historical data for ${updated} markets` };
  },
});

// Store real historical data for a market
export const storeRealHistoricalData = mutation({
  args: {
    sourceUrl: v.string(),
    historyData: v.array(v.object({
      price: v.number(),
      timestamp: v.number()
    }))
  },
  handler: async (ctx, args) => {
    const prediction = await ctx.db
      .query("predictions")
      .filter(q => q.eq(q.field("sourceUrl"), args.sourceUrl))
      .first();
    
    if (!prediction) {
      return { success: false, error: "Prediction not found" };
    }
    
    // Clear existing historical data to avoid duplicates
    const existingHistory = await ctx.db
      .query("predictionHistory")
      .filter(q => q.eq(q.field("predictionId"), prediction._id))
      .collect();
    
    for (const hist of existingHistory) {
      await ctx.db.delete(hist._id);
    }
    
    // Store real historical data
    let stored = 0;
    for (const point of args.historyData) {
      await ctx.db.insert("predictionHistory", {
        predictionId: prediction._id,
        probability: Math.round(point.price * 100), // Convert to percentage
        timestamp: point.timestamp * 1000, // Convert to milliseconds
        source: prediction.source,
      });
      stored++;
    }
    
    return { success: true, stored };
  },
});

// Update market probability by source URL
export const updateMarketProbability = mutation({
  args: {
    sourceUrl: v.string(),
    probability: v.number()
  },
  handler: async (ctx, args) => {
    const prediction = await ctx.db
      .query("predictions")
      .filter(q => q.eq(q.field("sourceUrl"), args.sourceUrl))
      .first();
    
    if (prediction) {
      await ctx.db.patch(prediction._id, {
        previousProbability: prediction.probability,
        probability: args.probability,
        lastUpdated: Date.now(),
      });
      
      // Add historical data point
      await ctx.db.insert("predictionHistory", {
        predictionId: prediction._id,
        probability: args.probability,
        timestamp: Date.now(),
        source: prediction.source,
      });
      
      return { success: true, updated: prediction.title };
    }
    
    return { success: false, error: "Prediction not found" };
  },
});

// Add featured markets manually
export const addFeaturedMarkets = mutation({
  args: {},
  handler: async (ctx) => {
    const featuredMarkets = [
      {
        title: "1000+ deaths due to Israel-Iran conflict in 2025",
        sourceUrl: "https://www.metaculus.com/questions/31298/1000-deaths-due-to-israel-iran-conflict-in-2025/",
        category: "israel_relations" as const,
        source: "metaculus" as const,
        probability: 45,
        description: "Will there be 1000 or more deaths due to conflict between Israel and Iran in 2025?"
      },
      {
        title: "Iran strike on Israel in June",
        sourceUrl: "https://polymarket.com/event/iran-strike-on-israel-in-june",
        category: "israel_relations" as const,
        source: "polymarket" as const,
        probability: 15,
        description: "Will Iran conduct a military strike on Israel in June 2025?"
      },
      {
        title: "US military action against Iran before July",
        sourceUrl: "https://polymarket.com/event/us-military-action-against-iran-before-july",
        category: "military_action" as const,
        source: "polymarket" as const,
        probability: 20,
        description: "Will the US take military action against Iran before July 2025?"
      },
      {
        title: "Iran develops nuclear weapon in 2025",
        sourceUrl: "https://polymarket.com/event/iran-nuke-in-2025",
        category: "nuclear_program" as const,
        source: "polymarket" as const,
        probability: 25,
        description: "Will Iran successfully develop a nuclear weapon in 2025?"
      },
      {
        title: "US-Iran nuclear deal in 2025",
        sourceUrl: "https://polymarket.com/event/us-x-iran-nuclear-deal-in-2025",
        category: "nuclear_program" as const,
        source: "polymarket" as const,
        probability: 35,
        description: "Will the US and Iran reach a nuclear deal in 2025?"
      },
      {
        title: "US-Iran nuclear agreement",
        sourceUrl: "https://kalshi.com/markets/kxusairanagreement/us-iran-nuclear-deal",
        category: "nuclear_program" as const,
        source: "kalshi" as const,
        probability: 40,
        description: "Will the US and Iran sign a nuclear agreement?"
      },
      {
        title: "Iran closes the Strait of Hormuz in 2025",
        sourceUrl: "https://polymarket.com/event/will-iran-close-the-strait-of-hormuz-in-2025",
        category: "regional_conflict" as const,
        source: "polymarket" as const,
        probability: 10,
        description: "Will Iran close the Strait of Hormuz in 2025?"
      },
      {
        title: "Khamenei out as Supreme Leader by June 30",
        sourceUrl: "https://polymarket.com/event/khamenei-out-as-supreme-leader-of-iran-by-june-30",
        category: "regime_stability" as const,
        source: "polymarket" as const,
        probability: 15,
        description: "Will Khamenei no longer be Supreme Leader of Iran by June 30, 2025?"
      },
      {
        title: "Nuclear weapon detonation in 2025",
        sourceUrl: "https://polymarket.com/event/nuclear-weapon-detonation-in-2025",
        category: "nuclear_program" as const,
        source: "polymarket" as const,
        probability: 5,
        description: "Will there be a nuclear weapon detonation anywhere in 2025?"
      },
      {
        title: "Netanyahu out in 2025",
        sourceUrl: "https://polymarket.com/event/netanyahu-out-in-2025",
        category: "israel_relations" as const,
        source: "polymarket" as const,
        probability: 45,
        description: "Will Netanyahu no longer be Prime Minister of Israel in 2025?"
      }
    ];

    for (const market of featuredMarkets) {
      await ctx.runMutation(api.predictions.upsert, {
        category: market.category,
        title: market.title,
        description: market.description,
        probability: market.probability,
        source: market.source,
        sourceUrl: market.sourceUrl,
        resolveDate: new Date("2025-12-31").getTime()
      });
    }

    return { added: featuredMarkets.length };
  },
});

// Store all 39 data points for each Polymarket market in database
export const storeAllHistoricalData = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    const targetSlugs = [
      "iran-strike-on-israel-in-june",
      "us-military-action-against-iran-before-july", 
      "iran-nuke-in-2025",
      "us-x-iran-nuclear-deal-in-2025",
      "will-iran-close-the-strait-of-hormuz-in-2025",
      "khamenei-out-as-supreme-leader-of-iran-by-june-30",
      "nuclear-weapon-detonation-in-2025",
      "netanyahu-out-in-2025"
    ];
    
    const results = [];
    
    for (const slug of targetSlugs) {
      try {
        // Get market metadata
        const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, {
          headers: { Accept: "application/json" }
        });
        
        if (!eventResponse.ok) {
          results.push({ slug, success: false, error: `Event API error: ${eventResponse.status}` });
          continue;
        }
        
        const events = await eventResponse.json();
        if (!events?.[0]?.markets?.[0]) {
          results.push({ slug, success: false, error: "No market found" });
          continue;
        }
        
        const marketId = events[0].markets[0].id;
        
        // Get market details for clobTokenId
        const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
          headers: { Accept: "application/json" }
        });
        
        if (!marketResponse.ok) {
          results.push({ slug, success: false, error: `Market API error: ${marketResponse.status}` });
          continue;
        }
        
        const marketData = await marketResponse.json();
        const clobTokenIds = JSON.parse(marketData.clobTokenIds);
        const clobTokenId = clobTokenIds[0];
        
        // Get historical data
        const historyUrl = new URL("https://clob.polymarket.com/prices-history");
        const params = new URLSearchParams({
          market: clobTokenId,
          fidelity: "60",
          interval: "1m"
        });
        historyUrl.search = params.toString();
        
        console.log(`Fetching history for ${slug}: ${historyUrl.toString()}`);
        
        const historyResponse = await fetch(historyUrl, {
          headers: { Accept: "application/json" }
        });
        
        if (!historyResponse.ok) {
          results.push({ slug, success: false, error: `History API error: ${historyResponse.status}` });
          continue;
        }
        
        const historyData = await historyResponse.json();
        
        if (historyData?.history && historyData.history.length > 0) {
          console.log(`Got ${historyData.history.length} data points for ${slug}`);
          
          // Store all historical data points in database
          const storeResult: any = await ctx.runMutation(api.predictions.storeRealHistoricalData, {
            sourceUrl: `https://polymarket.com/event/${slug}`,
            historyData: historyData.history.map((point: any) => ({
              price: point.p,
              timestamp: point.t
            }))
          });
          
          results.push({ 
            slug, 
            success: true, 
            stored: storeResult.stored,
            totalPoints: historyData.history.length,
            marketId,
            clobTokenId
          });
        } else {
          results.push({ slug, success: false, error: "No historical data available" });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.push({ slug, success: false, error: String(error) });
      }
    }
    
    return { results, total: results.length };
  },
});

// Schedule regular data updates using H5N1 approach (run every 30 minutes)
export const scheduleDataUpdates = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    // Schedule fetching current probabilities every 30 minutes
    await ctx.scheduler.runAfter(30 * 60 * 1000, api.predictions.fetchPolymarketDirectMarkets, {});
    
    // Schedule fetching historical data every 30 minutes (H5N1 approach)
    await ctx.scheduler.runAfter(30 * 60 * 1000, api.predictions.storeAllHistoricalData, {});
    
    return { scheduled: true, nextUpdate: Date.now() + (30 * 60 * 1000) };
  },
});

// Seed data for development
export const seedData = mutation({
  args: {},
  handler: async (ctx) => {
    const samplePredictions = [
      {
        category: "military_action" as const,
        title: "Direct Military Confrontation Between Iran and Israel in 2025",
        description: "Iran and Israel will engage in direct military conflict involving airstrikes or missile attacks",
        probability: 35,
        source: "metaculus" as const,
        sourceUrl: "https://www.metaculus.com/questions/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "nuclear_program" as const,
        title: "Iran Reaches 90% Uranium Enrichment by Q2 2025",
        description: "IAEA will confirm Iran has enriched uranium to weapons-grade 90% purity",
        probability: 45,
        source: "kalshi" as const,
        sourceUrl: "https://kalshi.com/markets/example",
        resolveDate: new Date("2025-06-30").getTime(),
      },
      {
        category: "sanctions" as const,
        title: "New UN Sanctions on Iran in 2025",
        description: "UN Security Council will pass new sanctions against Iran's nuclear or military programs",
        probability: 60,
        source: "polymarket" as const,
        sourceUrl: "https://polymarket.com/event/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "regional_conflict" as const,
        title: "Major Hezbollah-Israel Escalation in 2025",
        description: "Hezbollah and Israel will engage in conflict lasting more than 7 days",
        probability: 40,
        source: "manifold" as const,
        sourceUrl: "https://manifold.markets/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "israel_relations" as const,
        title: "Iran-Israel Proxy Conflict Expands to New Country",
        description: "Iranian proxies will engage Israeli forces in a country where they haven't previously fought",
        probability: 55,
        source: "predictit" as const,
        sourceUrl: "https://www.predictit.org/markets/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "protests" as const,
        title: "Major Anti-Government Protests in Iran in 2025",
        description: "Iran will see nationwide protests lasting more than 30 days",
        probability: 30,
        source: "metaculus" as const,
        sourceUrl: "https://www.metaculus.com/questions/example2",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "regime_stability" as const,
        title: "Iranian Regime Remains in Power Through 2025",
        description: "The current Iranian government system will remain in control without major changes",
        probability: 85,
        source: "other" as const,
        sourceUrl: "https://example.com",
        resolveDate: new Date("2025-12-31").getTime(),
      },
    ];

    // Insert all predictions
    for (const prediction of samplePredictions) {
      await ctx.db.insert("predictions", {
        ...prediction,
        lastUpdated: Date.now(),
        isActive: true,
      });
    }
    
    return { inserted: samplePredictions.length };
  },
});