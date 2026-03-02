import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Poll Polymarket prices every minute
crons.interval(
  "poll-current-prices",
  { minutes: 1 },
  api.pricePoller.pollCurrentPrices,
);

// Poll Kalshi prices every 2 minutes
crons.interval(
  "poll-kalshi-prices",
  { minutes: 2 },
  api.kalshiPoller.pollKalshiPrices
);

// Poll Metaculus every 15 minutes (community predictions change slowly)
crons.interval(
  "poll-metaculus-prices",
  { minutes: 15 },
  api.metaculusPoller.pollMetaculusPrices
);

// Update historical data every 15 minutes
crons.interval(
  "update-historical-data",
  { minutes: 15 },
  api.historicalUpdater.updateHistoricalData,
);

export default crons;
