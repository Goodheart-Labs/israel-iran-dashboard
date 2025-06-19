import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Poll current prices every minute
crons.interval(
  "poll-current-prices",
  { minutes: 1 },
  internal.pricePoller.pollCurrentPrices
);

// Update historical data every 15 minutes
crons.interval(
  "update-historical-data",
  { minutes: 15 },
  internal.historicalUpdater.updateHistoricalData
);

export default crons;