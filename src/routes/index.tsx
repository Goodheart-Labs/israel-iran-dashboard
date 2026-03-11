import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Sun, Moon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MarketChart } from "@/components/MarketChart";
import { CombinedChart, type ChartSeries } from "@/components/CombinedChart";
import { TimelineChart } from "@/components/TimelineChart";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";

const simpleMarketsQuery = convexQuery(api.simple.getMarkets, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(simpleMarketsQuery);
  },
  component: HomePage,
});

// Group titles for combined charts
const GROUP_TITLES: Record<string, string> = {
  nuclear_deal: "Nuclear Deal Before 2027",
  hormuz: "Strait of Hormuz Closure Before 2027",
  ceasefire: "US/Iran Ceasefire Before April",
  us_invasion: "US Ground Invasion of Iran Before 2027",
  nuclear_weapon: "Iran Nuclear Weapon Before 2030",
  islamic_republic: "Iran Ceases to be Islamic Republic",
};

// Per-group chart config
const GROUP_DAYS_TO_SHOW: Record<string, number> = {
  us_invasion: 7,
};

const LIGHT_THEME = "minimal";
const DARK_THEME = "dark-analyst";


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
  shortLabel?: string;
  sortOrder?: number;
  questionType?: "binary" | "date";
  scalingRangeMin?: number;
  scalingRangeMax?: number;
  scalingZeroPoint?: number;
  history: Array<{
    timestamp: number;
    probability: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
};

function HomePage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);
  // null = follow system, true/false = manual override
  const [manualDark, setManualDark] = useState<boolean | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard-theme-override");
      if (saved === "dark") return true;
      if (saved === "light") return false;
    }
    return null;
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  // Listen for OS theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = manualDark ?? systemDark;

  useEffect(() => {
    const theme = isDark ? DARK_THEME : LIGHT_THEME;
    document.documentElement.setAttribute("data-theme", theme);
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setManualDark(next);
    localStorage.setItem("dashboard-theme-override", next ? "dark" : "light");
  };

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

  const mostRecent =
    (markets as Market[]).length > 0
      ? Math.max(...(markets as Market[]).map((m) => m.lastUpdated))
      : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Day/night toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-sm btn-square"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          Iran Geopolitical Risk Dashboard
        </h1>
        <p className="text-sm opacity-50">
          Forecasting data from Polymarket, Kalshi, and Metaculus
          {mostRecent && (
            <span>
              {" "}
              &middot; Updated {formatDistanceToNow(new Date(mostRecent))} ago
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedGroups.map(([groupKey, groupMarkets]) => {
          const title = GROUP_TITLES[groupKey] || groupKey;

          // Date question groups get a timeline chart
          const isDateGroup = groupMarkets.some(
            (m) => m.questionType === "date"
          );
          if (isDateGroup) {
            return (
              <TimelineCard
                key={groupKey}
                title={title}
                market={groupMarkets[0]}
              />
            );
          }

          return (
            <CombinedCard
              key={groupKey}
              title={title}
              markets={groupMarkets}
              daysToShow={GROUP_DAYS_TO_SHOW[groupKey]}
            />
          );
        })}

        {/* Ungrouped markets (legacy) */}
        {ungrouped.map((market) => (
          <SingleCard key={market._id} market={market} />
        ))}
      </div>

      <SuggestionsPanel />

      {/* Footer */}
      <div className="mt-12 pb-8 text-center text-sm opacity-50">
        <p>
          Built by{" "}
          <a
            href="https://goodheartlabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
          >
            Goodheart Labs
          </a>
          {" "}&middot; Support this project by buying a subscription on{" "}
          <a
            href="https://nathanpmyoung.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
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
  daysToShow,
}: {
  title: string;
  markets: Market[];
  daysToShow?: number;
}) {
  const series: ChartSeries[] = markets.map((m) => ({
    label: m.title,
    color: m.chartColor || "#3B82F6",
    source: m.source,
    probability: m.probability,
    history: m.history,
  }));

  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">{title}</h3>

        {/* Market names with probabilities */}
        <div className="flex flex-wrap gap-3 mb-3">
          {markets.map((m) => {
            const label = m.shortLabel || m.source;

            return (
              <div key={m._id} className="flex items-center gap-2">
                <span className="text-lg font-bold">{m.probability}%</span>

                {m.sourceUrl ? (
                  <a
                    href={m.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                    style={{ color: m.chartColor || "#3B82F6" }}
                  >
                    {label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span
                    className="text-sm font-medium"
                    style={{ color: m.chartColor || "#3B82F6" }}
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <CombinedChart series={series} daysToShow={daysToShow} />
      </div>
    </div>
  );
}

/** Card for a date question (timeline chart with confidence band) */
function TimelineCard({ title, market }: { title: string; market: Market }) {
  // Transform the 0-1 center to a year for the headline display
  const center01 = market.probability / 100;
  const rangeMin = market.scalingRangeMin ?? 0;
  const rangeMax = market.scalingRangeMax ?? 1;
  const predictedTimestamp = rangeMin + (rangeMax - rangeMin) * center01;
  const predictedYear = new Date(predictedTimestamp * 1000).getFullYear();

  const label = market.shortLabel || market.source;

  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">{title}</h3>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold">~{predictedYear}</span>
          {market.sourceUrl ? (
            <a
              href={market.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline inline-flex items-center gap-1"
              style={{ color: market.chartColor || "#8B5CF6" }}
            >
              {label}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span
              className="text-sm font-medium"
              style={{ color: market.chartColor || "#8B5CF6" }}
            >
              {label}
            </span>
          )}
          <span className="text-xs opacity-50">(shaded area 90% CI)</span>
        </div>

        <TimelineChart
          history={market.history}
          scalingRangeMin={rangeMin}
          scalingRangeMax={rangeMax}
          color={market.chartColor || "#8B5CF6"}
        />
      </div>
    </div>
  );
}

/** Card for a single standalone market */
function SingleCard({ market }: { market: Market }) {
  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 mr-4">
            {market.sourceUrl ? (
              <h3 className="card-title text-lg mb-1">
                <a
                  href={market.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {market.title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </h3>
            ) : (
              <h3 className="card-title text-lg mb-1">
                {market.title}
              </h3>
            )}
            {market.clarificationText && (
              <p className="text-sm opacity-70">{market.clarificationText}</p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-xl font-bold text-primary">
              {market.probability}%
            </div>

          </div>
        </div>

        <MarketChart history={market.history} />

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="opacity-50 capitalize">
            {market.source} · {new Date(market.lastUpdated).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

