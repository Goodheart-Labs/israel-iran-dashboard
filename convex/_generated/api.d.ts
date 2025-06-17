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
import type * as actions_syncHistoricalData from "../actions/syncHistoricalData.js";
import type * as actions_updateCurrentPrices from "../actions/updateCurrentPrices.js";
import type * as debug_checkHistory from "../debug/checkHistory.js";
import type * as predictions from "../predictions.js";
import type * as seed from "../seed.js";
import type * as simple from "../simple.js";
import type * as sync_syncData from "../sync/syncData.js";
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
  "actions/syncHistoricalData": typeof actions_syncHistoricalData;
  "actions/updateCurrentPrices": typeof actions_updateCurrentPrices;
  "debug/checkHistory": typeof debug_checkHistory;
  predictions: typeof predictions;
  seed: typeof seed;
  simple: typeof simple;
  "sync/syncData": typeof sync_syncData;
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
