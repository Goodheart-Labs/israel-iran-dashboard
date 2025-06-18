import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Update market prices every 30 minutes using reliable updater
crons.interval(
  "update-prices",
  { minutes: 30 },
  api.simpleUpdater.updatePredictions
);

// Sync historical data weekly (Sundays at 2 AM UTC)
// This ensures any newly added markets get their historical data
crons.weekly(
  "sync-historical",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  api.predictions.fetchAllMarketHistory
);

export default crons;