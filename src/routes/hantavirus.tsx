import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import {
  TopicDashboard,
  type GroupResolution,
  type Market,
} from "@/components/TopicDashboard";

const GROUP_TITLES: Record<string, string> = {
  hanta_pheic: "WHO declares hantavirus a PHEIC before 2027",
  hanta_pandemic: "Hantavirus pandemic in 2026",
  hanta_secondary: "5+ non-passengers linked to MV Hondius outbreak before August",
  hanta_us_case: "Confirmed US hantavirus case by May 15",
  hanta_lab_leak: "Hantavirus lab leak confirmed by June 30",
  hanta_vaccine: "Hantavirus vaccine approved by FDA in 2026",
};

const HANTAVIRUS_GROUPS = Object.keys(GROUP_TITLES);

const GROUP_RESOLUTION: Record<string, GroupResolution> = {
  hanta_pheic: {
    summary:
      "Resolves Yes if the WHO declares hantavirus (or a hantavirus-related outbreak) a Public Health Emergency of International Concern before January 1, 2027. Kalshi and Metaculus use the same WHO designation as the resolution criterion.",
    footnotes: [
      {
        id: 0,
        source: "Kalshi",
        url: "https://kalshi.com/markets/kxnewoutbreakhanta",
        fullText:
          "If Hantavirus becomes a Public Health Emergency of International Concern in 2026, then the market resolves to Yes. The resolution source is the World Health Organization's official emergency declarations.",
      },
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/43468/",
        fullText:
          "Will WHO declare hantavirus a Public Health Emergency of International Concern before 2027? Resolves Yes if the WHO Director-General officially declares a PHEIC for any hantavirus-related outbreak before January 1, 2027, per WHO's emergency announcements.",
      },
    ],
  },
  hanta_pandemic: {
    summary:
      "Resolves Yes if the WHO explicitly characterizes hantavirus, Hantavirus Pulmonary Syndrome (HPS), Hemorrhagic Fever with Renal Syndrome (HFRS), or a hantavirus-related outbreak as a 'pandemic' in an official public communication by Dec 31, 2026. A PHEIC designation alone is not sufficient.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/hantavirus-pandemic-in-2026",
        fullText:
          "This market will resolve 'Yes' if the World Health Organization (WHO) explicitly characterizes Hantavirus, Hantavirus Pulmonary Syndrome (HPS), Hemorrhagic Fever with Renal Syndrome (HFRS), or a Hantavirus-related outbreak as a 'pandemic' in an official public communication between market creation and December 31, 2026, 11:59 PM ET. Otherwise, this market will resolve 'No'. A Public Health Emergency of International Concern (PHEIC) designation alone is not sufficient — the WHO must use the word 'pandemic'.",
      },
    ],
  },
  hanta_secondary: {
    summary:
      "Resolves Yes if at least 5 hantavirus cases linked to the MV Hondius outbreak are confirmed in people who were not passengers or crew on the ship, before August 1, 2026. The key question for whether the outbreak escapes the ship.",
    footnotes: [
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/43461/",
        fullText:
          "Will at least 5 non-passengers be linked to the MV Hondius hantavirus outbreak before August 2026? Resolves Yes if credible reporting (WHO, Africa CDC, national health ministries) confirms at least 5 hantavirus cases in individuals who were not passengers or crew on the MV Hondius cruise ship, but whose infections are epidemiologically linked to the Hondius outbreak (e.g., secondary contacts of confirmed cases), before August 1, 2026.",
      },
    ],
  },
  hanta_us_case: {
    summary:
      "Resolves Yes if at least one new confirmed case of hantavirus in the United States is reported by credible sources between market creation and May 15, 2026.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/confirmed-case-of-hantavirus-in-us-by-may-15",
        fullText:
          "This market will resolve to 'Yes' if a confirmed case of hantavirus in the United States is reported by credible sources between market creation and May 15, 2026, 11:59 PM ET. Otherwise, this market will resolve to 'No'. The resolution source for this market will be a consensus of credible reporting (e.g. CDC announcements, state health department reports, or major news outlets).",
      },
    ],
  },
  hanta_lab_leak: {
    summary:
      "Resolves Yes if credible reporting consensus confirms an Andes virus case originated from a medical or research laboratory by June 30, 2026. Speculation or unverified claims do not qualify.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/hantavirus-lab-leak-confirmed-by-june-30-1",
        fullText:
          "This market will resolve to 'Yes' if credible sources confirm by June 30, 2026, 11:59 PM ET, that an Andes virus (or other hantavirus) case originated from a medical or research laboratory. Speculation, unverified claims, or partial evidence are not sufficient — confirmation requires consensus of credible reporting (e.g., WHO, CDC, peer-reviewed publication, or government investigation conclusions).",
      },
    ],
  },
  hanta_vaccine: {
    summary:
      "Resolves Yes if any vaccine intended for humans and inoculating against hantavirus receives full approval from the U.S. Food and Drug Administration by Dec 31, 2026. Emergency Use Authorizations do not qualify.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/hantavirus-vaccine-in-2026",
        fullText:
          "This market will resolve to 'Yes' if any vaccine intended for humans and inoculating against Hantavirus receives full approval from the U.S. Food and Drug Administration (FDA) between market creation and December 31, 2026, 11:59 PM ET. Otherwise, this market will resolve to 'No'. Emergency Use Authorizations (EUAs) and approvals from non-U.S. regulators do not qualify.",
      },
    ],
  },
};

const simpleMarketsQuery = convexQuery(api.simple.getMarkets, {});

export const Route = createFileRoute("/hantavirus")({
  staticData: { title: "Hantavirus" },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(simpleMarketsQuery);
  },
  component: HantavirusPage,
});

function HantavirusPage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);

  return (
    <TopicDashboard
      topic="hantavirus"
      title="Hantavirus Outbreak Risk Dashboard"
      subtitle="MV Hondius cluster · Andes virus · Forecasting from Polymarket, Kalshi, and Metaculus"
      markets={markets as Market[]}
      groupTitles={GROUP_TITLES}
      groupResolutions={GROUP_RESOLUTION}
      groupKeys={HANTAVIRUS_GROUPS}
    />
  );
}
