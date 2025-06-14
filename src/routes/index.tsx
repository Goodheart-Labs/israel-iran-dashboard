import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from "../../convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { Authenticated, Unauthenticated } from "convex/react";

const featuredPredictionsQueryOptions = convexQuery(api.predictions.getFeaturedPredictions, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(featuredPredictionsQueryOptions);
  },
  component: HomePage,
});

function HomePage() {
  const { data: featuredPredictions } = useSuspenseQuery(featuredPredictionsQueryOptions);
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
      <div className="flex justify-between items-start mb-8">
        <div className="text-center flex-1">
          <h1 className="text-4xl font-bold mb-4">Iran Geopolitical Risk Dashboard [TEST-2025]</h1>
          <p className="text-lg opacity-80">
            Tracking prediction markets and forecasts on Iran's geopolitical developments
          </p>
        </div>
        
        <div className="flex-shrink-0 ml-4">
          <Unauthenticated>
            <SignInButton mode="modal">
              <button className="btn btn-outline btn-sm">Sign In</button>
            </SignInButton>
          </Unauthenticated>
          <Authenticated>
            <UserButton />
          </Authenticated>
        </div>
      </div>


      {/* Featured Prediction Markets Grid */}
      <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-6">
        {featuredPredictions
          .sort((a: any, b: any) => {
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
          .map((prediction: any) => {
          // Use fresh historical data from H5N1 approach or stored data
          const freshData = historicalData[prediction._id] || [];
          const chartData = freshData.length > 0 
            ? freshData.map(point => ({
                date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                probability: point.probability
              }))
            : prediction.history && prediction.history.length > 0 
              ? prediction.history.map((h: any) => ({
                  date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  probability: h.probability
                }))
              : [];
          
          // Get the most recent probability from chart data
          const currentProbability = chartData.length > 0 
            ? chartData[chartData.length - 1].probability 
            : prediction.probability;

          return (
            <div key={prediction._id} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 mr-4">
                    {prediction.sourceUrl ? (
                      <h3 className="card-title text-lg mb-1">
                        <a 
                          href={prediction.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="link link-hover"
                        >
                          {prediction.title}
                        </a>
                      </h3>
                    ) : (
                      <h3 className="card-title text-lg mb-1">{prediction.title}</h3>
                    )}
                    {/* Clarification text directly under title */}
                    {prediction.clarificationText && (
                      <p className="text-sm opacity-70">{prediction.clarificationText}</p>
                    )}
                  </div>
                  
                  {/* Current probability display - top right */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold text-primary">{currentProbability}%</div>
                    {prediction.previousProbability && (
                      <div className="text-xs">
                        {currentProbability > prediction.previousProbability ? (
                          <span className="text-success flex items-center justify-end">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            +{currentProbability - prediction.previousProbability}%
                          </span>
                        ) : (
                          <span className="text-error flex items-center justify-end">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            -{prediction.previousProbability - currentProbability}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Chart */}
                <div className="bg-base-200 rounded-lg p-2" style={{ height: '260px' }}>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          stroke="#9CA3AF"
                          interval="preserveStartEnd"
                          angle={-45}
                          textAnchor="end"
                          height={40}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={[0, 100]}
                          tick={{ fontSize: 10 }}
                          stroke="#9CA3AF"
                          label={{ value: '%', angle: 0, position: 'top' }}
                          width={30}
                          tickLine={false}
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
                          stroke="#3B82F6" 
                          strokeWidth={2.5}
                          dot={{ fill: '#3B82F6', strokeWidth: 0, r: 0 }}
                          activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
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
        <p>🚀 DEPLOYMENT TEST 2025 🚀</p>
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

