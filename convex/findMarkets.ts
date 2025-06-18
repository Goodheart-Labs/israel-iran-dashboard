"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Search for Iran-related markets to find correct slugs
export const searchPolymarkets = action({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`Searching for markets with term: ${args.searchTerm}`);
    
    try {
      // Try searching with the search API
      const searchUrl = `https://gamma-api.polymarket.com/events?_s=${encodeURIComponent(args.searchTerm)}&_limit=20`;
      console.log("Search URL:", searchUrl);
      
      const response = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        return { error: `Search failed: ${response.status}` };
      }
      
      const events = await response.json();
      
      // Extract relevant info from each event
      const markets = events.map((event: any) => ({
        title: event.title || event.question,
        slug: event.slug,
        markets: event.markets?.map((m: any) => ({
          id: m.id,
          question: m.question,
          outcomePrices: m.outcomePrices,
        }))
      }));
      
      return {
        searchTerm: args.searchTerm,
        count: markets.length,
        markets: markets
      };
      
    } catch (error) {
      console.error("Search error:", error);
      return { error: String(error) };
    }
  },
});