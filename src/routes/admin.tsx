import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@clerk/clerk-react";
import type { Id } from "../../convex/_generated/dataModel";

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
  
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
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

  const handleSaveClarification = async () => {
    if (!selectedMarket) return;
    
    setIsLoading(true);
    try {
      await updateClarificationText({
        predictionId: selectedMarket as Id<"predictions">,
        clarificationText: editText.trim() || undefined
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
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => handleEditMarket(market)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Quick Stats</h2>
              <div className="stats stats-vertical shadow">
                <div className="stat">
                  <div className="stat-title">Total Markets</div>
                  <div className="stat-value">{markets.length}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Last Updated</div>
                  <div className="stat-value text-lg">
                    {markets.length > 0 
                      ? new Date(Math.max(...markets.map((m: any) => m.lastUpdated))).toLocaleDateString()
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>
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