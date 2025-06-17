import { query } from "../_generated/server";

export const checkHistoricalData = query({
  handler: async (ctx) => {
    const predictions = await ctx.db.query("predictions").take(5);
    
    const results = await Promise.all(
      predictions.map(async (pred) => {
        const history = await ctx.db
          .query("predictionHistory")
          .withIndex("by_prediction_time", (q) => 
            q.eq("predictionId", pred._id)
          )
          .collect();
        
        return {
          title: pred.title,
          historyPoints: history.length,
          firstDate: history[0]?.timestamp 
            ? new Date(history[0].timestamp).toLocaleDateString() 
            : 'No data',
          lastDate: history[history.length - 1]?.timestamp 
            ? new Date(history[history.length - 1].timestamp).toLocaleDateString() 
            : 'No data'
        };
      })
    );
    
    return results;
  }
});