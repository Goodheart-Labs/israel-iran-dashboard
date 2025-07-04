/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as crons from "../crons.js";
import type * as debug_checkHistory from "../debug/checkHistory.js";
import type * as debug_checkMarketStatus from "../debug/checkMarketStatus.js";
import type * as debugDataGaps from "../debugDataGaps.js";
import type * as debugHistorical from "../debugHistorical.js";
import type * as deployHook from "../deployHook.js";
import type * as findMarkets from "../findMarkets.js";
import type * as historicalMutations from "../historicalMutations.js";
import type * as historicalUpdater from "../historicalUpdater.js";
import type * as historyMutations from "../historyMutations.js";
import type * as initialDataLoad from "../initialDataLoad.js";
import type * as predictions from "../predictions.js";
import type * as priceMutations from "../priceMutations.js";
import type * as pricePoller from "../pricePoller.js";
import type * as seed from "../seed.js";
import type * as simple from "../simple.js";
import type * as simpleUpdater from "../simpleUpdater.js";
import type * as statusMutations from "../statusMutations.js";
import type * as sync_syncData from "../sync/syncData.js";
import type * as systemStatus from "../systemStatus.js";
import type * as testData from "../testData.js";
import type * as testDuplicateLogic from "../testDuplicateLogic.js";
import type * as testHistoricalFetch from "../testHistoricalFetch.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "debug/checkHistory": typeof debug_checkHistory;
  "debug/checkMarketStatus": typeof debug_checkMarketStatus;
  debugDataGaps: typeof debugDataGaps;
  debugHistorical: typeof debugHistorical;
  deployHook: typeof deployHook;
  findMarkets: typeof findMarkets;
  historicalMutations: typeof historicalMutations;
  historicalUpdater: typeof historicalUpdater;
  historyMutations: typeof historyMutations;
  initialDataLoad: typeof initialDataLoad;
  predictions: typeof predictions;
  priceMutations: typeof priceMutations;
  pricePoller: typeof pricePoller;
  seed: typeof seed;
  simple: typeof simple;
  simpleUpdater: typeof simpleUpdater;
  statusMutations: typeof statusMutations;
  "sync/syncData": typeof sync_syncData;
  systemStatus: typeof systemStatus;
  testData: typeof testData;
  testDuplicateLogic: typeof testDuplicateLogic;
  testHistoricalFetch: typeof testHistoricalFetch;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
