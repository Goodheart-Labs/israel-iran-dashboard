import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Vote, Radio, Users, Scale, FileText } from "lucide-react";
import { api } from "../../convex/_generated/api";

const predictionsQueryOptions = convexQuery(api.predictions.getGroupedByCategory, {});
const healthScoreQueryOptions = convexQuery(api.predictions.getDemocraticHealthScore, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(predictionsQueryOptions),
      queryClient.ensureQueryData(healthScoreQueryOptions),
    ]);
  },
  component: HomePage,
});

const categoryConfig = {
  elections: {
    label: "Free & Fair Elections",
    icon: Vote,
    color: "primary",
    description: "Electoral integrity and democratic processes"
  },
  riots: {
    label: "Civil Unrest",
    icon: AlertTriangle,
    color: "error",
    description: "Riots and political violence"
  },
  voting_rights: {
    label: "Voting Rights",
    icon: Shield,
    color: "warning",
    description: "Access to voting and suppression"
  },
  press_freedom: {
    label: "Press Freedom",
    icon: Radio,
    color: "info",
    description: "Journalism and media independence"
  },
  civil_liberties: {
    label: "Civil Liberties",
    icon: Users,
    color: "success",
    description: "Individual rights and freedoms"
  },
  democratic_norms: {
    label: "Democratic Norms",
    icon: Scale,
    color: "secondary",
    description: "Institutional norms and practices"
  },
  stability: {
    label: "Stability Metrics",
    icon: FileText,
    color: "accent",
    description: "Overall democratic health indicators"
  }
} as const;

function HomePage() {
  const { data: predictionsByCategory } = useSuspenseQuery(predictionsQueryOptions);
  const { data: healthScore } = useSuspenseQuery(healthScoreQueryOptions);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">US Democratic Health Dashboard</h1>
        <p className="text-lg opacity-80">
          Tracking prediction markets and forecasts on democratic institutions
        </p>
      </div>

      {/* Overall Health Score */}
      <div className="not-prose mb-8">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-2xl">Democratic Health Score</h2>
            <div className="stat">
              <div className="stat-value text-6xl">{healthScore.overallScore}%</div>
              <div className="stat-desc">Weighted score across {healthScore.totalPredictions} active predictions</div>
            </div>
            <div className="text-xs opacity-50 mt-2">
              Last updated: {new Date(healthScore.lastUpdated).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((category) => {
          const config = categoryConfig[category];
          const predictions = predictionsByCategory[category] || [];
          const Icon = config.icon;
          
          // Use weighted category score from health score calculation
          const categoryScore = healthScore.categoryScores[category];
          const categoryAvg = categoryScore?.score || null;

          return (
            <div key={category} className={`card bg-base-100 shadow-xl border-t-4 border-${config.color}`}>
              <div className="card-body">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="card-title text-lg">
                    <Icon className="w-5 h-5" />
                    {config.label}
                  </h2>
                  {categoryAvg !== null && (
                    <div className="flex items-center gap-2">
                      <div className={`badge badge-${config.color} badge-lg`}>{categoryAvg}%</div>
                      {categoryScore && (
                        <div className="badge badge-outline badge-sm">
                          {Math.round(categoryScore.weight * 100)}% weight
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm opacity-70 mb-4">
                  {config.description}
                  {categoryScore && ` • ${categoryScore.count} predictions`}
                </p>
                
                {predictions.length === 0 ? (
                  <p className="text-sm opacity-50">No active predictions</p>
                ) : (
                  <div className="space-y-3">
                    {predictions.map((prediction) => (
                      <PredictionItem key={prediction._id} prediction={prediction} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Sources */}
      <div className="not-prose mt-12 text-center opacity-70">
        <p>Data from: Adjacent News • Metaculus • Kalshi • Polymarket • PredictIt • Manifold Markets</p>
      </div>
    </div>
  );
}

function PredictionItem({ prediction }: { prediction: any }) {
  const trend = prediction.previousProbability 
    ? prediction.probability - prediction.previousProbability
    : 0;

  return (
    <div className="border rounded-lg p-3 bg-base-200/50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium flex-1">{prediction.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{prediction.probability}%</span>
          {trend !== 0 && (
            <span className={`flex items-center text-xs ${trend > 0 ? 'text-success' : 'text-error'}`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
      
      {prediction.description && (
        <p className="text-xs opacity-70 mt-1">{prediction.description}</p>
      )}
      
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs opacity-50">
          {prediction.source} • Updated {new Date(prediction.lastUpdated).toLocaleDateString()}
        </span>
        {prediction.sourceUrl && (
          <a 
            href={prediction.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs link link-primary"
          >
            View →
          </a>
        )}
      </div>
    </div>
  );
}