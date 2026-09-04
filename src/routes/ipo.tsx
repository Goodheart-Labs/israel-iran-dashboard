import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../convex/_generated/api";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { Caveats } from "@/components/Caveats";
import { EditableInfo } from "@/components/EditableInfo";
import { ChartVote } from "@/components/ChartVote";
import { VotedCard } from "@/components/VotedCard";
import { ImpliedDateChart } from "@/components/ImpliedDateChart";
import {
  ValuationAlternatives,
  type ValuationForecast,
} from "@/components/ValuationAlternatives";
import {
  DistributionChart,
  type DistributionSeries,
} from "@/components/DistributionChart";
import {
  applyLagDistribution,
  blendedMedianDay,
  blendedMonthlyDistribution,
  blendImpliedSeries,
  impliedDateSeries,
  monthlyDistribution,
  type CumulativePoint,
} from "@/lib/ipoForecast";
import type { ImpliedDateSeries } from "@/components/ImpliedDateChart";

type ForecastCurve = {
  _id: string;
  key: string;
  topic: string;
  source: string;
  label: string;
  sourceUrl?: string;
  note?: string;
  points: Array<{ t: number; p: number }>;
  medianHistory?: Array<{ t: number; impliedT: number }>;
};

type Market = {
  _id: string;
  title: string;
  probability: number;
  source: string;
  sourceUrl?: string;
  chartGroup?: string;
  chartColor?: string;
  shortLabel?: string;
  resolveDate?: number;
  history: Array<{ timestamp: number; probability: number }>;
};

type ValuationMarket = {
  groupItemTitle?: string;
  outcomePrices?: string | string[];
  active?: boolean;
  closed?: boolean;
};

type ValuationEvent = {
  title?: string;
  slug?: string;
  markets?: ValuationMarket[];
};

const ANTHROPIC = "#D97757";
const OPENAI = "#10A37F";

// Kalshi resolves at a late-stage confirmation: S-1 effectiveness, pricing,
// or ticker assignment. Model the remaining time to first trade as uncertain,
// rather than pretending every confirmation has the same fixed delay.
const KALSHI_LISTING_LAG = [
  { days: 1, weight: 0.25 },
  { days: 3, weight: 0.15 },
  { days: 7, weight: 0.2 },
  { days: 14, weight: 0.15 },
  { days: 30, weight: 0.15 },
  { days: 60, weight: 0.1 },
] as const;
const KALSHI_LAG_SUMMARY = "median 7d; central 80%: 1–30d";

const VALUATION_EVENTS = [
  {
    company: "Anthropic",
    color: ANTHROPIC,
    slug: "what-will-anthropics-ipo-valuation-be",
  },
  {
    company: "OpenAI",
    color: OPENAI,
    slug: "what-will-openais-ipo-valuation-be",
  },
] as const;

// The chart window: beyond mid-2027 every source is a thin tail of a few
// percent a month, which just stretches the axis.
const CHART_START = Date.UTC(2026, 5, 1);
const CHART_END = Date.UTC(2027, 6, 1);
// Source cards run a little further, since Metaculus prices into 2027.
const SOURCE_END = Date.UTC(2028, 0, 1);

const COMPANIES = [
  {
    key: "ipo_anthropic",
    name: "Anthropic",
    color: ANTHROPIC,
    blurb:
      "Chance that Anthropic's IPO lands in each month, derived from Polymarket's cumulative \"IPO by date\" rungs. Resolution needs shares actually trading — an announcement or S-1 filing alone is not enough.",
  },
  {
    key: "ipo_openai",
    name: "OpenAI",
    color: OPENAI,
    blurb:
      "The same question for OpenAI. Polymarket's rungs currently stop at the end of 2026, so this says nothing about 2027 and beyond.",
  },
] as const;

const marketsQuery = convexQuery(api.simple.getMarkets, {});
const curvesQuery = convexQuery(api.ipoCurves.listCurves, {});

