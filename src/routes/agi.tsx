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
            <div className="px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-9 text-center">
              <p className="text-xs font-medium tracking-[0.14em] uppercase opacity-60">
                Combined median forecast
              </p>
              <div className="my-3 text-[clamp(5rem,12vw,9rem)] leading-none font-semibold tracking-[-0.06em] tabular-nums">
                {latest.value}
              </div>
              {latest.range && (
                <p className="text-sm opacity-70">
                  <span className="font-medium tabular-nums">
                    {latest.range[0]}–{latest.range[1]}
                  </span>
                  <span className="mx-2 opacity-40" aria-hidden="true">/</span>
                  middle 80%
                </p>
              )}
            </div>
            <div className="mx-auto w-full max-w-2xl px-5 pb-5 text-center [&>p]:mb-0">
              <EditableInfo slot="agi:headline:info">
                A blend of forecasts using different definitions of AGI. This
                date is an index, not a prediction for one precisely defined
                event.
              </EditableInfo>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-base-300 px-5 py-3 sm:px-8">
              <div className="text-xs leading-relaxed opacity-60">
                Forecast dated{" "}
                {new Date(latest.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {data.unavailableSources.includes("kalshi") && (
                  <span className="block sm:inline">
                    <span className="hidden sm:inline"> · </span>
                    Four forecast series; Kalshi unavailable.
                  </span>
                )}
              </div>
              <div className="ml-auto [&>div]:mt-0">
                <ChartVote slot="agi:headline" />
              </div>
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
