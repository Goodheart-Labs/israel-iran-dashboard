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

// Calculate weighted democratic health score (following H5N1 pattern)
export const getDemocraticHealthScore = query({
  args: {},
  handler: async (ctx) => {
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter(q => q.eq(q.field("isApproved"), true))
      .collect();
    
    // Category weights (similar to H5N1's weighted approach)
    const categoryWeights = {
      elections: 0.25,        // Core democratic process
      democratic_norms: 0.20, // Institutional health
      voting_rights: 0.15,    // Access to democracy
      civil_liberties: 0.15,  // Individual freedoms
      press_freedom: 0.10,    // Information environment
      stability: 0.10,        // Overall indicators
      riots: 0.05,           // Violence (inverted - lower is better)
    };
    
    // Calculate weighted scores by category
    const categoryScores: Record<string, { score: number; count: number; weight: number }> = {};
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [category, weight] of Object.entries(categoryWeights)) {
      const categoryPredictions = predictions.filter(p => p.category === category);
      if (categoryPredictions.length > 0) {
        let categoryScore = categoryPredictions.reduce((sum, p) => sum + p.probability, 0) / categoryPredictions.length;
        
        // Invert riots score (civil unrest is bad for democracy)
        if (category === 'riots') {
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
  
  if (text.match(/election|electoral|vote|voting|ballot|polls/)) {
    if (text.match(/suppress|restriction|access|rights/)) return "voting_rights";
    return "elections";
  }
  if (text.match(/riot|violence|unrest|protest|civil disorder/)) return "riots";
  if (text.match(/press|journalism|media|reporter|news/)) return "press_freedom";
  if (text.match(/civil liberties|civil rights|freedom|privacy|surveillance/)) return "civil_liberties";
  if (text.match(/democratic norms|peaceful transfer|coup|military/)) return "democratic_norms";
  if (text.match(/democracy index|democratic|stability|institution/)) return "stability";
  
  return null;
}

// Fetch from Manifold Markets
export const fetchManifoldMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    const searchTerms = [
      "US democracy",
      "US election",
      "voting rights",
      "press freedom",
      "civil liberties",
      "political violence",
      "democratic institutions"
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
      "US democracy",
      "US election",
      "voting rights", 
      "press freedom",
      "civil liberties"
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

// Fetch from Polymarket (public data only)
export const fetchPolymarketMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    try {
      // Polymarket GraphQL endpoint
      const response = await fetch("https://gamma-api.polymarket.com/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetMarkets {
              markets(where: {
                active: true,
                closed: false,
                question_contains: "US"
              }, first: 100) {
                id
                question
                description
                outcomes
                outcomePrices
                volume
                liquidity
                endDate
              }
            }
          `,
        }),
      });
      
      const data = await response.json();
      const markets = data.data?.markets || [];
      
      // Process relevant markets
      let saved = 0;
      for (const market of markets) {
        const category = categorizePrediction(market.question, market.description || "");
        if (category && market.outcomePrices?.[0]) {
          try {
            await ctx.runMutation(api.predictions.upsert, {
              category,
              title: market.question,
              description: market.description?.slice(0, 500),
              probability: Math.round(parseFloat(market.outcomePrices[0]) * 100),
              source: "polymarket",
              sourceUrl: `https://polymarket.com/event/${market.id}`,
              resolveDate: market.endDate ? new Date(market.endDate).getTime() : undefined,
            });
            saved++;
          } catch (error) {
            console.error("Error saving Polymarket market:", error);
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

// Fetch markets based on news events and trends
export const fetchNewsBasedMarkets = action({
  args: {},
  handler: async (ctx) => {
    "use node";
    
    const newsKeywords = [
      "election fraud",
      "voting rights legislation", 
      "press freedom restrictions",
      "civil liberties surveillance",
      "political violence",
      "democratic institutions crisis",
      "electoral integrity",
      "media censorship",
      "peaceful transfer power",
      "constitutional crisis"
    ];
    
    let savedFromNews = 0;
    
    // Check each prediction market for topics related to current news trends
    for (const keyword of newsKeywords) {
      try {
        // Search Manifold for news-related markets
        const manifoldResponse = await fetch(
          `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(keyword)}&limit=20&sort=newest`
        );
        const manifoldMarkets = await manifoldResponse.json();
        
        for (const market of manifoldMarkets) {
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
              console.error("Error saving news-based Manifold market:", error);
            }
          }
        }
        
        // Search Metaculus for news-related questions
        const metaculusResponse = await fetch(
          `https://www.metaculus.com/api2/questions/?search=${encodeURIComponent(keyword)}&status=open&limit=20&order_by=-publish_time`
        );
        const metaculusData = await metaculusResponse.json();
        
        if (metaculusData.results) {
          for (const question of metaculusData.results) {
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
                savedFromNews++;
              } catch (error) {
                console.error("Error saving news-based Metaculus question:", error);
              }
            }
          }
        }
        
        // Small delay to be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error fetching news-based markets for "${keyword}":`, error);
      }
    }
    
    return { savedFromNews, keywords: newsKeywords.length };
  },
});

