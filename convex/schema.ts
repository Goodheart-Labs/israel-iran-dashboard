import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const predictionCategories = [
  "military_action",
  "nuclear_program",
  "sanctions",
  "regional_conflict", 
  "israel_relations",
  "protests",
  "regime_stability"
] as const;

export const predictionSources = [
  "metaculus",
  "kalshi", 
  "polymarket",
  "predictit",
  "manifold",
  "adjacent",
  "other"
] as const;

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  }).index("by_clerkId", ["clerkId"]),

  dashboards: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    isPublic: v.boolean(), // Private tabs for staging/editing
  }).index("by_slug", ["slug"])
    .index("by_active_order", ["isActive", "order"])
    .index("by_public_order", ["isPublic", "isActive", "order"]),

  dashboardMarkets: defineTable({
    dashboardId: v.id("dashboards"),
    predictionId: v.id("predictions"),
    order: v.number(),
    clarificationOverride: v.optional(v.string()),
  }).index("by_dashboard", ["dashboardId"])
    .index("by_dashboard_order", ["dashboardId", "order"])
    .index("by_prediction", ["predictionId"]),

  predictions: defineTable({
    category: v.union(
      v.literal("military_action"),
      v.literal("nuclear_program"),
      v.literal("sanctions"),
      v.literal("regional_conflict"),
      v.literal("israel_relations"),
      v.literal("protests"),
      v.literal("regime_stability")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    clarificationText: v.optional(v.string()), // Brief clarification text below title
    probability: v.number(), // 0-100
    previousProbability: v.optional(v.number()), // For trend calculation
    source: v.union(
      v.literal("metaculus"),
      v.literal("kalshi"),
      v.literal("polymarket"),
      v.literal("predictit"),
      v.literal("manifold"),
      v.literal("adjacent"),
      v.literal("other")
    ),
    sourceUrl: v.optional(v.string()),
    lastUpdated: v.number(), // Unix timestamp
    resolveDate: v.optional(v.number()), // When the prediction resolves
    isActive: v.boolean(),
    isApproved: v.optional(v.boolean()), // Admin approval
    isRejected: v.optional(v.boolean()), // Admin rejection
  })
    .index("by_category", ["category"])
    .index("by_source", ["source"])
    .index("by_active", ["isActive"])
    .index("by_category_active", ["category", "isActive"])
    .index("by_source_url", ["sourceUrl"]),
    
  predictionHistory: defineTable({
    predictionId: v.id("predictions"),
    probability: v.number(),
    timestamp: v.number(),
    source: v.union(
      v.literal("metaculus"),
      v.literal("kalshi"),
      v.literal("polymarket"),
      v.literal("predictit"),
      v.literal("manifold"),
      v.literal("adjacent"),
      v.literal("other")
    ),
  })
    .index("by_prediction", ["predictionId"])
    .index("by_prediction_time", ["predictionId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
    
  // Simple system status tracking
  systemStatus: defineTable({
    key: v.string(), // e.g., "lastUpdate", "updateHealth"
    value: v.any(), // Flexible value storage
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});