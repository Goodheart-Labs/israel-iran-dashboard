import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Bomb, RadioTower, Users, Swords, FileText, Atom, DollarSign } from "lucide-react";
import { api } from "../../convex/_generated/api";

const predictionsQueryOptions = convexQuery(api.predictions.getGroupedByCategory, {});
const riskScoreQueryOptions = convexQuery(api.predictions.getGeopoliticalRiskScore, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(predictionsQueryOptions),
      queryClient.ensureQueryData(riskScoreQueryOptions),
    ]);
  },
  component: HomePage,
});

const categoryConfig = {
  military_action: {
    label: "Military Action",
    icon: Bomb,
    color: "error",
    description: "Direct military conflict and strikes"
  },
  nuclear_program: {
    label: "Nuclear Program",
    icon: Atom,
    color: "warning",
    description: "Nuclear enrichment and weapons development"
  },
  sanctions: {
    label: "Sanctions",
    icon: DollarSign,
    color: "info",
    description: "Economic sanctions and embargoes"
  },
  regional_conflict: {
    label: "Regional Conflict",
    icon: Swords,
    color: "secondary",
    description: "Proxy conflicts and regional tensions"
  },
  israel_relations: {
    label: "Israel Relations",
    icon: Shield,
    color: "primary",
    description: "Iran-Israel tensions and confrontations"
  },
  protests: {
    label: "Internal Protests",
    icon: Users,
    color: "success",
    description: "Anti-government protests and unrest"
  },
  regime_stability: {
    label: "Regime Stability",
    icon: FileText,
    color: "accent",
    description: "Government stability and continuity"
  }
} as const;

function HomePage() {
  const { data: predictionsByCategory } = useSuspenseQuery(predictionsQueryOptions);
  const { data: riskScore } = useSuspenseQuery(riskScoreQueryOptions);

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
            <h2 className="card-title justify-center text-2xl">Geopolitical Risk Level</h2>
            <div className="stat">
              <div className="stat-value text-6xl">{riskScore.overallScore}%</div>
              <div className="stat-desc">Weighted risk score across {riskScore.totalPredictions} active predictions</div>
            </div>
            <div className="text-xs opacity-50 mt-2">
              Last updated: {new Date(riskScore.lastUpdated).toLocaleString()}
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
          
          // Use weighted category score from risk score calculation
          const categoryScore = riskScore.categoryScores[category];
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

      {/* Support Link */}
      <div className="not-prose mt-8 text-center pb-8">
        <a 
          href="https://nathanpmyoung.substack.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="link link-primary text-lg"
        >
          Buy a subscription if you want to support projects like this
        </a>
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