import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Update market prices every 30 minutes
crons.interval(
  "update-prices",
  { minutes: 30 },
  api.simpleUpdater.updatePredictions
);

export default crons;