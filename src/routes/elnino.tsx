import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  TopicDashboard,
  type GroupResolution,
  type Market,
} from "@/components/TopicDashboard";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { Caveats } from "@/components/Caveats";

// RONI = NOAA CPC's Relative Oceanic Niño Index: the Niño-3.4 anomaly minus
// the warming shared by the whole tropical ocean, so events from different
// decades compare like for like. CPC's table peaks at 2.4 (1982-83) and 2.3
// (1997-98, 2015-16), so "2.5 or above" is a post-1950 record by construction.
const CPC_RONI_URL = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/";
const CPC_DISCUSSION_URL =
  "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml";

const GROUP_TITLES: Record<string, string> = {
  enso_record: "Strongest El Niño since 1950 (peak RONI 2.5 or above)",
  enso_super: "Super El Niño this winter (peak RONI 2.0 or above)",
  enso_peak_band: "Peak lands just short of a record (RONI 2.0–2.5)",
  hottest_2026: "2026 is the hottest year on record (NASA)",
  hottest_2027: "2027 is the hottest year on record (NASA)",
};

const ELNINO_GROUPS = Object.keys(GROUP_TITLES);

const RONI_LADDER_RULES =
  "The peak RONI is the single highest Regional Ocean Niño Index (RONI) value reported by NOAA's Climate Prediction Center (CPC) across the overlapping three-month seasons ASO 2026, SON 2026, OND 2026, NDJ 2026-27, and DJF 2026-27, as reported in official NOAA CPC RONI updates. The first published RONI value for each listed season is final and governs resolution; no subsequent revision to a season's value will change the outcome once that season's first value has been published. If CPC's RONI dataset is permanently discontinued, other information from NOAA may be used.";

