import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// Export all data from current environment
export const exportAllData = internalQuery({
  handler: async (ctx) => {
    const predictions = await ctx.db.query("predictions").collect();
    const predictionHistory = await ctx.db.query("predictionHistory").collect();
    const dashboards = await ctx.db.query("dashboards").collect();
    const dashboardMarkets = await ctx.db.query("dashboardMarkets").collect();
    const users = await ctx.db.query("users").collect();
    
    return {
      predictions,
      predictionHistory,
      dashboards,
      dashboardMarkets,
      users,
      exportedAt: new Date().toISOString(),
      environment: process.env.CONVEX_DEPLOYMENT || 'unknown'
    };
  }
});

// Import data into current environment
export const importAllData = internalMutation({
  args: {
    data: v.object({
      predictions: v.array(v.any()),
      predictionHistory: v.array(v.any()),
      dashboards: v.array(v.any()),
      dashboardMarkets: v.array(v.any()),
      users: v.array(v.any()),
      exportedAt: v.string(),
      environment: v.string()
    })
  },
  handler: async (ctx, args) => {
    // Clear existing data (BE CAREFUL!)
    const existingPredictions = await ctx.db.query("predictions").collect();
    for (const pred of existingPredictions) {
      await ctx.db.delete(pred._id);
    }
    
    const existingHistory = await ctx.db.query("predictionHistory").collect();
    for (const hist of existingHistory) {
      await ctx.db.delete(hist._id);
    }
    
    const existingDashboards = await ctx.db.query("dashboards").collect();
    for (const dash of existingDashboards) {
      await ctx.db.delete(dash._id);
    }
    
    const existingDashboardMarkets = await ctx.db.query("dashboardMarkets").collect();
    for (const dm of existingDashboardMarkets) {
      await ctx.db.delete(dm._id);
    }
    
    // Import new data (without _id and _creationTime)
    const idMap = new Map(); // Track old->new ID mappings
    
    // Import predictions first
    for (const pred of args.data.predictions) {
      const { _id, _creationTime, ...data } = pred;
      const newId = await ctx.db.insert("predictions", data);
      idMap.set(_id, newId);
    }
    
    // Import history with updated prediction IDs
    for (const hist of args.data.predictionHistory) {
      const { _id, _creationTime, predictionId, ...data } = hist;
      const newPredictionId = idMap.get(predictionId);
      if (newPredictionId) {
        await ctx.db.insert("predictionHistory", {
          ...data,
          predictionId: newPredictionId
        });
      }
    }
    
    // Import dashboards
    for (const dash of args.data.dashboards) {
      const { _id, _creationTime, ...data } = dash;
      const newId = await ctx.db.insert("dashboards", data);
      idMap.set(_id, newId);
    }
    
    // Import dashboard markets with updated IDs
    for (const dm of args.data.dashboardMarkets) {
      const { _id, _creationTime, dashboardId, predictionId, ...data } = dm;
      const newDashboardId = idMap.get(dashboardId);
      const newPredictionId = idMap.get(predictionId);
      if (newDashboardId && newPredictionId) {
        await ctx.db.insert("dashboardMarkets", {
          ...data,
          dashboardId: newDashboardId,
          predictionId: newPredictionId
        });
      }
    }
    
    // Import users (be careful with this!)
    for (const user of args.data.users) {
      const { _id, _creationTime, ...data } = user;
      await ctx.db.insert("users", data);
    }
    
    return {
      imported: {
        predictions: args.data.predictions.length,
        history: args.data.predictionHistory.length,
        dashboards: args.data.dashboards.length,
        dashboardMarkets: args.data.dashboardMarkets.length,
        users: args.data.users.length
      },
      fromEnvironment: args.data.environment,
      exportedAt: args.data.exportedAt
    };
  }
});

// Helper scripts for easy copying
// Usage:
// 1. In production console: const data = await ctx.runQuery(internal.sync.syncData.exportAllData)
// 2. Copy the data
// 3. In local console: await ctx.runMutation(internal.sync.syncData.importAllData, { data: <paste> })