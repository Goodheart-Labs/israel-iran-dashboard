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

// Resolution criteria footnotes — numbered continuously across all groups
type FootnoteDef = {
  id: number;
  source: string; // e.g. "Polymarket", "Kalshi", "Metaculus"
  url: string;
  fullText: string; // Verbatim resolution criteria
};

type GroupResolution = {
  summary: string;
  footnotes: FootnoteDef[];
};

// Footnote IDs are assigned dynamically at render time based on display order.
// The `id` fields below are placeholders — the actual numbering comes from
// iterating sortedGroups and counting footnotes sequentially.
const GROUP_RESOLUTION: Record<string, GroupResolution> = {
  nuclear_deal: {
    summary:
      "Resolves Yes if the US and Iran reach a formal written agreement imposing verifiable restrictions on Iran's nuclear program (enrichment limits, centrifuge numbers, or facility operations) in exchange for lifting/modifying at least one US sanction, by Dec 31, 2026. Multilateral deals count if the US participates.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/us-iran-nuclear-deal-before-2027",
        fullText:
          "This market will resolve to 'Yes' if an official agreement over Iranian nuclear research and/or nuclear weapon development, defined as a publicly announced mutual agreement, is reached between the United States and Iran by December 31, 2026, 11:59 PM ET. Otherwise, this market will resolve to 'No'. Can include multilateral deals where US and Iran are parties (e.g., similar to JCPOA structure). Timing of implementation doesn't matter — announcement before the deadline qualifies. Primary resolution sources: official US and/or Iranian government announcements. Secondary source: overwhelming consensus of credible reporting confirming agreement.",
      },
      {
        id: 0,
        source: "Kalshi",
        url: "https://kalshi.com/markets/kxusairanagreement",
        fullText:
          'If the United States has agreed to, signed, or accepted a new Iran-US nuclear deal before Jan 1, 2027, then the market resolves to Yes. Sources from The New York Times, the Associated Press, Reuters, Axios, Politico, Semafor, The Information, The Washington Post, The Wall Street Journal, ABC, CBS, CNN, Fox News, and MSNBC. An agreement also made with other countries (i.e. multilaterally) is still encompassed if the United States participates. "A new Iran-US nuclear deal" means a formal written agreement signed by authorized representatives of both the United States and Iran that (1) imposes verifiable restrictions on Iran\'s nuclear program, including limits on uranium enrichment, centrifuge numbers, or nuclear facility operations, AND (2) provides for the lifting, suspension, or modification of at least one US economic sanction on Iran in exchange for Iran\'s nuclear commitments.',
      },
    ],
  },
  us_forces_enter: {
    summary:
      "Resolves Yes if active US military personnel physically enter Iran's land territory by Dec 31. Special operations forces qualify. Intelligence operatives, military contractors, advisors, and diplomatic visitors do not. Maritime or aerial entry does not count.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/us-forces-enter-iran-by",
        fullText:
          "The market resolves to 'Yes' if active US military personnel physically enter Iran by the specified date; otherwise 'No.' Military special operations forces qualify. Intelligence operatives do not count. Entry must be into terrestrial (land) territory only. Maritime or aerial entry does not count. Military contractors, advisors, or high-ranking officials entering for diplomatic purposes do not qualify. Resolution source: consensus of credible reporting.",
      },
    ],
  },
  nuclear_weapon: {
    summary:
      "Resolves Yes if the Iranian government credibly states it has a nuclear weapon or tests one between Jan 1, 2020 and Jan 1, 2030. Purchase or gift of a nuclear weapon also counts. No delivery missile required — a warhead alone suffices. Civilian/engineering detonations count. Radiological weapons (where fission/fusion energy is sub-dominant to chemical explosives) do not.",
    footnotes: [
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/5253/iran-gets-nuke-by-2030/",
        fullText:
          "This question will resolve as Yes if the Iranian Government credibly states that it has a nuclear weapon or has tested a nuclear weapon at any time between January 1, 2020 to January 1, 2030, according to credible media reports. For these purposes we do not consider a radiological weapon — where any fission/fusion energy is energetically sub-dominant to chemical or other explosives — to constitute a nuclear detonation. For the purpose of this question, no missiles are required to carry the nuclear weapons (e.g. a nuclear warhead alone is sufficient for positive resolution). The deliberate detonation of nuclear weapons primarily for non-offensive engineering, mining or other civilian purposes (on Earth or in Space) will be sufficient to resolve this question as Yes. Purchase of or gift of nuclear weapon to Iran will resolve this question as Yes.",
      },
    ],
  },
  us_invasion: {
    summary:
      "Resolves Yes if the US launches a ground invasion of Iran before 2027. Polymarket requires intent to establish control; Metaculus requires 100+ troops on Iranian soil for 5+ consecutive days.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/will-the-us-invade-iran-before-2027",
        fullText:
          "This market will resolve to 'Yes' if the United States commences a military offensive intended to establish control over any portion of Iran by December 31, 2026, 11:59 PM ET. Otherwise, this market will resolve to 'No'. For the purposes of this market, land de facto controlled by Iran or the United States as of November 4, 2025 12:00 PM ET, will be considered the sovereign territory of that country. The resolution source for this market will be a consensus of credible sources.",
      },
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/38768/will-the-united-states-conduct-a-ground-invasion-of-iran-before-2027/",
        fullText:
          "This question will resolve as Yes if, before January 1, 2027, at least 100 United States ground troops are located within the internationally recognized borders of Iran for more than 5 consecutive days.",
      },
    ],
  },
  islamic_republic: {
    summary:
      'Resolves when a state controlling more than 50% of Iran\'s current territory has a written constitution that does not contain the term "Islamic Republic." If this doesn\'t occur before Jan 1, 2122, resolves as "> December 31, 2121."',
    footnotes: [
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/7770/end-of-islamic-republic-in-iran/",
        fullText:
          'This question resolves when both of the following conditions are satisfied: There is a state which has de facto control of more than 50% (by area) of the land currently controlled by the Islamic Republic of Iran. The constitution of this state does not contain a sentence asserting that the state is an Islamic Republic. If the state does not have a written constitution then this question will resolve as ambiguous. Note that the Constitution must contain the term "Islamic Republic", inclusion of either "Islamic" or "Republic" on their own is not sufficient. If this does not occur before January 1, 2122, then this resolves as "> December 31, 2121".',
      },
    ],
  },
  conflict_ends: {
    summary:
      "Resolves Yes if there is a continuous 14-day period without qualifying military action between Iran, Israel, and the US before June 30. Cyberattacks, sanctions, and proxy forces (Hezbollah, Houthis) do not count.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/iran-x-israelus-conflict-ends-by",
        fullText:
          "This market will resolve to 'Yes' if there is a continuous 14-day period without any qualifying military action between Iran, and Israel and the United States that begins at any time between market creation and the specified end date (ET). Otherwise, this market will resolve to 'No'. A 'military action' is defined as any use of force by Iran, or Israel and the United States against the other's soil, or official embassies or consulates, that is either officially acknowledged by the acting government or confirmed through a clear consensus of credible reporting. Cyberattacks, sanctions, and diplomatic actions do not count. Only actions by Iranian forces explicitly claimed by the Islamic Republic of Iran, or confirmed to have originated from Iranian territory will qualify as Iranian military actions. Attacks on Israel or the US by proxy forces (i.e. Hezbollah, Houthis, etc.) will not count.",
      },
    ],
  },
};

