import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/status")({
  component: StatusPage,
});

function StatusPage() {
  const predictions = useQuery(api.predictions.getActive) || [];
  
  // Get the most recent history point for each market
  const marketStatus = predictions.map(pred => {
    const lastUpdate = pred.lastUpdated ? new Date(pred.lastUpdated) : null;
    const minutesAgo = lastUpdate 
      ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000 / 60)
      : null;
    
    return {
      title: pred.title,
      probability: pred.probability,
      lastUpdate: lastUpdate?.toLocaleString() || 'Never',
      minutesAgo,
      isStale: minutesAgo && minutesAgo > 15 // Consider stale if > 15 minutes
    };
  });
  
  const staleCount = marketStatus.filter(m => m.isStale).length;
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">System Status</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-lg">Active Markets</h2>
            <div className="stat-value">{predictions.length}</div>
          </div>
        </div>
        
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-lg">Update Schedule</h2>
            <div className="text-lg">Every 5 minutes</div>
          </div>
        </div>
        
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-lg">Stale Markets</h2>
            <div className={`stat-value ${staleCount > 0 ? 'text-warning' : 'text-success'}`}>
              {staleCount}
            </div>
          </div>
        </div>
      </div>
      
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Market Update Status</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Current %</th>
                  <th>Last Update</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {marketStatus.map((market, idx) => (
                  <tr key={idx}>
                    <td className="max-w-xs truncate">{market.title}</td>
                    <td>{market.probability}%</td>
                    <td>
                      {market.lastUpdate}
                      {market.minutesAgo && (
                        <span className="text-xs opacity-70 ml-2">
                          ({market.minutesAgo}m ago)
                        </span>
                      )}
                    </td>
                    <td>
                      {market.isStale ? (
                        <span className="badge badge-warning">Stale</span>
                      ) : (
                        <span className="badge badge-success">Fresh</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <a href="/" className="btn btn-outline">Back to Dashboard</a>
      </div>
    </div>
  );
}