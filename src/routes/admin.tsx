import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Check, X, Eye, EyeOff, ExternalLink } from "lucide-react";
import { api } from "../../convex/_generated/api";

const pendingReviewQueryOptions = convexQuery(api.predictions.getPendingReview, {});
const allForReviewQueryOptions = convexQuery(api.predictions.getAllForReview, {});

export const Route = createFileRoute("/admin")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(pendingReviewQueryOptions);
    await queryClient.ensureQueryData(allForReviewQueryOptions);
  },
  component: AdminPage,
});

const categoryColors = {
  elections: "badge-primary",
  riots: "badge-error", 
  voting_rights: "badge-warning",
  press_freedom: "badge-info",
  civil_liberties: "badge-success",
  democratic_norms: "badge-secondary",
  stability: "badge-accent"
} as const;

const categoryLabels = {
  elections: "Elections",
  riots: "Civil Unrest",
  voting_rights: "Voting Rights", 
  press_freedom: "Press Freedom",
  civil_liberties: "Civil Liberties",
  democratic_norms: "Democratic Norms",
  stability: "Stability"
} as const;

function AdminPage() {
  const [selectedTab, setSelectedTab] = useState<"pending" | "all">("pending");
  const [selectedPredictions, setSelectedPredictions] = useState<Set<string>>(new Set());
  
  const { data: pendingPredictions } = useSuspenseQuery(pendingReviewQueryOptions);
  const { data: allPredictions } = useSuspenseQuery(allForReviewQueryOptions);
  
  const approvePrediction = useMutation(api.predictions.approvePrediction);
  const rejectPrediction = useMutation(api.predictions.rejectPrediction);
  const bulkApprove = useMutation(api.predictions.bulkApprovePredictions);
  
  const currentPredictions = selectedTab === "pending" ? pendingPredictions : allPredictions;
  
  const handleToggleSelection = (id: string) => {
    const newSelected = new Set(selectedPredictions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPredictions(newSelected);
  };
  
  const handleBulkApprove = async () => {
    if (selectedPredictions.size > 0) {
      await bulkApprove({ ids: Array.from(selectedPredictions) as any[] });
      setSelectedPredictions(new Set());
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Admin: Manage Predictions</h1>
        <p className="opacity-80">
          Review and approve predictions for display on the dashboard. 
          Only approved predictions will appear to users.
        </p>
      </div>

      {/* Stats */}
      <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Pending Review</div>
          <div className="stat-value text-warning">{pendingPredictions.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Total Predictions</div>
          <div className="stat-value">{allPredictions.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Approved</div>
          <div className="stat-value text-success">
            {allPredictions.filter(p => p.isApproved).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="not-prose tabs tabs-boxed mb-6">
        <button 
          className={`tab ${selectedTab === "pending" ? "tab-active" : ""}`}
          onClick={() => setSelectedTab("pending")}
        >
          Pending Review ({pendingPredictions.length})
        </button>
        <button 
          className={`tab ${selectedTab === "all" ? "tab-active" : ""}`}
          onClick={() => setSelectedTab("all")}
        >
          All Predictions ({allPredictions.length})
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedPredictions.size > 0 && (
        <div className="not-prose mb-6 p-4 bg-base-200 rounded-lg flex items-center gap-4">
          <span>{selectedPredictions.size} selected</span>
          <button 
            className="btn btn-success btn-sm"
            onClick={handleBulkApprove}
          >
            <Check className="w-4 h-4" />
            Approve Selected
          </button>
          <button 
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedPredictions(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Predictions List */}
      <div className="not-prose space-y-4">
        {currentPredictions.map((prediction) => (
          <div 
            key={prediction._id} 
            className={`card bg-base-100 shadow-sm border ${
              selectedPredictions.has(prediction._id) ? "border-primary" : ""
            }`}
          >
            <div className="card-body p-4">
              <div className="flex items-start gap-4">
                {/* Selection Checkbox */}
                <input
                  type="checkbox"
                  className="checkbox mt-1"
                  checked={selectedPredictions.has(prediction._id)}
                  onChange={() => handleToggleSelection(prediction._id)}
                />
                
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-base">{prediction.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{prediction.probability}%</span>
                      {prediction.isApproved === true && (
                        <Eye className="w-4 h-4 text-success" title="Approved" />
                      )}
                      {prediction.isApproved === false && (
                        <EyeOff className="w-4 h-4 text-error" title="Rejected" />
                      )}
                    </div>
                  </div>
                  
                  {prediction.description && (
                    <p className="text-sm opacity-70 mb-3">{prediction.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${categoryColors[prediction.category as keyof typeof categoryColors]}`}>
                        {categoryLabels[prediction.category as keyof typeof categoryLabels]}
                      </span>
                      <span className="badge badge-outline">{prediction.source}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {prediction.sourceUrl && (
                        <a 
                          href={prediction.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      
                      {prediction.isApproved !== true && (
                        <button
                          className="btn btn-success btn-xs"
                          onClick={() => approvePrediction({ id: prediction._id })}
                        >
                          <Check className="w-3 h-3" />
                          Approve
                        </button>
                      )}
                      
                      {prediction.isApproved !== false && (
                        <button
                          className="btn btn-error btn-xs"
                          onClick={() => rejectPrediction({ id: prediction._id })}
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {currentPredictions.length === 0 && (
          <div className="text-center py-12 opacity-50">
            <p>No predictions to review</p>
          </div>
        )}
      </div>
    </div>
  );
}