function yesPrice(value: string | string[] | undefined): number | null {
  try {
    const prices = typeof value === "string" ? JSON.parse(value) : value;
    const price = Number(prices?.[0]);
    return Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

function valuationLowerBound(label: string): number | null {
  if (/^no ipo/i.test(label)) return null;
  if (label.startsWith("<")) return 0;
  const match = label.match(/\$([\d.]+)/);
  return match ? Number(match[1]) : null;
}

function valuationFirstBoundary(labels: string[]): number | null {
  const lowest = labels.find((label) => label.startsWith("<"));
  const match = lowest?.match(/\$([\d.]+)/);
  return match ? Number(match[1]) : null;
}

async function fetchValuationSeries(): Promise<ValuationForecast[]> {
  return Promise.all(
    VALUATION_EVENTS.map(async ({ company, color, slug }) => {
      const response = await fetch(
        `https://gamma-api.polymarket.com/events?slug=${slug}`,
      );
      if (!response.ok)
        throw new Error(`Polymarket valuation: ${response.status}`);
      const events = (await response.json()) as ValuationEvent[];
      const markets = (events[0]?.markets ?? []).filter(
        (market) => market.active !== false && !market.closed,
      );
      const buckets = markets.flatMap((market) => {
        const label = market.groupItemTitle ?? "";
        const lower = valuationLowerBound(label);
        const probability = yesPrice(market.outcomePrices);
        return lower != null && probability != null
          ? [{ label, lower, probability }]
          : [];
      });
      const total = buckets.reduce(
        (sum, bucket) => sum + bucket.probability,
        0,
      );
      const firstBoundary = valuationFirstBoundary(
        markets.map((market) => market.groupItemTitle ?? ""),
      );
      const thresholds = Array.from(
        new Set(buckets.map((bucket) => bucket.lower).filter((n) => n > 0)),
      ).sort((a, b) => a - b);

      return {
        name: company,
        color,
        buckets: buckets
          .sort((a, b) => a.lower - b.lower)
          .map((bucket, index, sorted) => ({
            lower: bucket.lower,
            upper: sorted[index + 1]?.lower ?? null,
            openLower: bucket.label.startsWith("<"),
            probability: bucket.probability,
          })),
        points: thresholds
          .filter(
            (threshold) => firstBoundary == null || threshold >= firstBoundary,
          )
          .map((threshold) => ({
            label: `≥$${Number.isInteger(threshold) ? threshold.toFixed(1) : threshold}T`,
            time: threshold,
            value:
              Math.round(
                (buckets
                  .filter((bucket) => bucket.lower >= threshold)
                  .reduce((sum, bucket) => sum + bucket.probability, 0) /
                  total) *
                  1000,
              ) / 10,
          })),
      };
    }),
  );
}

export const Route = createFileRoute("/ipo")({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(marketsQuery),
      queryClient.ensureQueryData(curvesQuery),
    ]);
  },
  component: IpoPage,
});

/** Rungs of one company's ladder, oldest date first. */
function ladderFor(markets: Market[], group: string): Market[] {
  return markets
    .filter((m) => m.chartGroup === group && m.resolveDate)
    .sort((a, b) => (a.resolveDate ?? 0) - (b.resolveDate ?? 0));
}

function curveFor(rungs: Market[]): CumulativePoint[] {
  return rungs.map((m) => ({
    date: new Date(m.resolveDate!),
    p: m.probability / 100,
  }));
}

