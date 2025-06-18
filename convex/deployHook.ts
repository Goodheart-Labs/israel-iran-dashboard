"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

// This function can be called after deployment to trigger an immediate update
export const onDeploy = action({
  handler: async (ctx) => {
    console.log("[DEPLOY] Running post-deployment update...");
    
    try {
      // Trigger the update
      const result = await ctx.runAction(api.simpleUpdater.updatePredictions, {});
      
      console.log(`[DEPLOY] Update completed: ${result.marketsUpdated} markets updated`);
      
      return {
        success: true,
        message: `Deployment update completed: ${result.marketsUpdated} markets updated`,
        ...result
      };
    } catch (error) {
      console.error("[DEPLOY] Update failed:", error);
      
      return {
        success: false,
        message: "Deployment update failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },
});