import { ExternalLink, Sun, Moon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect, type ReactNode } from "react";
import { MarketChart } from "@/components/MarketChart";
import { CombinedChart, type ChartSeries } from "@/components/CombinedChart";
import { TimelineChart } from "@/components/TimelineChart";
import { scaleToTimestamp } from "@/lib/metaculusScale";
import { EditableInfo } from "@/components/EditableInfo";
import { ChartVote } from "@/components/ChartVote";

export type FootnoteDef = {
  id: number;
  source: string;
  url: string;
  fullText: string;
};

export type GroupResolution = {
  summary: string;
  footnotes: FootnoteDef[];
};

export type Market = {
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

const LIGHT_THEME = "minimal";
const DARK_THEME = "dark-analyst";

export function TopicDashboard({
  topic,
  title,
  subtitle,
  markets,
  groupTitles,
  groupResolutions,
  groupDaysToShow,
  groupKeys,
  footer,
}: {
  /** Prefix for editable-text and vote slots, e.g. "iran". */
  topic: string;
  title: string;
  subtitle?: string;
  markets: Market[];
  groupTitles: Record<string, string>;
  groupResolutions: Record<string, GroupResolution>;
  groupDaysToShow?: Record<string, number>;
  /** Optional allowlist of chartGroup keys to render. If omitted, render all groups. */
  groupKeys?: string[];
  footer?: ReactNode;
}) {
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

  const allowedSet = groupKeys ? new Set(groupKeys) : null;

  const groups = new Map<string, Market[]>();
  const ungrouped: Market[] = [];

  for (const market of markets) {
    if (market.chartGroup) {
      if (allowedSet && !allowedSet.has(market.chartGroup)) continue;
      if (!groups.has(market.chartGroup)) {
        groups.set(market.chartGroup, []);
      }
      groups.get(market.chartGroup)!.push(market);
    } else if (!allowedSet) {
      ungrouped.push(market);
    }
  }

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    const orderA = a[1][0]?.sortOrder ?? 999;
    const orderB = b[1][0]?.sortOrder ?? 999;
    return orderA - orderB;
  });

  const visibleMarkets = [...sortedGroups.flatMap(([, ms]) => ms), ...ungrouped];
  const mostRecent =
    visibleMarkets.length > 0
      ? Math.max(...visibleMarkets.map((m) => m.lastUpdated))
      : null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-end mb-4">
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-sm btn-square"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">{title}</h1>
        <p className="text-sm opacity-50">
          {subtitle ?? "Forecasting data from Polymarket, Kalshi, and Metaculus"}
          {mostRecent && (
            <span>
              {" "}
              &middot; Updated {formatDistanceToNow(new Date(mostRecent))} ago
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(() => {
          let footnoteCounter = 1;
          return sortedGroups.map(([groupKey, groupMarkets]) => {
            const groupTitle = groupTitles[groupKey] || groupKey;
            const resolution = groupResolutions[groupKey];

            const numberedFootnotes = resolution?.footnotes.map((fn) => ({
              ...fn,
              id: footnoteCounter++,
            }));

            const resolutionWithNumbers = resolution
              ? { summary: resolution.summary, footnotes: numberedFootnotes }
              : undefined;

            const isDateGroup = groupMarkets.some(
              (m) => m.questionType === "date"
            );
            if (isDateGroup) {
              return (
                <TimelineCard
                  key={groupKey}
                  slot={`${topic}:${groupKey}`}
                  title={groupTitle}
                  market={groupMarkets[0]}
                  resolution={resolutionWithNumbers}
                />
              );
            }

            return (
              <CombinedCard
                key={groupKey}
                slot={`${topic}:${groupKey}`}
                title={groupTitle}
                markets={groupMarkets}
                daysToShow={groupDaysToShow?.[groupKey]}
                resolution={resolutionWithNumbers}
              />
            );
          });
        })()}

        {ungrouped.map((market) => (
          <SingleCard key={market._id} market={market} />
        ))}
      </div>

      {footer}

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

function Footnote({ footnote }: { footnote: FootnoteDef }) {
  return (
    <span className="group/fn">
      <a
        href={footnote.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-base-content/50 hover:text-base-content/80 cursor-pointer align-super ml-0.5"
      >
        [{footnote.id}]
      </a>
      <div className="hidden group-hover/fn:block absolute z-50 left-0 right-0 mt-1 p-3 rounded-lg bg-base-300 text-base-content text-sm shadow-xl border border-base-content/20 max-h-64 overflow-y-auto">
        <div className="font-semibold mb-1">
          <span className="inline-flex items-center gap-1">
            {footnote.source}
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
        <p className="text-base-content/70 text-xs leading-relaxed">
          {footnote.fullText}
        </p>
      </div>
    </span>
  );
}

function ResolutionSummary({
  slot,
  resolution,
}: {
  slot: string;
  resolution: GroupResolution;
}) {
  return (
    <div className="relative not-prose">
      <EditableInfo
        slot={slot}
        trailing={resolution.footnotes.map((fn) => (
          <Footnote key={fn.id} footnote={fn} />
        ))}
      >
        {resolution.summary}
      </EditableInfo>
    </div>
  );
}

function CombinedCard({
  slot,
  title,
  markets,
  daysToShow,
  resolution,
}: {
  slot: string;
  title: string;
  markets: Market[];
  daysToShow?: number;
  resolution?: GroupResolution;
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
        {resolution && (
          <ResolutionSummary slot={`${slot}:info`} resolution={resolution} />
        )}

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
        <ChartVote slot={slot} />
      </div>
    </div>
  );
}

function TimelineCard({
  slot,
  title,
  market,
  resolution,
}: {
  slot: string;
  title: string;
  market: Market;
  resolution?: GroupResolution;
}) {
  const center01 = market.probability / 100;
  const rangeMin = market.scalingRangeMin ?? 0;
  const rangeMax = market.scalingRangeMax ?? 1;
  const predictedTimestamp = scaleToTimestamp(
    center01,
    rangeMin,
    rangeMax,
    market.scalingZeroPoint,
  );
  const predictedYear = new Date(predictedTimestamp * 1000).getFullYear();

  const label = market.shortLabel || market.source;

  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">{title}</h3>
        {resolution && (
          <ResolutionSummary slot={`${slot}:info`} resolution={resolution} />
        )}

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
          scalingZeroPoint={market.scalingZeroPoint}
          color={market.chartColor || "#8B5CF6"}
        />
        <ChartVote slot={slot} />
      </div>
    </div>
  );
}

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
