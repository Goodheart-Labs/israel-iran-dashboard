import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../convex/_generated/api";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { Caveats } from "@/components/Caveats";
import { EditableInfo } from "@/components/EditableInfo";
import { ChartVote } from "@/components/ChartVote";
import { ImpliedDateChart } from "@/components/ImpliedDateChart";
import {
  DistributionChart,
  type DistributionSeries,
} from "@/components/DistributionChart";
import {
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

const ANTHROPIC = "#D97757";
const OPENAI = "#10A37F";

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
      "Cumulative odds that Anthropic has completed an IPO by each date. Resolution needs shares actually trading — an announcement or S-1 filing alone is not enough.",
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
  const markets = data as Market[];
  const curves = curveData as ForecastCurve[];

  const ladders = COMPANIES.map((company) => {
    const rungs = ladderFor(markets, company.key);
    const polymarket = curveFor(rungs);

    // Everything we have on this company's timing, blended equally by day:
    // Polymarket's rungs, Metaculus's community CDF, and Kalshi's ladder.
    const others = curves.filter((c) => c.topic === company.key);
    const blend: CumulativePoint[][] = [
      polymarket,
      ...others.map((c) => c.points.map((pt) => ({ date: new Date(pt.t), p: pt.p }))),
    ].filter((curve) => curve.length > 1);

    // One line: how the blended forecast's implied date has moved.
    const polymarketOverTime = impliedDateSeries(
      rungs
        .filter((m) => m.resolveDate)
        .map((m) => ({ resolveDate: m.resolveDate!, history: m.history })),
    );
    const overTime: ImpliedDateSeries[] = [
      {
        name: "Blended forecast",
        color: company.color,
        points: blendImpliedSeries([
          polymarketOverTime,
          ...others
            .filter((c) => (c.medianHistory?.length ?? 0) > 1)
            .map((c) => c.medianHistory!),
        ]),
      },
    ].filter((s) => s.points.length > 1);

    // Each source as its own probability distribution over the IPO date.
    const sourceDistributions = [
      { label: "Polymarket", url: undefined as string | undefined, note: company.blurb, curve: polymarket },
      ...others.map((c) => ({
        label: c.label,
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
      others,
      blend,
      overTime,
      sourceDistributions,
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

  const fmtDay = (d: Date | null) => (d ? format(d, "MMM d, yyyy") : "—");

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          When will Anthropic and OpenAI IPO?
        </h1>
        <p className="text-sm opacity-50">
          Real-money forecasts from Polymarket · Updated continuously
        </p>
      </div>

      {/* Headline: the market-implied median day for each company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {ladders.map((company) => (
          <div key={company.key} className="card bg-base-100">
            <div className="card-body">
              <span
                className="text-4xl font-bold tracking-tight whitespace-nowrap"
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
            </div>
          </div>
        ))}
      </div>

      {/* The central chart */}
      <div className="card bg-base-100 mb-8">
        <div className="card-body">
          <h3 className="card-title text-lg mb-1">
            When will each IPO land? — probability by month
          </h3>
          <EditableInfo slot="ipo:central-chart">
            {`Each line is the chance that company's IPO lands in that month, derived from the cumulative "IPO by date" prices (differenced at month-ends, interpolated between rungs). The gap between the two humps is the market's answer to who goes first, and by how long. Beyond Jun 2027 both are a thin tail.`}
          </EditableInfo>
          <DistributionChart series={distribution} />
          <ChartVote slot="ipo:central-chart" />
        </div>
      </div>

      {/* Per company: how the blend has moved, then each source on its own */}
      {ladders.map((company) => (
        <section key={company.key} className="mb-10">
          <h3
            className="text-xl font-semibold mb-4"
            style={{ color: company.color }}
          >
            {company.name}
          </h3>

          <div className="card bg-base-100 mb-6">
            <div className="card-body">
              <h4 className="font-semibold mb-1">
                How the implied date has moved
              </h4>
              <EditableInfo slot={`ipo:${company.key}:over-time`}>
                {`The blended forecast's implied IPO date, on each day it was made. Polymarket's share comes from rebuilding its whole ladder for that day and reading where it crossed 50%; Metaculus contributes its community centre once it starts forecasting.`}
              </EditableInfo>
              <ImpliedDateChart series={company.overTime} />
              <ChartVote slot={`ipo:${company.key}:over-time`} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {company.sourceDistributions.map((source) => (
              <div key={source.label} className="card bg-base-100">
                <div className="card-body">
                  <h4 className="font-semibold mb-1">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        {source.label}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      source.label
                    )}
                  </h4>
                  <EditableInfo
                    slot={`ipo:${company.key}:${source.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  >
                    {source.note ??
                      "Chance the IPO lands in each month, as this source prices it."}
                  </EditableInfo>
                  <DistributionChart
                    height={240}
                    series={[
                      {
                        name: source.label,
                        color: company.color,
                        points: source.points,
                      },
                    ]}
                  />
                  <ChartVote
                    slot={`ipo:${company.key}:${source.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  />
                </div>
              </div>
            ))}
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
