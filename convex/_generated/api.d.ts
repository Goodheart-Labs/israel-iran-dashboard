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
import type * as debugHistorical from "../debugHistorical.js";
import type * as deployHook from "../deployHook.js";
import type * as historyMutations from "../historyMutations.js";
import type * as predictions from "../predictions.js";
import type * as seed from "../seed.js";
import type * as simple from "../simple.js";
import type * as simpleUpdater from "../simpleUpdater.js";
import type * as statusMutations from "../statusMutations.js";
import type * as sync_syncData from "../sync/syncData.js";
import type * as systemStatus from "../systemStatus.js";
import type * as testData from "../testData.js";
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
  debugHistorical: typeof debugHistorical;
  deployHook: typeof deployHook;
  historyMutations: typeof historyMutations;
  predictions: typeof predictions;
  seed: typeof seed;
  simple: typeof simple;
  simpleUpdater: typeof simpleUpdater;
  statusMutations: typeof statusMutations;
  "sync/syncData": typeof sync_syncData;
  systemStatus: typeof systemStatus;
  testData: typeof testData;
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
