import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Poll current prices every minute
crons.interval(
  "poll-current-prices",
  { minutes: 1 },
  api.pricePoller.pollCurrentPrices,
);

// Update historical data every 15 minutes
crons.interval(
  "update-historical-data",
  { minutes: 15 },
  api.historicalUpdater.updateHistoricalData,
);

export default crons;
