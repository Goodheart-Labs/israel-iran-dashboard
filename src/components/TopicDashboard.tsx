import { ExternalLink, Info, Sun, Moon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { MarketChart } from "@/components/MarketChart";
import { CombinedChart, type ChartSeries } from "@/components/CombinedChart";
import { TimelineChart } from "@/components/TimelineChart";
import { scaleToTimestamp } from "@/lib/metaculusScale";
import { EditableInfo } from "@/components/EditableInfo";
import { ChartVote } from "@/components/ChartVote";
import { VotedCard } from "@/components/VotedCard";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { chartScore } from "@/lib/helpfulness";
import { isPastDeadline } from "@/lib/marketPresentation";

export type FootnoteDef = {
  id: number;
  source: string;
  url: string;
  fullText: string;
};

export type GroupResolution = {
  summary: string;
  notice?: string;
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
  resolveDate?: number;
  historySampling?: "daily-and-recent" | "source-daily-and-recent" | "recent";
  historyNote?: string;
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
  const votes = useQuery(api.chartVotes.listAll);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
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
      : false,
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
    const scoreDifference = chartScore((votes ?? []).filter((v) => v.slot === `${topic}:${b[0]}`))
      - chartScore((votes ?? []).filter((v) => v.slot === `${topic}:${a[0]}`));
    const orderA = a[1][0]?.sortOrder ?? 999;
    const orderB = b[1][0]?.sortOrder ?? 999;
    return scoreDifference || orderA - orderB;
  });
  const currentGroups = sortedGroups.filter(([, ms]) => !isPastDeadline(ms, now));
  const archivedGroups = sortedGroups.filter(([, ms]) => isPastDeadline(ms, now));
  const renderGroup = ([groupKey, groupMarkets]: [string, Market[]]) => {
    const props = {
      slot: `${topic}:${groupKey}`,
      title: groupTitles[groupKey] || groupKey,
      resolution: groupResolutions[groupKey],
    };
    const dateMarket = groupMarkets.find((m) => m.questionType === "date");
    return dateMarket
      ? <TimelineCard key={groupKey} {...props} market={dateMarket} />
      : <CombinedCard key={groupKey} {...props} markets={groupMarkets} daysToShow={groupDaysToShow?.[groupKey]} />;
  };

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
          {subtitle ??
            "Forecasting data from Polymarket, Kalshi, and Metaculus"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {currentGroups.map(renderGroup)}

        {ungrouped.map((market) => (
          <SingleCard key={market._id} market={market} />
        ))}
      </div>

      {archivedGroups.length > 0 && (
        <details className="my-8 border-t border-base-300 pt-4">
          <summary className="cursor-pointer py-2 text-sm font-medium">Past closing dates · {archivedGroups.length} questions</summary>
          <p className="my-3 text-xs opacity-60">These sources’ stored closing dates have passed. Figures are last recorded forecasts, not confirmed outcomes.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{archivedGroups.map(renderGroup)}</div>
        </details>
      )}

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
          </a>{" "}
          &middot; Support this project by buying a subscription on{" "}
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
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = hovered || pinned;
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) { setPinned(false); setHovered(false); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div ref={ref} className="inline-block text-xs"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setPinned(false); setHovered(false); } }}
      onKeyDown={(event) => { if (event.key === "Escape") { setPinned(false); setHovered(false); } }}>
      <button type="button" className="inline-flex min-h-10 items-center gap-1 underline decoration-dotted underline-offset-4 opacity-65 hover:opacity-100"
        aria-expanded={open} aria-controls={id} onClick={() => { setPinned(!pinned); setHovered(false); }}>
        <Info className="w-3 h-3" /> {footnote.source} rules
      </button>
      <div id={id} hidden={!open} className="absolute left-0 right-0 z-30 rounded-md border border-base-300 bg-base-100 p-4 shadow-lg max-h-72 overflow-y-auto">
      <p className="leading-relaxed opacity-80 mb-2">{footnote.fullText}</p>
      <a
        href={footnote.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 underline py-2"
      >
        Original question <ExternalLink className="w-3 h-3" />
      </a>
      </div>
    </div>
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
      >
        {resolution.summary}
      </EditableInfo>
      <div className="flex flex-wrap gap-x-4 -mt-3 mb-2">
        {resolution.footnotes.map((fn) => <Footnote key={fn.source + fn.url} footnote={fn} />)}
      </div>
      {resolution.notice && <p className="border-l-2 border-base-300 pl-3 mb-3 text-sm">{resolution.notice}</p>}
    </div>
  );
}

function SourceFreshness({ market }: { market: Market }) {
  const past = market.resolveDate !== undefined && market.resolveDate <= Date.now();
  return <div className="text-xs basis-full text-base-content/60" title={market.historyNote}>
    <time dateTime={new Date(market.lastUpdated).toISOString()} title={new Date(market.lastUpdated).toLocaleString()}>
      {past ? "Last recorded" : "Updated"} {formatDistanceToNow(market.lastUpdated, { addSuffix: true })}
    </time>
    {market.resolveDate !== undefined
      ? <span> · Stored closing date: {new Date(market.resolveDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}{past ? " · Closed-date forecast, outcome unverified" : ""}</span>
      : <span> · Closing date unavailable</span>}
  </div>;
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
    label: m.shortLabel || m.source,
    color: m.chartColor || "#3B82F6",
    source: m.source,
    probability: m.probability,
    history: m.history,
    sourceUrl: m.sourceUrl,
    lastUpdated: m.lastUpdated,
    resolveDate: m.resolveDate,
    historyNote: m.historyNote,
  }));

  return (
    <VotedCard slot={slot}>
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">{title}</h3>
        {resolution && (
          <ResolutionSummary slot={`${slot}:info`} resolution={resolution} />
        )}

        <CombinedChart series={series} daysToShow={daysToShow} />
        <ChartVote slot={slot} />
      </div>
    </VotedCard>
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
    <VotedCard slot={slot}>
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">{title}</h3>
        {resolution && (
          <ResolutionSummary slot={`${slot}:info`} resolution={resolution} />
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
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
          {market.history.some((p) => p.lowerBound !== undefined && p.upperBound !== undefined) && <span className="text-xs opacity-50">(shaded area: 90% interval)</span>}
          <SourceFreshness market={market} />
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
    </VotedCard>
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
            {market.source} ·{" "}
            {new Date(market.lastUpdated).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
