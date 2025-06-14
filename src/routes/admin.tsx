import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@clerk/clerk-react";
import type { Id } from "../../convex/_generated/dataModel";

const featuredPredictionsQueryOptions = convexQuery(api.predictions.getFeaturedPredictions, {});
const allPredictionsQueryOptions = convexQuery(api.predictions.getAllForAdmin, {});
const dashboardsQueryOptions = convexQuery(api.dashboards.getAll, {});
const dashboardMarketsQueryOptions = convexQuery(api.dashboards.getAllMarkets, {});

export const Route = createFileRoute("/admin")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(featuredPredictionsQueryOptions);
    await queryClient.ensureQueryData(allPredictionsQueryOptions);
    await queryClient.ensureQueryData(dashboardsQueryOptions);
    await queryClient.ensureQueryData(dashboardMarketsQueryOptions);
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: predictions } = useSuspenseQuery(featuredPredictionsQueryOptions);
  const { data: allPredictions } = useSuspenseQuery(allPredictionsQueryOptions);
  const { data: dashboards } = useSuspenseQuery(dashboardsQueryOptions);
  const { data: dashboardMarkets } = useSuspenseQuery(dashboardMarketsQueryOptions);
  const updateClarificationText = useMutation(api.predictions.updateClarificationText);
  const updateBrierScore = useMutation(api.predictions.updateBrierScore);
  const deactivatePrediction = useMutation(api.predictions.deactivatePrediction);
  const reactivatePrediction = useMutation(api.predictions.reactivatePrediction);
  const deletePrediction = useMutation(api.predictions.deletePrediction);
  const platformGrades = useQuery(api.predictions.getPlatformGrades);
  const createDashboard = useMutation(api.dashboards.create);
  const updateDashboard = useMutation(api.dashboards.update);
  const deleteDashboard = useMutation(api.dashboards.remove);
  const storeUser = useMutation(api.users.store);
  const isAdmin = useQuery(api.users.isAdmin);
  
  const [activeTab, setActiveTab] = useState<"dashboards" | "brier" | "manage">("dashboards");
  const [editingId, setEditingId] = useState<Id<"predictions"> | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedDashboard, setSelectedDashboard] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("status-date");
  
  // Dashboard creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDashboard, setNewDashboard] = useState({
    name: "",
    slug: "",
    description: "",
    isPublic: false
  });

  // Auto-create user when they first visit admin
  useEffect(() => {
    void storeUser();
  }, [storeUser]);

  const handleEdit = (prediction: any) => {
    setEditingId(prediction._id);
    setEditText(prediction.clarificationText || "");
  };

  const handleSave = async (predictionId: Id<"predictions">) => {
    await updateClarificationText({
      predictionId,
      clarificationText: editText.trim() || undefined
    });
    setEditingId(null);
    setEditText("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleCreateDashboard = async () => {
    if (!newDashboard.name || !newDashboard.slug) return;
    
    try {
      await createDashboard(newDashboard);
      setNewDashboard({ name: "", slug: "", description: "", isPublic: false });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating dashboard:", error);
    }
  };

  const handleTogglePublic = async (dashboardId: Id<"dashboards">, isPublic: boolean) => {
    try {
      await updateDashboard({ id: dashboardId, isPublic: !isPublic });
    } catch (error) {
      console.error("Error updating dashboard:", error);
    }
  };

  const handleDeleteDashboard = async (dashboardId: Id<"dashboards">) => {
    if (confirm("Are you sure you want to delete this dashboard?")) {
      try {
        await deleteDashboard({ id: dashboardId });
      } catch (error) {
        console.error("Error deleting dashboard:", error);
      }
    }
  };

  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
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
        {isAdmin === false ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
              <p className="text-lg opacity-70">You don't have admin permissions</p>
            </div>
          </div>
        ) : isAdmin === undefined ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="loading loading-spinner loading-lg"></div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
            
            {/* Tabs */}
            <div className="tabs tabs-bordered mb-8">
              <button 
                className={`tab tab-lg ${activeTab === "dashboards" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("dashboards")}
              >
                Dashboards
              </button>
              <button 
                className={`tab tab-lg ${activeTab === "manage" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("manage")}
              >
                Manage Markets
              </button>
              <button 
                className={`tab tab-lg ${activeTab === "brier" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("brier")}
              >
                Brier Scores
              </button>
            </div>

            {/* Dashboard Management Tab */}
            {activeTab === "dashboards" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Manage Dashboards</h2>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create New Dashboard
                  </button>
                </div>

                {/* Create Dashboard Form */}
                {showCreateForm && (
                  <div className="card bg-base-100 shadow-xl mb-6">
                    <div className="card-body">
                      <h3 className="card-title">Create New Dashboard</h3>
                      
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Dashboard Name</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="e.g., AI Risk 2027"
                          value={newDashboard.name}
                          onChange={(e) => setNewDashboard(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">URL Slug</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="e.g., ai-2027"
                          value={newDashboard.slug}
                          onChange={(e) => setNewDashboard(prev => ({ ...prev, slug: e.target.value }))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Description (Optional)</span>
                        </label>
                        <textarea
                          className="textarea textarea-bordered"
                          placeholder="Brief description of this dashboard"
                          value={newDashboard.description}
                          onChange={(e) => setNewDashboard(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label cursor-pointer">
                          <span className="label-text">Make Public</span>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={newDashboard.isPublic}
                            onChange={(e) => setNewDashboard(prev => ({ ...prev, isPublic: e.target.checked }))}
                          />
                        </label>
                      </div>

                      <div className="card-actions justify-end">
                        <button className="btn btn-ghost" onClick={() => setShowCreateForm(false)}>
                          Cancel
                        </button>
                        <button 
                          className="btn btn-primary"
                          onClick={handleCreateDashboard}
                          disabled={!newDashboard.name || !newDashboard.slug}
                        >
                          Create Dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing Dashboards */}
                <div className="space-y-4">
                  {dashboards.map((dashboard) => (
                    <div key={dashboard._id} className="card bg-base-100 shadow-xl">
                      <div className="card-body">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="card-title">{dashboard.name}</h3>
                            <p className="text-sm opacity-70">/{dashboard.slug}</p>
                            {dashboard.description && (
                              <p className="text-sm mt-2">{dashboard.description}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="form-control">
                              <label className="label cursor-pointer">
                                <span className="label-text mr-2">Public</span>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={dashboard.isPublic}
                                  onChange={() => handleTogglePublic(dashboard._id, dashboard.isPublic)}
                                />
                              </label>
                            </div>
                            
                            <button 
                              className="btn btn-error btn-sm"
                              onClick={() => handleDeleteDashboard(dashboard._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manage Markets Tab */}
            {activeTab === "manage" && (
              <div>
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-2xl font-bold">Manage Prediction Markets</h2>
                  
                  {/* Filter and Sort Controls */}
                  <div className="flex gap-4">
                    {/* Dashboard Filter Dropdown */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Filter by Dashboard:</span>
                      </label>
                      <select
                        className="select select-bordered w-48"
                        value={selectedDashboard}
                        onChange={(e) => setSelectedDashboard(e.target.value)}
                      >
                        <option value="all">All Markets</option>
                        <option value="unassigned">Unassigned Markets</option>
                        {dashboards.map((dashboard) => (
                          <option key={dashboard._id} value={dashboard._id}>
                            {dashboard.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Sort by:</span>
                      </label>
                      <select
                        className="select select-bordered w-48"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <option value="status-date">Status + Recent</option>
                        <option value="date-newest">Date (Newest)</option>
                        <option value="date-oldest">Date (Oldest)</option>
                        <option value="title-az">Title (A-Z)</option>
                        <option value="title-za">Title (Z-A)</option>
                        <option value="source">Source</option>
                        <option value="category">Category</option>
                        <option value="probability-high">Probability (High)</option>
                        <option value="probability-low">Probability (Low)</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {allPredictions
                    .filter((prediction) => {
                      if (selectedDashboard === "all") return true;
                      if (selectedDashboard === "unassigned") {
                        // Show predictions not assigned to any dashboard
                        return !dashboardMarkets.some(dm => dm.predictionId === prediction._id);
                      }
                      // Show predictions assigned to the selected dashboard
                      return dashboardMarkets.some(dm => 
                        dm.predictionId === prediction._id && dm.dashboardId === selectedDashboard
                      );
                    })
                    .sort((a, b) => {
                      switch (sortBy) {
                        case "status-date":
                          // Active markets first, then by last updated
                          if (a.isActive && !b.isActive) return -1;
                          if (!a.isActive && b.isActive) return 1;
                          return b.lastUpdated - a.lastUpdated;
                        
                        case "date-newest":
                          return b.lastUpdated - a.lastUpdated;
                        
                        case "date-oldest":
                          return a.lastUpdated - b.lastUpdated;
                        
                        case "title-az":
                          return a.title.localeCompare(b.title);
                        
                        case "title-za":
                          return b.title.localeCompare(a.title);
                        
                        case "source":
                          return a.source.localeCompare(b.source);
                        
                        case "category":
                          return a.category.localeCompare(b.category);
                        
                        case "probability-high":
                          return b.probability - a.probability;
                        
                        case "probability-low":
                          return a.probability - b.probability;
                        
                        default:
                          return 0;
                      }
                    })
                    .map((prediction) => {
                      // Get dashboard info for this prediction
                      const dashboardMarket = dashboardMarkets.find(dm => dm.predictionId === prediction._id);
                      const assignedDashboard = dashboardMarket ? 
                        dashboards.find(d => d._id === dashboardMarket.dashboardId) : null;
                      
                      return (
                    <div key={prediction._id} className={`card shadow-xl ${prediction.isActive ? 'bg-base-100' : 'bg-base-200 opacity-60'}`}>
                      <div className="card-body">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="card-title text-lg flex items-center gap-2">
                              {prediction.title}
                              {!prediction.isActive && (
                                <span className="badge badge-error badge-sm">Inactive</span>
                              )}
                              {prediction.isApproved === false && (
                                <span className="badge badge-warning badge-sm">Pending</span>
                              )}
                              {assignedDashboard && (
                                <span className="badge badge-info badge-sm">{assignedDashboard.name}</span>
                              )}
                              {!assignedDashboard && (
                                <span className="badge badge-ghost badge-sm">Unassigned</span>
                              )}
                            </h3>
                            
                            <div className="mt-2 space-y-1 text-sm opacity-70">
                              <p><strong>Source:</strong> {prediction.source}</p>
                              <p><strong>Category:</strong> {prediction.category.replace('_', ' ')}</p>
                              <p><strong>Probability:</strong> {prediction.probability}%</p>
                              <p><strong>Last Updated:</strong> {new Date(prediction.lastUpdated).toLocaleString()}</p>
                              {prediction.sourceUrl && (
                                <p><strong>URL:</strong> 
                                  <a href={prediction.sourceUrl} target="_blank" rel="noopener noreferrer" className="link link-primary ml-1">
                                    {prediction.sourceUrl.length > 50 ? prediction.sourceUrl.substring(0, 50) + '...' : prediction.sourceUrl}
                                  </a>
                                </p>
                              )}
                            </div>

                            {/* Clarification Text Section */}
                            <div className="mt-4">
                              <label className="block text-sm font-medium mb-2">
                                Clarification Text:
                              </label>
                              
                              {editingId === prediction._id ? (
                                <div className="space-y-3">
                                  <textarea
                                    className="textarea textarea-bordered w-full"
                                    placeholder="Enter clarification text (optional)"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleSave(prediction._id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      onClick={handleCancel}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    {prediction.clarificationText ? (
                                      <p className="text-sm opacity-70 p-2 bg-base-200 rounded">
                                        {prediction.clarificationText}
                                      </p>
                                    ) : (
                                      <p className="text-sm opacity-50 italic">
                                        No clarification text set
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    className="btn btn-outline btn-sm ml-4"
                                    onClick={() => handleEdit(prediction)}
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Brier Score Section */}
                            <div className="mt-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Brier Category */}
                                <div className="form-control">
                                  <label className="label">
                                    <span className="label-text font-medium">Brier Category</span>
                                  </label>
                                  <select
                                    className="select select-bordered select-sm"
                                    value={prediction.brierCategory || ""}
                                    onChange={async (e) => {
                                      const category = e.target.value || undefined;
                                      const grade = category && platformGrades ? 
                                        platformGrades[category as keyof typeof platformGrades]?.[prediction.source as keyof typeof platformGrades.culture] : undefined;
                                      
                                      await updateBrierScore({
                                        predictionId: prediction._id,
                                        brierCategory: category as any,
                                        brierGrade: grade
                                      });
                                    }}
                                  >
                                    <option value="">Select category...</option>
                                    <option value="culture">Culture</option>
                                    <option value="economics">Economics</option>
                                    <option value="politics">Politics</option>
                                    <option value="science">Science</option>
                                    <option value="sports">Sports</option>
                                    <option value="technology">Technology</option>
                                  </select>
                                </div>

                                {/* Brier Grade Display */}
                                <div className="form-control">
                                  <label className="label">
                                    <span className="label-text font-medium">Platform Grade</span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <div className="badge badge-outline font-mono">
                                      {prediction.brierGrade || "Not set"}
                                    </div>
                                    <span className="text-xs opacity-70">
                                      ({prediction.source})
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            {prediction.isActive ? (
                              <button
                                className="btn btn-warning btn-sm"
                                onClick={async () => {
                                  if (confirm('Are you sure you want to deactivate this market? It will be hidden from the dashboard.')) {
                                    await deactivatePrediction({ predictionId: prediction._id });
                                  }
                                }}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={async () => {
                                  await reactivatePrediction({ predictionId: prediction._id });
                                }}
                              >
                                Reactivate
                              </button>
                            )}
                            
                            <button
                              className="btn btn-error btn-sm"
                              onClick={async () => {
                                if (confirm('Are you sure you want to permanently delete this market? This action cannot be undone and will delete all historical data.')) {
                                  await deletePrediction({ predictionId: prediction._id });
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Brier Scores Tab */}
            {activeTab === "brier" && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Platform Grade Reference</h2>
                <p className="text-lg opacity-80 mb-6">
                  Use this reference table when categorizing markets in the "Manage Markets" tab. 
                  Grades are automatically assigned based on platform and category selection.
                </p>
                
                {/* Platform Grades Reference */}
                {platformGrades && (
                  <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                      <h3 className="card-title">Platform Grades by Category</h3>
                      <div className="overflow-x-auto">
                        <table className="table">
                          <thead>
                            <tr>
                              <th className="text-base">Category</th>
                              <th className="text-base">Kalshi</th>
                              <th className="text-base">Manifold</th>
                              <th className="text-base">Metaculus</th>
                              <th className="text-base">Polymarket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(platformGrades).map(([category, grades]) => (
                              <tr key={category} className="hover">
                                <td className="font-medium capitalize text-lg">{category}</td>
                                <td className="font-mono text-lg font-bold">{grades.kalshi}</td>
                                <td className="font-mono text-lg font-bold">{grades.manifold}</td>
                                <td className="font-mono text-lg font-bold">{grades.metaculus}</td>
                                <td className="font-mono text-lg font-bold">{grades.polymarket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-sm opacity-70">
                          <strong>Letter grades based on relative Brier scores from n=942 matched markets.</strong>
                        </p>
                        <p className="text-sm opacity-70">
                          Brier scores measure prediction accuracy - lower scores are better. 
                          These grades reflect each platform's relative performance in different categories.
                        </p>
                        <p className="text-sm opacity-70">
                          Source: <a href="https://brier.fyi/" target="_blank" rel="noopener noreferrer" className="link link-primary">brier.fyi</a>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            </div>
          )}
        </Authenticated>
    </>
  );
}