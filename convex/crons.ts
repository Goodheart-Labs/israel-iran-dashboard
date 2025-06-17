import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update market prices every 5 minutes
crons.interval(
  "update-prices",
  { minutes: 5 },
  internal.predictions.fetchPolymarketDirectMarkets
);

// Sync historical data weekly (Sundays at 2 AM UTC)
// This ensures any newly added markets get their historical data
crons.weekly(
  "sync-historical",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.predictions.fetchAllMarketHistory
);

export default crons;