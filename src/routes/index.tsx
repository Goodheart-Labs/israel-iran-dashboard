import { convexQuery } from "@convex-dev/react-query";
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import {
  TopicDashboard,
  type GroupResolution,
  type Market,
} from "@/components/TopicDashboard";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { Caveats } from "@/components/Caveats";
import { fetchPolymarketHistory, mergeRecordedHistory } from "@/lib/polymarketHistory";
import { isPastDeadline } from "@/lib/marketPresentation";

// nuclear_deal is retired: Polymarket resolved it YES (closed, outcome 1) and
// Kalshi's series stopped publishing a last price in March, so the card showed
// a settled question next to a five-month-old number.
const GROUP_TITLES: Record<string, string> = {
  hormuz: "Strait of Hormuz closure before 2027",
  ceasefire: "US/Iran ceasefire",
  us_invasion: "US ground invasion of Iran before 2027",
  nuclear_weapon: "Iran nuclear weapon before 2030",
  islamic_republic: "Iran ceases to be Islamic Republic",
  conflict_ends: "14-day pause in the Iran–Israel/US conflict",
  us_forces_enter: "Any US forces enter Iran before 2027",
};

const IRAN_GROUPS = Object.keys(GROUP_TITLES);

const GROUP_RESOLUTION: Record<string, GroupResolution> = {
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
      "These forecasts use different definitions of a US ground invasion before 2027. Polymarket requires an offensive intended to establish control over Iranian territory by 31 December 2026. Metaculus requires at least 100 US ground troops in Iran for more than five consecutive days before 1 January 2027. The probabilities are not directly comparable.",
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
    notice: "Deadline needs verification: the source title says June 30, but the stored closing date is in March. Do not treat the stored date as the event deadline.",
    summary:
      "Resolves Yes if a continuous 14-day period without qualifying military action between Iran, Israel, and the US begins by the question’s deadline. Cyberattacks, sanctions, and proxy forces (Hezbollah, Houthis) do not count.",
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
  staticData: { title: "Iran" },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(simpleMarketsQuery);
  },
  component: HomePage,
});

function HomePage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);
  const iranMarkets = markets.filter((market) => market.chartGroup && IRAN_GROUPS.includes(market.chartGroup));
  // Metaculus histories are sparse forecast changes, not high-frequency prices.
  // The existing per-question query retains bounds and avoids the shared 500-row cap.
  const storedMarkets = iranMarkets.filter((market) => market.source === "metaculus" || isPastDeadline([market], Date.now()));
  const storedQueries = useQueries({
    queries: storedMarkets.map((market) => convexQuery(api.predictions.getHistory, { predictionId: market._id })),
  });
  const polymarketMarkets = iranMarkets.filter((market) => market.source === "polymarket" && market.sourceUrl);
  const sourceQueries = useQueries({
    queries: polymarketMarkets.map((market) => {
      const slug = new URL(market.sourceUrl!).pathname.split("/").filter(Boolean).at(-1)!;
      return {
        queryKey: ["polymarket-history", slug],
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchPolymarketHistory(slug, signal),
        staleTime: 30 * 60_000,
        refetchInterval: 30 * 60_000,
        retry: 1,
      };
    }),
  });
  const displayMarkets: Market[] = iranMarkets.map((market) => {
    const stored = storedQueries[storedMarkets.findIndex((m) => m._id === market._id)];
    const source = sourceQueries[polymarketMarkets.findIndex((m) => m._id === market._id)];
    const history = mergeRecordedHistory(stored?.data ?? market.history, source?.data ?? []);
    const coverage = history.length ? `${history.length} observations, ${new Date(history[0].timestamp).toLocaleDateString()}–${new Date(history[history.length - 1].timestamp).toLocaleDateString()}.` : "No historical observations.";
    return {
      ...market,
      history,
      historyNote: `${coverage} ${source?.isError ? "Older source history unavailable; showing stored observations." : stored?.isError ? "Full stored history could not be loaded." : source?.isPending || stored?.isPending ? "Loading older observations…" : ""}`,
    };
  });

  return (
    <TopicDashboard
      topic="iran"
      title="Iran"
      subtitle="Forecasts of military action, nuclear risk and political change. Sources are shown separately because their definitions can differ."
      markets={displayMarkets}
      groupTitles={GROUP_TITLES}
      groupResolutions={GROUP_RESOLUTION}
      groupKeys={IRAN_GROUPS}
      footer={<><Caveats topic="iran" /><SuggestionsPanel topic="iran" /></>}
    />
  );
}