// Master fetch function to get data from all sources
export const fetchAllPredictions = action({
  args: {},
  handler: async (ctx): Promise<{
    manifold: { fetched: number; saved: number; error?: any };
    metaculus: { fetched: number; saved: number; error?: any };
    polymarket: { fetched: number; saved: number; error?: any };
    newsBased: { savedFromNews: number; keywords: number; error?: any };
  }> => {
    "use node";
    
    const results = await Promise.allSettled([
      ctx.runAction(api.predictions.fetchManifoldMarkets, {}),
      ctx.runAction(api.predictions.fetchMetaculusQuestions, {}),
      ctx.runAction(api.predictions.fetchPolymarketMarkets, {}),
      ctx.runAction(api.predictions.fetchNewsBasedMarkets, {}),
    ]);
    
    const summary = {
      manifold: results[0].status === "fulfilled" ? results[0].value : { fetched: 0, saved: 0, error: results[0].reason },
      metaculus: results[1].status === "fulfilled" ? results[1].value : { fetched: 0, saved: 0, error: results[1].reason },
      polymarket: results[2].status === "fulfilled" ? results[2].value : { fetched: 0, saved: 0, error: results[2].reason },
      newsBased: results[3].status === "fulfilled" ? results[3].value : { savedFromNews: 0, keywords: 0, error: results[3].reason },
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
    // TODO: Add proper admin role check - temporarily removing auth requirement
    
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
    // TODO: Add proper admin role check - temporarily removing auth requirement
    
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
    // TODO: Add proper admin role check - temporarily removing auth requirement
    
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
    // TODO: Add proper admin role check - temporarily removing auth requirement
    
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
    // TODO: Add proper admin role check - temporarily removing auth requirement
    
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
    // TODO: Add proper admin role check - temporarily removing auth requirement
    
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

// Seed data for development
export const seedData = mutation({
  args: {},
  handler: async (ctx) => {
    const samplePredictions = [
      {
        category: "elections" as const,
        title: "2024 Presidential Election Will Be Certified Without Major Disruption",
        description: "The 2024 US presidential election results will be certified by Congress without violence or significant procedural delays",
        probability: 75,
        source: "metaculus" as const,
        sourceUrl: "https://www.metaculus.com/questions/example",
        resolveDate: new Date("2025-01-20").getTime(),
      },
      {
        category: "riots" as const,
        title: "Major Civil Unrest in US City in 2025",
        description: "At least one US city will experience riots lasting 3+ days with National Guard deployment",
        probability: 35,
        source: "kalshi" as const,
        sourceUrl: "https://kalshi.com/markets/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "voting_rights" as const,
        title: "Voting Rights Act Challenge at Supreme Court",
        description: "Supreme Court will hear a major case challenging key provisions of voting rights legislation",
        probability: 60,
        source: "polymarket" as const,
        sourceUrl: "https://polymarket.com/event/example",
        resolveDate: new Date("2025-06-30").getTime(),
      },
      {
        category: "press_freedom" as const,
        title: "Major News Outlet Faces Federal Investigation",
        description: "A top 10 US news organization will be investigated for national security reporting",
        probability: 25,
        source: "manifold" as const,
        sourceUrl: "https://manifold.markets/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "civil_liberties" as const,
        title: "New Surveillance Legislation Passes Congress",
        description: "Congress will pass legislation expanding government surveillance capabilities",
        probability: 45,
        source: "predictit" as const,
        sourceUrl: "https://www.predictit.org/markets/example",
        resolveDate: new Date("2025-12-31").getTime(),
      },
      {
        category: "democratic_norms" as const,
        title: "Peaceful Transfer of Power in 2025",
        description: "The 2024 election winner will take office without military intervention or constitutional crisis",
        probability: 92,
        source: "metaculus" as const,
        sourceUrl: "https://www.metaculus.com/questions/example2",
        resolveDate: new Date("2025-01-20").getTime(),
      },
      {
        category: "stability" as const,
        title: "US Democracy Index Score Remains Above 7.0",
        description: "The Economist's Democracy Index will rate the US above 7.0 (flawed democracy threshold)",
        probability: 68,
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