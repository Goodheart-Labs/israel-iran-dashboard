import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MarketChart } from "@/components/MarketChart";
import { CombinedChart, type ChartSeries } from "@/components/CombinedChart";
import { formatDistanceToNow } from "date-fns";

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

// Group titles for combined charts
const GROUP_TITLES: Record<string, string> = {
  nuclear_deal: "Nuclear Deal",
  hormuz: "Strait of Hormuz Closure",
  ceasefire_conflict: "Ceasefire vs. Conflict Ends",
  us_invasion: "US Ground Invasion of Iran",
  nuclear_weapon: "Iran Nuclear Weapon",
  islamic_republic: "Iran Ceases to be Islamic Republic",
};

// Source badge styling
const SOURCE_BADGE: Record<string, string> = {
  polymarket: "badge-info",
  kalshi: "badge-warning",
  metaculus: "badge-secondary",
};

type Market = {
  _id: string;
  title: string;
  probability: number;
  previousProbability?: number;
  source: string;
  sourceUrl?: string;
  lastUpdated: number;
  clarificationText?: string;
  chartGroup?: string;
  chartColor?: string;
  sortOrder?: number;
  history: Array<{ timestamp: number; probability: number }>;
};

function HomePage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);
  const { data: lastUpdate } = useSuspenseQuery(lastUpdateQuery);

  // Group markets by chartGroup
  const groups = new Map<string, Market[]>();
  const ungrouped: Market[] = [];

  for (const market of markets as Market[]) {
    if (market.chartGroup) {
      if (!groups.has(market.chartGroup)) {
        groups.set(market.chartGroup, []);
      }
      groups.get(market.chartGroup)!.push(market);
    } else {
      ungrouped.push(market);
    }
  }

  // Sort groups by the sortOrder of their first market
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    const orderA = a[1][0]?.sortOrder ?? 999;
    const orderB = b[1][0]?.sortOrder ?? 999;
    return orderA - orderB;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Iran Geopolitical Risk Dashboard
        </h1>
        <p className="text-lg opacity-80">
          Tracking prediction markets and forecasts on Iran
        </p>
        {lastUpdate.timestamp && (
          <p className="text-sm opacity-60 mt-2">
            Last updated{" "}
            {formatDistanceToNow(new Date(lastUpdate.timestamp))} ago
            {!lastUpdate.success && (
              <span className="text-error"> (failed)</span>
            )}
          </p>
        )}
      </div>

      <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedGroups.map(([groupKey, groupMarkets]) => {
          const isCombined = groupMarkets.length > 1;
          const title = GROUP_TITLES[groupKey] || groupKey;

          if (isCombined) {
            return (
              <CombinedCard
                key={groupKey}
                title={title}
                markets={groupMarkets}
              />
            );
          }

          // Single market in group — render as standalone
          return <SingleCard key={groupKey} market={groupMarkets[0]} />;
        })}

        {/* Ungrouped markets (legacy) */}
        {ungrouped.map((market) => (
          <SingleCard key={market._id} market={market} />
        ))}
      </div>

      {/* Data Sources */}
      <div className="not-prose mt-12 text-center opacity-70">
        <p>Data from: Polymarket • Kalshi • Metaculus</p>
      </div>

      {/* Support Link */}
      <div className="not-prose mt-8 text-center pb-4">
        <p className="text-lg">
          Built by{" "}
          <a
            href="https://goodheartlabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary"
          >
            Goodheart Labs
          </a>{" "}
          — support this project via{" "}
          <a
            href="https://nathanpmyoung.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary"
          >
            Substack
          </a>
        </p>
      </div>
    </div>
  );
}

/** Card for a group of 2+ markets on one chart */
function CombinedCard({
  title,
  markets,
}: {
  title: string;
  markets: Market[];
}) {
  const series: ChartSeries[] = markets.map((m) => ({
    label: m.title,
    color: m.chartColor || "#3B82F6",
    source: m.source,
    probability: m.probability,
    history: m.history,
  }));

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">{title}</h3>

        {/* Probability badges for each market */}
        <div className="flex flex-wrap gap-3 mb-3">
          {markets.map((m) => (
            <div key={m._id} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: m.chartColor || "#3B82F6" }}
              />
              <span className="text-lg font-bold">{m.probability}%</span>
              <ProbTrend market={m} />
              <span
                className={`badge badge-xs ${SOURCE_BADGE[m.source] || "badge-ghost"}`}
              >
                {m.source}
              </span>
            </div>
          ))}
        </div>

        <CombinedChart series={series} />

        {/* Links row */}
        <div className="flex flex-wrap gap-3 mt-3 text-sm">
          {markets.map((m) =>
            m.sourceUrl ? (
              <a
                key={m._id}
                href={m.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary text-xs"
              >
                {m.source} →
              </a>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

/** Card for a single standalone market */
function SingleCard({ market }: { market: Market }) {
  return (
    <div className="card bg-base-100 shadow-xl">
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

          <div className="text-right flex-shrink-0">
            <div className="text-xl font-bold text-primary">
              {market.probability}%
            </div>
            <ProbTrend market={market} />
          </div>
        </div>

        <MarketChart history={market.history} />

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="opacity-50 capitalize">
            <span
              className={`badge badge-xs mr-2 ${SOURCE_BADGE[market.source] || "badge-ghost"}`}
            >
              {market.source}
            </span>
            {new Date(market.lastUpdated).toLocaleDateString()}
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
  );
}

/** Tiny trend indicator */
function ProbTrend({ market }: { market: Market }) {
  if (!market.previousProbability) return null;
  const diff = market.probability - market.previousProbability;
  if (diff === 0) return null;

  return (
    <span className="text-xs">
      {diff > 0 ? (
        <span className="text-success flex items-center">
          <TrendingUp className="w-3 h-3 mr-0.5" />+{diff}
        </span>
      ) : (
        <span className="text-error flex items-center">
          <TrendingDown className="w-3 h-3 mr-0.5" />
          {diff}
        </span>
      )}
    </span>
  );
}
