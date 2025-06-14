import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all dashboards (public only for regular users, all for admins)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    let isAdmin = false;
    
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
      isAdmin = user?.role === "admin";
    }

    if (isAdmin) {
      return await ctx.db
        .query("dashboards")
        .withIndex("by_active_order", (q) => q.eq("isActive", true))
        .collect();
    } else {
      return await ctx.db
        .query("dashboards")
        .withIndex("by_public_order", (q) => q.eq("isPublic", true).eq("isActive", true))
        .collect();
    }
  },
});

// Get dashboard by slug with its markets
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const dashboard = await ctx.db
      .query("dashboards")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!dashboard) return null;

    // Get markets for this dashboard
    const dashboardMarkets = await ctx.db
      .query("dashboardMarkets")
      .withIndex("by_dashboard_order", (q) => q.eq("dashboardId", dashboard._id))
      .collect();

    // Get the actual prediction data
    const markets = await Promise.all(
      dashboardMarkets.map(async (dm) => {
        const prediction = await ctx.db.get(dm.predictionId);
        return prediction ? {
          ...prediction,
          clarificationText: dm.clarificationOverride || prediction.clarificationText,
          order: dm.order
        } : null;
      })
    );

    const validMarkets = markets.filter((m): m is NonNullable<typeof m> => m !== null);
    
    return {
      ...dashboard,
      markets: validMarkets.sort((a, b) => a.order - b.order)
    };
  },
});

// Create new dashboard
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check admin permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    
    if (user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Check if slug already exists
    const existing = await ctx.db
      .query("dashboards")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    
    if (existing) {
      throw new Error("Dashboard with this slug already exists");
    }

    // Get next order number
    const dashboards = await ctx.db.query("dashboards").collect();
    const maxOrder = Math.max(...dashboards.map(d => d.order), 0);

    return await ctx.db.insert("dashboards", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      order: maxOrder + 1,
      isActive: true,
      isPublic: args.isPublic ?? false,
    });
  },
});

// Update dashboard
export const update = mutation({
  args: {
    id: v.id("dashboards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    order: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check admin permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    
    if (user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;
    if (args.order !== undefined) updates.order = args.order;

    return await ctx.db.patch(args.id, updates);
  },
});

// Delete dashboard
export const remove = mutation({
  args: { id: v.id("dashboards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check admin permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    
    if (user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Remove all dashboard-market relationships
    const dashboardMarkets = await ctx.db
      .query("dashboardMarkets")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.id))
      .collect();
    
    for (const dm of dashboardMarkets) {
      await ctx.db.delete(dm._id);
    }

    // Remove dashboard
    await ctx.db.delete(args.id);
  },
});

// Add market to dashboard
export const addMarket = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    predictionId: v.id("predictions"),
    order: v.optional(v.number()),
    clarificationOverride: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check admin permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    
    if (user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Check if market already exists in dashboard
    const existing = await ctx.db
      .query("dashboardMarkets")
      .filter(q => 
        q.and(
          q.eq(q.field("dashboardId"), args.dashboardId),
          q.eq(q.field("predictionId"), args.predictionId)
        )
      )
      .unique();

    if (existing) {
      throw new Error("Market already exists in dashboard");
    }

    // Get next order if not specified
    let order = args.order;
    if (order === undefined) {
      const existingMarkets = await ctx.db
        .query("dashboardMarkets")
        .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
        .collect();
      order = Math.max(...existingMarkets.map(m => m.order), 0) + 1;
    }

    return await ctx.db.insert("dashboardMarkets", {
      dashboardId: args.dashboardId,
      predictionId: args.predictionId,
      order,
      clarificationOverride: args.clarificationOverride,
    });
  },
});

// Remove market from dashboard
export const removeMarket = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    predictionId: v.id("predictions")
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check admin permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    
    if (user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const dashboardMarket = await ctx.db
      .query("dashboardMarkets")
      .filter(q => 
        q.and(
          q.eq(q.field("dashboardId"), args.dashboardId),
          q.eq(q.field("predictionId"), args.predictionId)
        )
      )
      .unique();

    if (dashboardMarket) {
      await ctx.db.delete(dashboardMarket._id);
    }
  },
});