const GROUP_RESOLUTION: Record<string, GroupResolution> = {
  enso_record: {
    summary:
      "Resolves Yes if NOAA's Climate Prediction Center publishes a three-month RONI of +2.5°C or above for any season from Aug–Oct 2026 to Dec–Feb 2026-27. CPC's RONI record since 1950 peaks at 2.4 (1982-83), so this is the market for 'strongest El Niño on record' on the climate-adjusted index. The 1877-78 event predates the index.",
    notice:
      "NOAA CPC's own 10 September discussion puts a 75% chance on the Oct–Dec RONI reaching +2.5, 'a historic event that would exceed the strength of previous El Niño events dating back to 1950'.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/what-will-the-peak-roni-be-for-the-2026-27-el-nino-1786975502957",
        fullText:
          "This market resolves \"Yes\" if the peak RONI for the 2026–27 El Niño is +2.5°C or above. Otherwise, it resolves \"No\". This market resolves \"Yes\" as soon as NOAA publishes a RONI value of +2.5°C or above for any listed season. If no listed season reaches +2.5°C, this market resolves \"No\" once NOAA has published the RONI value for DJF 2026-27. " +
          RONI_LADDER_RULES,
      },
    ],
  },
  enso_super: {
    summary:
      "Resolves Yes if NOAA CPC reports a three-month RONI of +2.0°C or higher for any season from Aug–Oct 2026 to Dec–Feb 2026-27. Only three events since 1950 have crossed 2.0 on RONI: 1982-83, 1997-98 and 2015-16.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/will-there-be-a-super-el-nino-this-winter-202627-20260721221614682",
        fullText:
          "This market will resolve \"Yes\" if NOAA's Climate Prediction Center reports a Regional Ocean Niño Index (RONI) value of +2.0°C or higher for any of the following seasons: ASO 2026, SON 2026, OND 2026, NDJ 2026-27, or DJF 2026-27, as reported in official NOAA CPC RONI updates. Otherwise, this market will resolve \"No\". A Super El Niño is an El Niño event in which RONI reaches this threshold for at least one overlapping ENSO season. This market may resolve \"Yes\" immediately upon NOAA's first publication of a qualifying RONI value for any listed season. If no season has qualified, this market will not resolve \"No\" until NOAA publishes the DJF 2026-27 value. The first published RONI value for each listed season is final and governs this market's resolution.",
      },
    ],
  },
  enso_peak_band: {
    summary:
      "The rest of Polymarket's peak-RONI ladder: the two bands between 'super' (2.0) and 'record' (2.5). Together with the card above they should sum to roughly 100%; the sub-2.0 bands trade near zero.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/what-will-the-peak-roni-be-for-the-2026-27-el-nino-1786975502957",
        fullText:
          "Each band resolves \"Yes\" if the peak RONI for the 2026–27 El Niño falls in that range (at least the lower bound, below the upper bound). " +
          RONI_LADDER_RULES,
      },
    ],
  },
  hottest_2026: {
    summary:
      "Resolves Yes if NASA GISS reports 2026 as the warmest calendar year in its Land-Ocean Temperature Index. A strong El Niño warms the global average with a lag of a few months, so the bigger effect is usually on the following year.",
    footnotes: [
      {
        id: 0,
        source: "Polymarket",
        url: "https://polymarket.com/event/where-will-2026-rank-among-the-hottest-years-on-record",
        fullText:
          "This market will resolve according to the numerical rank of how hot 2026 is when compared against all other years for which the Global Land-Ocean Temperature Index has data. Years will be ranked in descending order, starting with the hottest as number 1. If 2026 ties with any other year, it will resolve according to the place the year it ties with occupies. This market will resolve immediately once the specified data becomes available, regardless of whether the figure for the relevant years is later revised. The primary resolution source will be the table titled \"Land-Ocean Temperature Index (C)\" under the column \"No_Smoothing\" in the row \"2026\" at data.giss.nasa.gov. If no information for 2026 is provided by NASA by March 1, 2027, 11:59 PM ET, this market will resolve based on a consensus of credible reporting.",
      },
      {
        id: 0,
        source: "Kalshi",
        url: "https://kalshi.com/markets/kxgtemp",
        fullText:
          "If the unsmoothed Land-Ocean Temperature Index value for 2026 reported by NASA's Goddard Institute for Space Studies (GISS) is above the 2025 value and 1.28 degrees Celsius, then the market resolves to Yes.",
      },
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/21095/?sub-question=21098",
        fullText:
          "Will the following years be the warmest year on record, according to NASA? (2026). Each sub-question resolves \"Yes\" if NASA officially reports that the year is the hottest year on record to date. It resolves \"No\" otherwise.",
      },
    ],
  },
  hottest_2027: {
    summary:
      "Resolves Yes if NASA GISS reports 2027 as the warmest calendar year on record. Global temperature lags El Niño by a few months (1998 and 2016 were the record years, not 1997 and 2015), so this is where a record-strength event shows up most clearly.",
    footnotes: [
      {
        id: 0,
        source: "Metaculus",
        url: "https://www.metaculus.com/questions/21095/?sub-question=45424",
        fullText:
          "Will the following years be the warmest year on record, according to NASA? (2027). Each sub-question resolves \"Yes\" if NASA officially reports that the year is the hottest year on record to date. It resolves \"No\" otherwise.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// California this winter: nothing on any exchange prices these directly, so
// the headline tiles are our estimates from published forecasts and research.
// Each carries a resolvable definition so a market could be written from it.
// ---------------------------------------------------------------------------

type Estimate = {
  key: string;
  label: string;
  probability: string; // headline
  range: string;
  definition: string;
  reasoning: string;
  sources: { label: string; url: string }[];
};

const CALIFORNIA_ESTIMATES: Estimate[] = [
  {
    key: "wet",
    label: "Very wet winter",
    probability: "~75%",
    range: "60–90%",
    definition:
      "California's Dec–Feb 2026-27 precipitation ranks in the wettest 20% of winters on record (statewide average).",
    reasoning:
      "The August ECMWF seasonal ensemble gave 70–100% odds, depending on location, of a top-quintile wet winter and the same for above-average precipitation (Daniel Swain's reading of the map). Very strong El Niños are the best single predictor of a wet California winter, but not a guarantee: 1982-83 and 1997-98 were among the wettest on record, 2015-16 was ordinary. We shade the ensemble down for that miss.",
    sources: [
      { label: "Swain on the ECMWF August ensemble", url: "https://x.com/Weather_West/status/2085473752268021774" },
      { label: "Weather West special update, June 2026", url: "https://weatherwest.com/archives/43880" },
    ],
  },
  {
    key: "coast",
    label: "Coastal flooding",
    probability: "~90%",
    range: "75–95%",
    definition:
      "The National Weather Service issues at least one Coastal Flood Warning (not merely an advisory) for a California coastal zone between November 2026 and March 2027.",
    reasoning:
      "El Niño raises sea level along the US West Coast by roughly 15–25 cm for the season, on top of the long-term rise. Stack that on king tides and a storm's surge and wave run-up and ocean levels can run 60–90 cm above normal during big winter storms. Warnings were issued in the 2015-16 and 2023-24 El Niño winters and in several ordinary recent winters, so this is close to the ceiling.",
    sources: [
      { label: "NOAA: El Niño and high-tide flooding, May 2026", url: "https://oceanservice.noaa.gov/news/may26/el-nino-flooding.html" },
      { label: "Weather West on sea level and surge", url: "https://weatherwest.com/archives/43880" },
    ],
  },
  {
    key: "megastorm",
    label: "Megastorm",
    probability: "~70%",
    range: "50–85%",
    definition:
      "FEMA issues a Major Disaster Declaration for California covering winter storms, flooding, mudslides or debris flows that occur between November 2026 and April 2027.",
    reasoning:
      "A winter-storm declaration is the closest resolvable proxy for 'a storm sequence bad enough to matter'. California has had one in about six of the last ten winters, and in two of the three very strong El Niño winters since 1980 (1982-83 and 1997-98 yes, 2015-16 no). Conditioning on the wet-winter odds above lands around 70%.",
    sources: [
      { label: "FEMA disaster declarations, California", url: "https://www.fema.gov/disaster/declarations?field_dv2_state_territory_tribal_value=CA" },
    ],
  },
  {
    key: "megaflood",
    label: "Megaflood",
    probability: "~3%",
    range: "1–5%",
    definition:
      "An ARkStorm-scale event: a weeks-long storm sequence producing flooding on the scale of the winter of 1861-62, the Central Valley inundated, with damage in the hundreds of billions of dollars.",
    reasoning:
      "Huang & Swain (Science Advances, 2022) put the historical rate at five to seven such events per thousand years, about 0.5–0.7% a year, and find warming to date has already roughly doubled it, so 1–1.4% a year now. In the ARkStorm 2.0 simulations, seven of the eight most extreme month-long storm sequences occurred during moderate-to-strong El Niño conditions, which cover roughly a third of years, an enrichment of two to three times. That gives 2–4% for a winter like this one; we round to 3% and widen the range for how thin the evidence is. The 2.5% figure circulating online is inside this range, not a published number.",
    sources: [
      { label: "Huang & Swain 2022, Science Advances", url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { label: "NCAR summary of the study", url: "https://news.ucar.edu/132857/california-faces-heightened-risk-megafloods" },
      { label: "USGS ARkStorm scenario", url: "https://www.usgs.gov/programs/science-application-for-risk-reduction/science/arkstorm-scenario" },
    ],
  },
];

function CaliforniaEstimates() {
  return (
    <section className="mb-8 not-prose">
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight">California this winter</h2>
        <p className="text-sm opacity-60">
          No exchange prices these directly. These are Goodheart Labs estimates from published
          forecasts and research, each with a definition a market could be written from.
          Disagree? Add a caveat below or{" "}
          <a href="/wishlist" className="underline">request a market</a>.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CALIFORNIA_ESTIMATES.map((e) => (
          <details key={e.key} className="card bg-base-100 group">
            <summary className="card-body p-4 cursor-pointer list-none">
              <div className="text-sm font-medium opacity-70">{e.label}</div>
              <div className="text-3xl font-bold leading-tight">{e.probability}</div>
              <div className="text-xs opacity-50">range {e.range} · estimate, not a market</div>
              <div className="text-xs underline decoration-dotted underline-offset-4 opacity-60 mt-1">
                Definition and reasoning
              </div>
            </summary>
            <div className="px-4 pb-4 text-sm space-y-2">
              <p><span className="font-medium">Resolves Yes if:</span> {e.definition}</p>
              <p className="opacity-80">{e.reasoning}</p>
              <ul className="text-xs space-y-1">
                {e.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                      {s.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function EnsoContext() {
  return (
    <p className="text-sm opacity-70 mb-6 not-prose">
      NOAA's 10 September discussion: Niño-3.4 at +1.8°C and rising, a greater than 90% chance of a
      very strong El Niño this winter, and a 75% chance the Oct–Dec index tops +2.5, beating every event
      since 1950. The markets below price the strength of the event and its knock-on for global
      temperature; the tiles above are what that means for California.{" "}
      <a href={CPC_DISCUSSION_URL} target="_blank" rel="noopener noreferrer" className="underline">CPC discussion</a>
      {" · "}
      <a href={CPC_RONI_URL} target="_blank" rel="noopener noreferrer" className="underline">RONI table</a>
    </p>
  );
}

const simpleMarketsQuery = convexQuery(api.simple.getMarkets, {});

export const Route = createFileRoute("/elnino")({
  staticData: { title: "El Niño" },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(simpleMarketsQuery);
  },
  component: ElNinoPage,
});

function ElNinoPage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);

  return (
    <TopicDashboard
      topic="elnino"
      title="El Niño 2026-27 Risk Dashboard"
      subtitle="Record-strength El Niño · what it means for California · Forecasting from Polymarket, Kalshi, and Metaculus"
      markets={markets as Market[]}
      groupTitles={GROUP_TITLES}
      groupResolutions={GROUP_RESOLUTION}
      groupKeys={ELNINO_GROUPS}
      groupDaysToShow={{ hottest_2026: 180 }}
      intro={<><CaliforniaEstimates /><EnsoContext /></>}
      footer={<><Caveats topic="elnino" /><SuggestionsPanel topic="elnino" /></>}
    />
  );
}
