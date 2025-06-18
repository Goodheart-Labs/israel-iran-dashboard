import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@clerk/clerk-react";
import type { Id } from "../../convex/_generated/dataModel";
import { RefreshCw, CheckCircle, XCircle, Clock, BarChart } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg"></div>
            <p className="mt-4 opacity-70">Loading authentication...</p>
          </div>
        </div>
      </AuthLoading>
      
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
            <p className="text-lg opacity-70 mb-6">Please sign in to access the admin panel</p>
            <SignInButton mode="modal">
              <button className="btn btn-primary">Sign In</button>
            </SignInButton>
          </div>
        </div>
      </Unauthenticated>
      
      <Authenticated>
        <AdminDashboard />
      </Authenticated>
    </>
  );
}

function AdminDashboard() {
  const markets = useQuery(api.simple.getMarkets) || [];
  const storeUser = useMutation(api.users.store);
  const isAdmin = useQuery(api.users.isAdmin);
  const updateClarificationText = useMutation(api.predictions.updateClarificationText);
  const deletePrediction = useMutation(api.predictions.deletePrediction);
  const triggerUpdate = useAction(api.simpleUpdater.updatePredictions);
  const lastUpdate = useQuery(api.systemStatus.getLastUpdate);
  const updateHistory = useQuery(api.systemStatus.getUpdateHistory) || [];
  const historyStats = useQuery(api.predictions.getHistoryStats) || [];
  const fetchAllHistory = useAction(api.predictions.fetchAllMarketHistory);
  const debugHistory = useAction(api.debugHistorical.debugPolymarketHistory);
  
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [historyResult, setHistoryResult] = useState<any>(null);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  
  // Store user when authenticated - but only when isAdmin query is ready
  useEffect(() => {
    if (isAdmin !== undefined) {
      void storeUser();
    }
  }, [storeUser, isAdmin]);

  // Show loading while checking admin status
  if (isAdmin === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 opacity-70">Checking admin permissions...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-lg opacity-70 mb-4">You don't have admin permissions</p>
          <p className="text-sm opacity-50">Contact the site administrator if you should have access</p>
        </div>
      </div>
    );
  }

  const handleEditMarket = (market: any) => {
    setSelectedMarket(market._id);
    setEditText(market.clarificationText || "");
  };

  const handleManualUpdate = async () => {
    setIsUpdating(true);
    try {
      const result = await triggerUpdate();
      console.log('Update result:', result);
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFetchHistory = async () => {
    setIsFetchingHistory(true);
    setHistoryResult(null);
    try {
      const result = await fetchAllHistory();
      console.log('History fetch result:', result);
      setHistoryResult(result);
    } catch (error) {
      console.error('History fetch failed:', error);
      setHistoryResult({ error: String(error) });
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleSaveClarification = async () => {
    if (!selectedMarket) return;
    
    setIsLoading(true);
    try {
      await updateClarificationText({
        id: selectedMarket as Id<"predictions">,
        clarificationText: editText.trim()
      });
      setSelectedMarket(null);
      setEditText("");
    } catch (error) {
      console.error("Failed to update clarification:", error);
      alert("Failed to update clarification text");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMarket = async (marketId: string, marketTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${marketTitle}"? This will also delete all historical data.`)) {
      return;
    }
    
    try {
      await deletePrediction({
        id: marketId as Id<"predictions">
      });
    } catch (error) {
      console.error("Failed to delete market:", error);
      alert("Failed to delete market");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <a href="/" className="btn btn-outline btn-sm">
          Back to Dashboard
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Markets List */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Active Markets ({markets.length})</h2>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Probability</th>
                      <th>Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market: any) => (
                      <tr key={market._id}>
                        <td>
                          <div className="max-w-xs">
                            <div className="font-medium truncate">{market.title}</div>
                            {market.clarificationText && (
                              <div className="text-xs opacity-70 truncate">
                                {market.clarificationText}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{market.probability}%</td>
                        <td className="capitalize">{market.source}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-xs btn-primary"
                              onClick={() => handleEditMarket(market)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-xs btn-error"
                              onClick={() => handleDeleteMarket(market._id, market.title)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Update Status */}
        <div className="space-y-6">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Update Status</h2>
              
              {/* Manual Update Button */}
              <button 
                className={`btn btn-primary w-full ${isUpdating ? 'loading' : ''}`}
                onClick={handleManualUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Manual Update
                  </>
                )}
              </button>
              
              {/* Last Update Status */}
              {lastUpdate && lastUpdate.timestamp && (
                <div className="mt-4 p-4 bg-base-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Last Update</span>
                    {lastUpdate.success ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-error" />
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="opacity-70">Time:</span>
                      <span>{formatDistanceToNow(new Date(lastUpdate.timestamp))} ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Markets:</span>
                      <span>{lastUpdate.marketsUpdated || 0}</span>
                    </div>
                    {lastUpdate.duration && (
                      <div className="flex justify-between">
                        <span className="opacity-70">Duration:</span>
                        <span>{lastUpdate.duration}ms</span>
                      </div>
                    )}
                  </div>
                  {lastUpdate.errors && lastUpdate.errors.length > 0 && (
                    <div className="mt-2 text-xs text-error">
                      {lastUpdate.errors[0]}
                    </div>
                  )}
                </div>
              )}
              
              {/* Recent Updates */}
              {updateHistory.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Recent Updates</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {updateHistory.slice(0, 5).map((update: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-base-200 rounded">
                        <div className="flex items-center gap-2">
                          {update.success ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-error" />
                          )}
                          <span className="opacity-70">
                            {formatDistanceToNow(new Date(update.timestamp))} ago
                          </span>
                        </div>
                        <span className="font-mono">
                          {update.marketsUpdated} markets
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          

          {/* Historical Data */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Historical Data</h2>
              
              <button 
                className={`btn btn-secondary w-full ${isFetchingHistory ? 'loading' : ''}`}
                onClick={handleFetchHistory}
                disabled={isFetchingHistory}
              >
                {isFetchingHistory ? 'Fetching...' : (
                  <>
                    <BarChart className="w-4 h-4 mr-2" />
                    Fetch 7-Day History
                  </>
                )}
              </button>
              
              {historyResult && (
                <div className="mt-4 p-4 bg-base-200 rounded-lg text-sm">
                  {historyResult.error ? (
                    <div className="text-error">Error: {historyResult.error}</div>
                  ) : (
                    <>
                      <div className="font-semibold mb-2">
                        Fetched {historyResult.results?.filter((r: any) => r.success).length || 0} of {historyResult.total || 0} markets
                      </div>
                      {historyResult.results?.map((r: any, idx: number) => (
                        <div key={idx} className="text-xs opacity-70">
                          {r.title ? `${r.title}: ` : ''}
                          {r.success ? `✓ ${r.stored || 0} points` : `✗ ${r.error}`}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              
              {/* Debug Button */}
              <button 
                className={`btn btn-outline btn-warning w-full mt-4 ${isDebugging ? 'loading' : ''}`}
                onClick={async () => {
                  setIsDebugging(true);
                  setDebugResult(null);
                  try {
                    const result = await debugHistory({ 
                      slug: "khamenei-out-as-supreme-leader-of-iran-by-june-30" 
                    });
                    setDebugResult(result);
                    console.log('Debug result:', result);
                  } catch (error) {
                    console.error('Debug failed:', error);
                    setDebugResult({ error: String(error) });
                  } finally {
                    setIsDebugging(false);
                  }
                }}
                disabled={isDebugging}
              >
                {isDebugging ? 'Debugging...' : 'Debug Historical Gaps'}
              </button>
              
              {debugResult && (
                <div className="mt-4 p-4 bg-base-200 rounded-lg text-xs">
                  <div className="font-semibold mb-2">Debug Results:</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(debugResult.theories || debugResult, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* History Stats */}
              {historyStats.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="font-semibold">Current History</h3>
                  <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {historyStats.map((stat: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate flex-1 opacity-70">{stat.title}</span>
                        <span className="font-mono">{stat.historyPoints} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Admin Status</h2>
              <div className="text-sm space-y-2">
                <div className="badge badge-success gap-2">
                  <div className="w-2 h-2 bg-current rounded-full"></div>
                  Authenticated as Admin
                </div>
                <p className="opacity-70">
                  You have full access to manage markets and settings
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {selectedMarket && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Edit Clarification Text</h3>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Enter clarification text (optional)"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
            <div className="modal-action">
              <button 
                className="btn btn-primary"
                onClick={handleSaveClarification}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
              <button 
                className="btn" 
                onClick={() => setSelectedMarket(null)}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}