function IpoPage() {
  const { data } = useSuspenseQuery(marketsQuery);
  const { data: curveData } = useSuspenseQuery(curvesQuery);
  const { data: valuationSeries = [], isError: valuationError } = useQuery({
    queryKey: ["ipo-valuation-percentiles"],
    queryFn: fetchValuationSeries,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const markets = data as Market[];
  const curves = curveData as ForecastCurve[];

  const ladders = COMPANIES.map((company) => {
    const rungs = ladderFor(markets, company.key);
    const polymarket = curveFor(rungs);

    // Everything we have on this company's timing, blended equally by day:
    // Polymarket's rungs, Metaculus's community CDF, and Kalshi's ladder.
    const rawOthers = curves.filter((c) => c.topic === company.key);
    const adjustedOthers = rawOthers.map((curve) =>
      curve.source === "kalshi"
        ? {
            ...curve,
            label: `Kalshi (lag-adjusted; median +7d)`,
            note: `Kalshi resolves when the S-1 becomes effective, the IPO is priced, or a ticker is assigned—not when shares start trading. We convolve its forecast with a rules-informed confirmation-to-listing lag distribution (${KALSHI_LAG_SUMMARY}; 10% tail at 60d). Its prices are order-book midpoints from thin books.`,
            points: applyLagDistribution(
              curve.points.map((point) => ({
                date: new Date(point.t),
                p: point.p,
              })),
              [...KALSHI_LISTING_LAG],
            ).map((point) => ({
              t: point.date.getTime(),
              p: point.p,
            })),
          }
        : curve,
    );
    const blend: CumulativePoint[][] = [
      polymarket,
      ...adjustedOthers.map((c) =>
        c.points.map((pt) => ({ date: new Date(pt.t), p: pt.p })),
      ),
    ].filter((curve) => curve.length > 1);

    // One line: how the blended forecast's implied date has moved.
    const polymarketOverTime = impliedDateSeries(
      rungs
        .filter((m) => m.resolveDate)
        .map((m) => ({ resolveDate: m.resolveDate!, history: m.history })),
    );
    const overTime: ImpliedDateSeries[] = [
      {
        name: company.name,
        color: company.color,
        points: blendImpliedSeries([
          polymarketOverTime,
          ...rawOthers
            .filter((c) => (c.medianHistory?.length ?? 0) > 1)
            .map((c) => c.medianHistory!),
        ]),
      },
    ].filter((s) => s.points.length > 1);

    const sourceDistributions = [
      {
        label: "Polymarket",
        source: "polymarket",
        url: undefined as string | undefined,
        note: company.blurb,
        curve: polymarket,
      },
      ...rawOthers.map((c) => ({
        label: c.label,
        source: c.source,
        url: c.sourceUrl,
        note: c.note,
        curve: c.points.map((pt) => ({ date: new Date(pt.t), p: pt.p })),
      })),
    ]
      .map((source) => ({
        ...source,
        points: monthlyDistribution(source.curve)
          .filter(
            ({ date }) =>
              date.getTime() >= CHART_START && date.getTime() < SOURCE_END,
          )
          .map(({ date, p }) => ({
            label: format(date, "MMM ''yy"),
            time: date.getTime(),
            value: Math.round(p * 1000) / 10,
          })),
      }))
      .filter((source) => source.points.length > 1);

    return {
      ...company,
      rungs,
      curve: polymarket,
      others: adjustedOthers,
      blend,
      overTime,
      listingSources: sourceDistributions.filter(
        (source) => source.source !== "kalshi",
      ),
      kalshiSource: sourceDistributions.find(
        (source) => source.source === "kalshi",
      ),
      medianDay: blendedMedianDay(blend),
      // The last rung is the furthest-out "by date" Polymarket prices.
      finalRung: rungs[rungs.length - 1],
    };
  });

  const distribution: DistributionSeries[] = ladders
    .map((company) => ({
      name: company.name,
      color: company.color,
      points: blendedMonthlyDistribution(company.blend)
        .filter(
          ({ date }) =>
            date.getTime() >= CHART_START && date.getTime() < CHART_END,
        )
        .map(({ date, p }) => ({
          label: format(date, "MMM ''yy"),
          time: date.getTime(),
          value: Math.round(p * 1000) / 10,
        })),
    }))
    .filter((s) => s.points.length > 0);

  const impliedDateHistory: ImpliedDateSeries[] = ladders.flatMap(
    (company) => company.overTime,
  );

  const fmtDay = (d: Date | null) => (d ? format(d, "MMM d, yyyy") : "—");

  return (
    <div className="max-w-7xl mx-auto">
      <div className="risk-lead mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          When will Anthropic and OpenAI IPO?
        </h1>
        <p className="text-sm opacity-50">
          Forecasting data from Polymarket, Kalshi, and Metaculus · Updated
          continuously
        </p>
      </div>

      {/* Headline: the market-implied median day for each company */}
      <div className="risk-headlines grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {ladders.map((company) => (
          <VotedCard
            key={company.key}
            slot={`ipo:${company.key}:headline-date`}
          >
            <div className="card-body max-sm:p-4">
              <span
                className="text-3xl font-bold tracking-tight sm:text-4xl sm:whitespace-nowrap"
                style={{ color: company.color }}
              >
                {fmtDay(company.medianDay)}
              </span>
              <p className="text-sm opacity-70">
                market-implied day for the {company.name} IPO
              </p>
              <p className="text-xs opacity-50">
                blending{" "}
                {["Polymarket", ...company.others.map((c) => c.label)].join(
                  ", ",
                )}
              </p>
              {company.finalRung && (
                <p className="text-xs opacity-50">
                  {company.finalRung.probability}% chance it has happened{" "}
                  {company.finalRung.shortLabel?.replace("by ", "by ")},{" "}
                  {new Date(company.finalRung.resolveDate!).getFullYear()}
                </p>
              )}
              <ChartVote slot={`ipo:${company.key}:headline-date`} />
            </div>
          </VotedCard>
        ))}
      </div>

      {/* The central chart */}
      <VotedCard slot="ipo:central-chart" className="mb-8">
        <div className="card-body max-sm:p-4">
          <h3 className="card-title text-lg mb-1">
            When will each IPO land? — probability by month
          </h3>
          <EditableInfo slot="ipo:central-chart">
            {`Each line is the chance that company's IPO lands in that month, derived from cumulative "IPO by date" forecasts (differenced at month-ends and interpolated between rungs). Kalshi resolves at a late-stage confirmation rather than first trade, so we convolve its curve with a confirmation-to-listing lag distribution (${KALSHI_LAG_SUMMARY}; 10% tail at 60d). Comparing the two shapes suggests when each IPO may happen; it does not directly estimate the probability that one company goes first. Beyond Jun 2027 both are a thin tail.`}
          </EditableInfo>
          <DistributionChart series={distribution} />
          <ChartVote slot="ipo:central-chart" />
        </div>
      </VotedCard>

      <VotedCard slot="ipo:valuation" className="mb-8">
        <div className="card-body max-sm:p-4">
          <h3 className="card-title text-lg mb-1">
            How large could the IPO valuations be?
          </h3>
          <EditableInfo slot="ipo:valuation">
            {`Bars show the middle 50% of each company's valuation forecast (25th–75th percentiles); the dark mark is the median. Polymarket prices are normalized across valuation outcomes, conditional on an IPO within each market's deadline. Percentiles are interpolated within finite valuation bands; open-ended bands are shown as bounds.`}
          </EditableInfo>
          {valuationError ? (
            <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
              Valuation forecasts are temporarily unavailable.
            </div>
          ) : (
            <ValuationAlternatives forecasts={valuationSeries} />
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-60">
            {VALUATION_EVENTS.map((event) => (
              <a
                key={event.slug}
                href={`https://polymarket.com/event/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {event.company} valuation market ↗
              </a>
            ))}
          </div>
          <ChartVote slot="ipo:valuation" />
        </div>
      </VotedCard>

      <VotedCard slot="ipo:implied-dates-over-time" className="mb-10">
        <div className="card-body max-sm:p-4">
          <h3 className="card-title text-lg mb-1">
            How the implied IPO dates have moved
          </h3>
          <EditableInfo slot="ipo:implied-dates-over-time">
            {`Anthropic and OpenAI on one chart. Each line shows the blended forecast's implied IPO date on each day the underlying forecasts were available. Polymarket's contribution rebuilds the full ladder and reads its 50% crossing; Metaculus contributes its community centre. Kalshi is included in today's headline through the disclosed lag model, but is not included here because we do not have a comparable historical Kalshi series.`}
          </EditableInfo>
          <ImpliedDateChart series={impliedDateHistory} />
          <ChartVote slot="ipo:implied-dates-over-time" />
        </div>
      </VotedCard>

      {/* Per company: each source on its own */}
      {ladders.map((company) => (
        <section key={company.key} className="mb-10">
          <h3
            className="text-xl font-semibold mb-4"
            style={{ color: company.color }}
          >
            {company.name}
          </h3>

          <div className="grid grid-cols-1 gap-6">
            <VotedCard slot={`ipo:${company.key}:listing-sources`}>
              <div className="card-body max-sm:p-4">
                <h4 className="font-semibold mb-1">
                  Listing-date forecasts: Polymarket and Metaculus
                </h4>
                <EditableInfo slot={`ipo:${company.key}:listing-sources`}>
                  {`Both sources forecast when shares will actually trade, so they are shown together. Polymarket is the solid line; Metaculus is dashed. Differences reflect both methodology and participants.`}
                </EditableInfo>
                <DistributionChart
                  height={280}
                  series={company.listingSources.map((source) => ({
                    name: source.label,
                    color: company.color,
                    dash: source.source === "metaculus" ? "6 4" : undefined,
                    points: source.points,
                  }))}
                />
                <ChartVote slot={`ipo:${company.key}:listing-sources`} />
              </div>
            </VotedCard>

            {company.kalshiSource && (
              <VotedCard slot={`ipo:${company.key}:kalshi-announcement`}>
                <div className="card-body max-sm:p-4">
                  <h4 className="font-semibold mb-1">
                    {company.kalshiSource.url ? (
                      <a
                        href={company.kalshiSource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        Kalshi confirmation-date forecast
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      "Kalshi confirmation-date forecast"
                    )}
                  </h4>
                  <EditableInfo slot={`ipo:${company.key}:kalshi-announcement`}>
                    {`This is Kalshi's raw confirmation forecast. Under its rules, confirmation occurs when the S-1 becomes effective, the IPO is priced, or a ticker is assigned. Because that is not quite the first trading day, the top blend applies a probabilistic lag (${KALSHI_LAG_SUMMARY}; 10% tail at 60d). This chart remains unadjusted.`}
                  </EditableInfo>
                  <DistributionChart
                    height={240}
                    yAxisLabel="Chance confirmed this month"
                    series={[
                      {
                        name: "Kalshi confirmation",
                        color: company.color,
                        points: company.kalshiSource.points,
                      },
                    ]}
                  />
                  <ChartVote slot={`ipo:${company.key}:kalshi-announcement`} />
                </div>
              </VotedCard>
            )}
          </div>
        </section>
      ))}

      <div className="mt-6">
        <Caveats topic="ipo" />
      </div>

      <SuggestionsPanel topic="ipo" />

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
        </p>
      </div>
    </div>
  );
}
