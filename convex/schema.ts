import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const predictionCategories = [
  "elections",
  "riots",
  "voting_rights", 
  "press_freedom",
  "civil_liberties",
  "democratic_norms",
  "stability"
] as const;

export const predictionSources = [
  "metaculus",
  "kalshi", 
  "polymarket",
  "predictit",
  "manifold",
  "other"
] as const;

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  }).index("by_clerkId", ["clerkId"]),

  predictions: defineTable({
    category: v.union(
      v.literal("elections"),
      v.literal("riots"),
      v.literal("voting_rights"),
      v.literal("press_freedom"),
      v.literal("civil_liberties"),
      v.literal("democratic_norms"),
      v.literal("stability")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    probability: v.number(), // 0-100
    previousProbability: v.optional(v.number()), // For trend calculation
    source: v.union(
      v.literal("metaculus"),
      v.literal("kalshi"),
      v.literal("polymarket"),
      v.literal("predictit"),
      v.literal("manifold"),
      v.literal("other")
    ),
    sourceUrl: v.optional(v.string()),
    lastUpdated: v.number(), // Unix timestamp
    resolveDate: v.optional(v.number()), // When the prediction resolves
    isActive: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_source", ["source"])
    .index("by_active", ["isActive"])
    .index("by_category_active", ["category", "isActive"])
    .index("by_source_url", ["sourceUrl"]),
});