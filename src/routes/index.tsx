import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MarketChart } from "@/components/MarketChart";
import { formatDistanceToNow } from 'date-fns';

// Use the simple query - no circular dependencies
const simpleMarketsQuery = convexQuery(api.simple.getMarkets, {});
const lastUpdateQuery = convexQuery(api.systemStatus.getLastUpdate, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(simpleMarketsQuery),
      queryClient.ensureQueryData(lastUpdateQuery),
    ]);
  },
  component: HomePage,
});

function HomePage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);
  const { data: lastUpdate } = useSuspenseQuery(lastUpdateQuery);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Technical Difficulties Banner */}
      <div className="alert alert-warning mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <div>
          <h3 className="font-bold">Nathan's vibecoding is experiencing technical difficulties</h3>
          <div className="text-sm">The current probabilities shown are incorrect. 
            <a href="https://github.com/Zezo-Ai/israel-iran-dashboard" target="_blank" rel="noopener noreferrer" className="link link-accent ml-1">
              Help fix the issues on GitHub
            </a>
          </div>
        </div>
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Iran Geopolitical Risk Dashboard</h1>
        <p className="text-lg opacity-80">
          Tracking prediction markets and forecasts on Iran's geopolitical developments
        </p>
        {lastUpdate.timestamp && (
          <p className="text-sm opacity-60 mt-2">
            Last updated {formatDistanceToNow(new Date(lastUpdate.timestamp))} ago
            {!lastUpdate.success && <span className="text-error"> (failed)</span>}
          </p>
        )}
      </div>

      {/* Simple Markets Grid */}
      <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-6">
        {markets.map((market: any) => (
          <div key={market._id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 mr-4">
                  {market.sourceUrl ? (
                    <h3 className="card-title text-lg mb-1">
                      <a 
                        href={market.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="link link-hover"
                      >
                        {market.title}
                      </a>
                    </h3>
                  ) : (
                    <h3 className="card-title text-lg mb-1">{market.title}</h3>
                  )}
                  {market.clarificationText && (
                    <p className="text-sm opacity-70">{market.clarificationText}</p>
                  )}
                </div>
                
                {/* Current probability display */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold text-primary">{market.probability}%</div>
                  {market.previousProbability && (
                    <div className="text-xs">
                      {market.probability > market.previousProbability ? (
                        <span className="text-success flex items-center justify-end">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          +{market.probability - market.previousProbability}%
                        </span>
                      ) : (
                        <span className="text-error flex items-center justify-end">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          -{market.previousProbability - market.probability}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Historical chart */}
              <MarketChart history={market.history} />
              
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="opacity-50 capitalize">
                  {market.source} • {new Date(market.lastUpdated).toLocaleDateString()}
                </span>
                {market.sourceUrl && (
                  <a 
                    href={market.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="link link-primary"
                  >
                    View Market →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Sources */}
      <div className="not-prose mt-12 text-center opacity-70">
        <p>Data from: Adjacent News • Metaculus • Kalshi • Polymarket • PredictIt • Manifold Markets</p>
      </div>

      {/* Support Link */}
      <div className="not-prose mt-8 text-center pb-4">
        <p className="text-lg">
          Built by <a href="https://goodheartlabs.com" target="_blank" rel="noopener noreferrer" className="link link-primary">Goodheart Labs</a> to support similar projects, please purchase a subscription <a href="https://nathanpmyoung.substack.com" target="_blank" rel="noopener noreferrer" className="link link-primary">here</a>
        </p>
      </div>
    </div>
  );
}