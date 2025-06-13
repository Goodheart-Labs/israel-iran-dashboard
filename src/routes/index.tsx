import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from "../../convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";

const featuredPredictionsQueryOptions = convexQuery(api.predictions.getFeaturedPredictions, {});
const riskScoreQueryOptions = convexQuery(api.predictions.getGeopoliticalRiskScore, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(featuredPredictionsQueryOptions),
      queryClient.ensureQueryData(riskScoreQueryOptions),
    ]);
  },
  component: HomePage,
});

function HomePage() {
  const { data: featuredPredictions } = useSuspenseQuery(featuredPredictionsQueryOptions);
  const { data: riskScore } = useSuspenseQuery(riskScoreQueryOptions);
  const getPolymarketHistoricalData = useAction(api.predictions.getPolymarketHistoricalData);
  const [historicalData, setHistoricalData] = useState<Record<string, any[]>>({});
  const [loadingHistorical, setLoadingHistorical] = useState(true);

  // Extract slug from sourceUrl
  const getSlugFromUrl = (sourceUrl: string) => {
    const match = sourceUrl.match(/polymarket\.com\/event\/([^/]+)/);
    return match ? match[1] : null;
  };

  // Fetch historical data for all Polymarket markets on load (H5N1 approach)
  useEffect(() => {
    const fetchAllHistoricalData = async () => {
      const dataMap: Record<string, any[]> = {};
      
      for (const prediction of featuredPredictions) {
        const slug = getSlugFromUrl(prediction.sourceUrl || "");
        
        if (slug && prediction.source === "polymarket") {
          try {
            const data = await getPolymarketHistoricalData({ slug });
            dataMap[prediction._id] = data;
          } catch (error) {
            console.error(`Error fetching historical data for ${slug}:`, error);
            dataMap[prediction._id] = [];
          }
        } else {
          dataMap[prediction._id] = [];
        }
      }
      
      setHistoricalData(dataMap);
      setLoadingHistorical(false);
    };

    if (featuredPredictions?.length > 0) {
      void fetchAllHistoricalData();
    }
  }, [featuredPredictions, getPolymarketHistoricalData]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Iran Geopolitical Risk Dashboard</h1>
        <p className="text-lg opacity-80">
          Tracking prediction markets and forecasts on Iran's geopolitical developments
        </p>
      </div>

      {/* Overall Health Score */}
      <div className="not-prose mb-8">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body text-center">
            <div className="stat">
              <div className="stat-value text-4xl">Current central question undefined</div>
            </div>
            <div className="text-xs opacity-50 mt-2">
              Last updated: {new Date(riskScore.lastUpdated).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Prediction Markets Grid */}
      <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-6">
        {featuredPredictions
          .sort((a, b) => {
            // Put both markets with minimal data at the bottom
            if (a.title.includes("US-Iran nuclear agreement")) return 1;
            if (b.title.includes("US-Iran nuclear agreement")) return -1;
            if (a.title.includes("1000+ deaths")) return 1;
            if (b.title.includes("1000+ deaths")) return -1;
            
            // Sort by data availability - markets with historical data first
            const aHasData = a.history && a.history.length > 0;
            const bHasData = b.history && b.history.length > 0;
            if (aHasData && !bHasData) return -1;
            if (!aHasData && bHasData) return 1;
            return 0;
          })
          .map((prediction) => {
          // Use fresh historical data from H5N1 approach or stored data
          const freshData = historicalData[prediction._id] || [];
          const chartData = freshData.length > 0 
            ? freshData.map(point => ({
                date: new Date(point.date).toLocaleDateString(),
                probability: point.probability
              }))
            : prediction.history && prediction.history.length > 0 
              ? prediction.history.map(h => ({
                  date: new Date(h.timestamp).toLocaleDateString(),
                  probability: h.probability
                }))
              : [];

          return (
            <div key={prediction._id} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">{prediction.title}</h3>
                
                {/* Chart */}
                <div className="bg-base-200 rounded-lg p-4" style={{ height: '300px' }}>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          stroke="#9CA3AF"
                        />
                        <YAxis 
                          domain={[0, 100]}
                          tick={{ fontSize: 12 }}
                          stroke="#9CA3AF"
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          formatter={(value) => [`${String(value)}%`, 'Probability']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="probability" 
                          stroke="#8B5CF6" 
                          strokeWidth={3}
                          dot={{ fill: '#8B5CF6', strokeWidth: 1, r: 1 }}
                          activeDot={{ r: 4, fill: '#8B5CF6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <div className="text-lg font-medium opacity-70 mb-2">
                          {loadingHistorical ? "Loading Historical Data..." : "No Historical Data"}
                        </div>
                        <div className="text-sm opacity-50">
                          {loadingHistorical 
                            ? "Fetching fresh market data..." 
                            : "Historical price data not available for this market"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Current probability display */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{prediction.probability}%</div>
                    <div className="text-sm opacity-70">Current Probability</div>
                  </div>
                  {prediction.previousProbability && (
                    <div className="text-right">
                      {prediction.probability > prediction.previousProbability ? (
                        <span className="text-success flex items-center">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{prediction.probability - prediction.previousProbability}%
                        </span>
                      ) : (
                        <span className="text-error flex items-center">
                          <TrendingDown className="w-4 h-4 mr-1" />
                          -{prediction.previousProbability - prediction.probability}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {prediction.description && (
                  <p className="text-sm opacity-70 mt-4">{prediction.description}</p>
                )}
                
                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="opacity-50 capitalize">
                    {prediction.source} • {new Date(prediction.lastUpdated).toLocaleDateString()}
                  </span>
                  {prediction.sourceUrl && (
                    <a 
                      href={prediction.sourceUrl} 
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
          );
        })}
      </div>

      {/* Data Sources */}
      <div className="not-prose mt-12 text-center opacity-70">
        <p>Data from: Adjacent News • Metaculus • Kalshi • Polymarket • PredictIt • Manifold Markets</p>
      </div>

      {/* Support Link */}
      <div className="not-prose mt-8 text-center pb-8">
        <p className="text-lg mb-2">
          Built by <a href="https://goodheartlabs.com" target="_blank" rel="noopener noreferrer" className="link link-primary">Goodheart Labs</a> to support similar projects, please purchase a subscription <a href="https://nathanpmyoung.substack.com" target="_blank" rel="noopener noreferrer" className="link link-primary">here</a>
        </p>
        <p className="text-sm opacity-70">
          Vibecoded using <a href="https://github.com/Crazytieguy/fullstack-vibe-coding-template" target="_blank" rel="noopener noreferrer" className="link link-primary">Fullstack Vibe Coding</a> template
        </p>
      </div>
    </div>
  );
}

