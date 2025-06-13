import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/router";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

const featuredPredictionsQueryOptions = convexQuery(api.predictions.getFeaturedPredictions, {});

export const Route = createFileRoute("/admin")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(featuredPredictionsQueryOptions);
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: predictions } = useSuspenseQuery(featuredPredictionsQueryOptions);
  const updateClarificationText = useMutation(api.predictions.updateClarificationText);
  const [editingId, setEditingId] = useState<Id<"predictions"> | null>(null);
  const [editText, setEditText] = useState("");

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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      <p className="text-lg opacity-80 mb-8">
        Manage clarification text for prediction markets
      </p>

      <div className="space-y-6">
        {predictions.map((prediction) => (
          <div key={prediction._id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">{prediction.title}</h3>
              
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
              
              <div className="mt-4 text-sm opacity-50">
                Source: {prediction.source} • {new Date(prediction.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}