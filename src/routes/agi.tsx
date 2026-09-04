import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AgiChart } from "@/components/AgiChart";
import { ChartVote } from "@/components/ChartVote";
import { VotedCard } from "@/components/VotedCard";
import { EditableInfo } from "@/components/EditableInfo";
import { Caveats } from "@/components/Caveats";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { fetchAgiDashboard, type AgiSource } from "@/lib/agi";

export const Route = createFileRoute("/agi")({ component: AgiPage });

function AgiPage() {
  const query = useQuery({
    queryKey: ["agi-dashboard"],
    queryFn: ({ signal }) => fetchAgiDashboard(signal),
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
  });
  const data = query.data;
  const latest = data?.index[data.index.length - 1];
  const index: AgiSource = {
    id: "index",
    name: "Combined forecast",
    color: "#475569",
    kind: "year",
    url: "https://github.com/Goodheart-Labs/agi-timelines-dashboard",
    definition: "",
    points: data?.index ?? [],
  };
  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8">
        <h1>When might we achieve AGI?</h1>
        <p className="text-sm opacity-60">
          Forecasts from Metaculus, Manifold and Kalshi, across different
          definitions of AGI.
        </p>
      </header>
      {query.isPending && (
        <p role="status" className="py-12 text-sm opacity-60">
          Loading AGI forecasts…
        </p>
      )}
      {query.isError && (
        <div
          role="alert"
          className="border border-base-300 rounded p-4 mb-6 text-sm"
        >
          {data
            ? "The latest refresh failed; showing the last loaded forecasts."
            : "AGI forecasts are temporarily unavailable."}{" "}
          <button
            className="underline"
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {data && latest && (
        <>
          <VotedCard slot="agi:headline" className="mb-8">
            <div className="card-body">
              <div className="text-4xl sm:text-5xl font-semibold tracking-tight">
                {latest.value}
              </div>
              <p className="text-sm opacity-65">
                Combined median forecast
                {latest.range
                  ? ` · middle 80%: ${latest.range[0]}–${latest.range[1]}`
                  : ""}
              </p>
              <EditableInfo slot="agi:headline:info">
                The original AGI dashboard’s combined forecast, using the same
                calculation and source data. These questions use different
                definitions; the combined date is an index, not a forecast for
                one precisely defined event.
              </EditableInfo>
              <p className="text-xs opacity-50">
                Forecast dated{" "}
                {new Date(latest.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              {data.unavailableSources.includes("kalshi") && (
                <p className="text-xs opacity-65">
                  Kalshi is currently unavailable. The index uses the other four
                  forecast series.
                </p>
              )}
              <ChartVote slot="agi:headline" />
            </div>
          </VotedCard>
          <VotedCard slot="agi:combined" className="mb-8">
            <div className="card-body">
              <h3 className="card-title">How AGI forecasts have moved</h3>
              <EditableInfo slot="agi:combined:info">
                Lines show the median arrival year forecast on each date.
                Shading is the combined distribution’s 10th–90th percentile
                range. Kalshi contributes a before-2030 probability to the
                index, so its raw forecast is shown separately below.
              </EditableInfo>
              <AgiChart
                sources={[
                  index,
                  ...data.sources.filter((s) => s.kind === "year"),
                ]}
                bandId="index"
              />
              <ChartVote slot="agi:combined" />
            </div>
          </VotedCard>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.sources.map((source) => (
              <VotedCard key={source.id} slot={`agi:${source.id}`}>
                <div className="card-body">
                  <h3 className="card-title">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {source.name} ↗
                    </a>
                  </h3>
                  <EditableInfo slot={`agi:${source.id}:info`}>
                    {source.definition}
                  </EditableInfo>
                  <AgiChart
                    sources={[source]}
                    bandId={source.kind === "year" ? source.id : undefined}
                  />
                  <ChartVote slot={`agi:${source.id}`} />
                </div>
              </VotedCard>
            ))}
          </div>
          <p className="mb-8 text-xs opacity-60">
            The index averages the four main forecast distributions, with
            Kalshi’s before-2030 market contributing a fifth share when
            available. Source definitions and horizons differ. The shaded bands
            represent forecast uncertainty, not statistical confidence in the
            index.
          </p>
        </>
      )}
      <Caveats topic="agi" />
      <SuggestionsPanel topic="agi" />
      <footer className="py-8 text-center text-xs opacity-50">
        Originally built by Nathan Young and Rob Gordon at{" "}
        <a href="https://goodheartlabs.com" className="underline">
          Goodheart Labs
        </a>
        , funded by Jaan Tallinn.{" "}
        <a
          href="https://github.com/Goodheart-Labs/agi-timelines-dashboard"
          className="underline"
        >
          Source
        </a>{" "}
        ·{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          className="underline"
        >
          CC BY 4.0
        </a>
      </footer>
    </div>
  );
}
