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

// Fetch from Polymarket (public data only)
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
          "Authorization": `Bearer 38314d45-7899-4f51-a860-f6b898707a70`
        }
      });
      
      if (!response.ok) {
        console.error(`Adjacent News API error: ${response.status}`);
        return { savedFromAdjacent: 0, error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      const markets = data.markets || data || []; // Handle different response formats
      
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
              "Authorization": `Bearer 38314d45-7899-4f51-a860-f6b898707a70`
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

// Admin: Test Adjacent News API connection
export const testAdjacentNewsConnection = action({
  args: {},
  handler: async (ctx) => {
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

// Clear all predictions and history (admin only)
export const clearAllPredictions = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all predictions
    const predictions = await ctx.db.query("predictions").collect();
    for (const prediction of predictions) {
      await ctx.db.delete(prediction._id);
    }
    
    // Clear all history
    const history = await ctx.db.query("predictionHistory").collect();
    for (const historyItem of history) {
      await ctx.db.delete(historyItem._id);
    }
    
    return { 
      deletedPredictions: predictions.length,
      deletedHistory: history.length 
    };
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