const simpleMarketsQuery = convexQuery(api.simple.getMarkets, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(simpleMarketsQuery);
  },
  component: HomePage,
});

// Group titles for combined charts
const GROUP_TITLES: Record<string, string> = {
  nuclear_deal: "Nuclear deal before 2027",
  hormuz: "Strait of Hormuz closure before 2027",
  ceasefire: "US/Iran ceasefire before April",
  us_invasion: "US ground invasion of Iran before 2027",
  nuclear_weapon: "Iran nuclear weapon before 2030",
  islamic_republic: "Iran ceases to be Islamic Republic",
  conflict_ends: "Conflict ends for 2 weeks before July",
  us_forces_enter: "Any US forces enter Iran before 2027",
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
        {(() => {
          let footnoteCounter = 1;
          return sortedGroups.map(([groupKey, groupMarkets]) => {
            const title = GROUP_TITLES[groupKey] || groupKey;
            const resolution = GROUP_RESOLUTION[groupKey];

            // Assign sequential footnote numbers
            const numberedFootnotes = resolution?.footnotes.map((fn) => ({
              ...fn,
              id: footnoteCounter++,
            }));

            const resolutionWithNumbers = resolution
              ? { summary: resolution.summary, footnotes: numberedFootnotes! }
              : undefined;

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
                  resolution={resolutionWithNumbers}
                />
              );
            }

            return (
              <CombinedCard
                key={groupKey}
                title={title}
                markets={groupMarkets}
                daysToShow={GROUP_DAYS_TO_SHOW[groupKey]}
                resolution={resolutionWithNumbers}
              />
            );
          });
        })()}

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

/** Footnote superscript that shows full resolution text on hover */
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

/** Resolution summary shown below card title */
function ResolutionSummary({
  resolution,
}: {
  resolution: GroupResolution;
}) {
  return (
    <div className="relative text-xs text-base-content/50 leading-relaxed mb-2 not-prose">
      {resolution.summary}
      {resolution.footnotes.map((fn) => (
        <Footnote key={fn.id} footnote={fn} />
      ))}
    </div>
  );
}

/** Card for a group of 2+ markets on one chart */
function CombinedCard({
  title,
  markets,
  daysToShow,
  resolution,
}: {
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
        {resolution && <ResolutionSummary resolution={resolution} />}

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
function TimelineCard({ title, market, resolution }: { title: string; market: Market; resolution?: GroupResolution }) {
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
        {resolution && <ResolutionSummary resolution={resolution} />}

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

