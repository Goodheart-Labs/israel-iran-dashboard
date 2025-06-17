import { query, mutation } from "./_generated/server";

// Get current user
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user;
  },
});

// Store user info when they first sign in
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existingUser) {
      return existingUser;
    }

    // Create new user - make first user admin
    const userCount = await ctx.db.query("users").collect();
    const isFirstUser = userCount.length === 0;

    const user = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: identity.name ?? identity.email ?? "Unknown",
      email: identity.email,
      role: isFirstUser ? "admin" : "user",
    });

    return await ctx.db.get(user);
  },
});

// Check if user is admin
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user?.role === "admin";
  },
});