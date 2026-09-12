import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
// California this winter. Nothing on any exchange prices these, so the tiles
// are our own numbers: a definition in physical units, the base rate over the
// whole record, the rate in the nine strong El Niño winters since 1950, the
// official forecasts where they exist, and the arithmetic. All computed by
// scripts/elnino_estimates.py; the working is docs/elnino-estimates.md.
// ---------------------------------------------------------------------------

const REPO = "https://github.com/Goodheart-Labs/israel-iran-dashboard/blob/main";
const WORKING_URL = `${REPO}/docs/elnino-estimates.md`;
const SCRIPT_URL = `${REPO}/scripts/elnino_estimates.py`;

type Row = { label: string; value: string; detail?: string; face?: string }; // face: short label on the tile

type Estimate = {
  key: string;
  label: string;
  headline: string;
  range: string;
  definition: string;
  rows: Row[]; // base rate, analogs, forecasts, in that order
  method: string; // how the rows become the headline
  sources: { label: string; url: string }[];
};

const ANALOGS = "the 9 strong El Niño winters since 1950 (peak RONI ≥ 1.5)";

const CALIFORNIA_ESTIMATES: Estimate[] = [
  {
    key: "wet",
    label: "Very wet winter",
    headline: "~55%",
    range: "35–75%",
    definition:
      "California's statewide Dec–Feb 2026-27 precipitation is at least 15.1 inches: the wettest 20% of the 131 winters on record (median 10.8 in).",
    rows: [
      { label: "Base rate, all 131 winters", value: "20%", detail: "by construction" },
      { label: `Rate in ${ANALOGS}`, value: "33%", detail: "3 of 9: 1957-58, 1982-83, 1997-98. Above the median: 6 of 9." },
      { label: "ECMWF August ensemble", value: "70–100%", detail: "odds of a top-20% winter, by location (Swain, 10 Aug)" },
      { label: "NOAA CPC outlook, 20 Aug", value: ">50%", detail: "odds of above-normal (top-third) precipitation for coastal California" },
    ],
    method:
      "Roughly the midpoint of the analog rate (33%) and the ECMWF ensemble (~80%). We lean toward the model because this event is forecast to peak near RONI 3.0, beyond every analog (max 2.4), and away from it because 2015-16 was a record-class event that delivered an ordinary 12.3-inch winter.",
    sources: [
      { label: "NOAA Climate at a Glance, California Dec–Feb precipitation", url: "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series/4/pcp/3/2/1895-2026" },
      { label: "Swain on the ECMWF August ensemble", url: "https://x.com/Weather_West/status/2085473752268021774" },
      { label: "NOAA CPC seasonal outlook discussion", url: "https://www.cpc.ncep.noaa.gov/products/predictions/long_range/fxus05.html" },
    ],
  },
  {
    key: "coast",
    label: "Coastal flooding",
    headline: "~60%",
    range: "40–80%",
    definition:
      "The Los Angeles tide gauge (NOAA 9410660) records at least 3 days between Nov 2026 and Apr 2027 at or above NOAA's minor coastal flood level: 11.18 ft on the station datum, 1.9 ft above mean higher high water.",
    rows: [
      { label: "Base rate, 72 winters since 1950", value: "10%", detail: "7 of 72. Last 11 winters: 3 of 11 (2025-26 had 6 days with no El Niño)." },
      { label: `Rate in ${ANALOGS}`, value: "38%", detail: "3 of 8 with data: 1982-83 (6 days), 2015-16 (5), 1997-98 (3). At least 1 day: 7 of 8." },
      { label: "El Niño sea-level lift", value: "6–10 in", detail: "NOAA: seasonal rise on the US West Coast, a third to a half of the 22-inch margin between mean higher high water and the flood level" },
    ],
    method:
      "The analog rate, raised because the two most recent analogs both cleared 3 days easily, last winter cleared it with no El Niño at all, and this event is forecast to lift the ocean more than any of them.",
    sources: [
      { label: "NOAA high tide flooding, Los Angeles gauge", url: "https://tidesandcurrents.noaa.gov/high-tide-flooding/" },
      { label: "NOAA flood levels for station 9410660", url: "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9410660/floodlevels.json" },
      { label: "NOAA Ocean Service: El Niño and high tide flooding, May 2026", url: "https://oceanservice.noaa.gov/news/may26/el-nino-flooding.html" },
    ],
  },
  {
    key: "megastorm",
    label: "Megastorm month",
    headline: "~20%",
    range: "12–35%",
    definition:
      "Some calendar month from Nov 2026 to Mar 2027 delivers at least 9 inches of precipitation averaged over the whole state. Twelve winters in 131 have done it: Dec 1955, Jan 1969, Mar 1983, Feb 1986, Jan 1995 (the record, 12.5 in), Feb 1998, Jan 2017 and five before 1920.",
    rows: [
      { label: "Base rate, all 131 winters", value: "9%", detail: "12 of 131" },
      { label: `Rate in ${ANALOGS}`, value: "22%", detail: "2 of 9: Mar 1983 (9.0 in), Feb 1998 (11.5 in)" },
      { label: "If the winter is top-20% wet", value: "37%", detail: "10 of 27; otherwise 2 of 104 = 2%" },
    ],
    method:
      "0.55 × 37% + 0.45 × 2% = 21%, taking the 55% from the very-wet-winter tile.",
    sources: [
      { label: "NOAA Climate at a Glance, California monthly precipitation", url: "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series/4/pcp/1/0/1895-2026" },
    ],
  },
  {
    key: "megaflood",
    label: "Megaflood",
    headline: "~3%",
    range: "1–6%",
    definition:
      "An ARkStorm-scale event: a weeks-long storm sequence whose 30-day statewide precipitation exceeds anything in the 131-year record (biggest month: 12.5 in, Jan 1995) and approaches the winter of 1861-62. ARkStorm 2.0's historical scenario, which brings slightly less rain than 1862 did.",
    rows: [
      { label: "Base rate", value: "~1% / yr", detail: "Huang & Swain 2022: a 1-in-90-to-100-year event in the 1995–2005 climate, already double the pre-industrial rate. Cross-check: a stationary 131-year record is beaten with probability 1/132 = 0.8%." },
      { label: "El Niño multiplier", value: "×2–3", face: "El Niño", detail: "7 of the 8 largest simulated 30-day sequences fell in moderate-to-strong El Niño years, which are a quarter to a third of years. Our record: 2 of 9 strong El Niño winters had a 9-inch month vs 12 of 131 overall (2.4×)." },
    ],
    method:
      "1% × 2.5 = 2.5%, rounded up to 3% because this event is forecast beyond every analog. The 2.5% figure circulating online sits inside the range but is not a published number.",
    sources: [
      { label: "Huang & Swain 2022, Science Advances", url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { label: "Weather West summary of ARkStorm 2.0", url: "https://weatherwest.com/archives/16626" },
      { label: "USGS ARkStorm scenario", url: "https://www.usgs.gov/programs/science-application-for-risk-reduction/science/arkstorm-scenario" },
    ],
  },
];

function EstimateTile({ e }: { e: Estimate }) {
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
  const [base, analogs] = e.rows;
  return (
    <div ref={ref} className="relative"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onKeyDown={(event) => { if (event.key === "Escape") { setPinned(false); setHovered(false); } }}>
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => { setPinned(!pinned); setHovered(false); }}
        className="card bg-base-100 w-full text-left cursor-pointer hover:shadow-md transition-shadow">
        <div className="card-body p-4">
          <div className="text-sm font-medium opacity-70">{e.label}</div>
          <div className="text-3xl font-bold leading-tight">{e.headline}</div>
          <div className="text-xs opacity-50">range {e.range}</div>
          <div className="text-xs mt-2 leading-snug">
            <span className="opacity-60">{base.face ?? "base rate"}</span> <span className="font-medium">{base.value}</span>
            <span className="opacity-40"> · </span>
            <span className="opacity-60">{analogs.face ?? "El Niño winters"}</span> <span className="font-medium">{analogs.value}</span>
          </div>
        </div>
      </button>
      <div id={id} hidden={!open}
        className="absolute left-0 z-30 mt-1 w-[min(28rem,90vw)] rounded-md border border-base-300 bg-base-100 p-4 shadow-lg text-sm space-y-2">
        <p><span className="font-medium">Resolves Yes if:</span> {e.definition}</p>
        <table className="w-full text-xs">
          <tbody>
            {e.rows.map((r) => (
              <tr key={r.label} className="align-top">
                <td className="pr-2 py-0.5 opacity-70">{r.label}</td>
                <td className="py-0.5 font-medium whitespace-nowrap">{r.value}</td>
              </tr>
            ))}
            <tr className="align-top border-t border-base-300">
              <td className="pr-2 py-0.5 opacity-70">Our number</td>
              <td className="py-0.5 font-bold whitespace-nowrap">{e.headline}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs opacity-80">{e.method}</p>
        <a href={`#working-${e.key}`} className="text-xs underline">Full working and sources below</a>
      </div>
    </div>
  );
}

function CaliforniaEstimates() {
  return (
    <section className="mb-8 not-prose">
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight">California this winter</h2>
        <p className="text-sm opacity-60">
          No exchange prices these, so they are our numbers. Hover a tile for the definition and
          the base rates; the full working is below and in{" "}
          <a href={WORKING_URL} target="_blank" rel="noopener noreferrer" className="underline">docs/elnino-estimates.md</a>.
          Disagree? Add a caveat below or{" "}
          <a href="/wishlist" className="underline">request a market</a>.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CALIFORNIA_ESTIMATES.map((e) => <EstimateTile key={e.key} e={e} />)}
      </div>
    </section>
  );
}

function Working() {
  return (
    <section className="mt-10 not-prose">
      <h2 className="text-xl font-semibold tracking-tight mb-1">How the California numbers are made</h2>
      <p className="text-sm opacity-60 mb-4">
        Same recipe for each tile: a definition in physical units, the base rate over the whole
        record, the rate in the nine strong El Niño winters since 1950 (peak RONI ≥ 1.5: 1957-58,
        1965-66, 1972-73, 1982-83, 1986-87, 1991-92, 1997-98, 2009-10, 2015-16), the official
        forecasts where they exist, then the arithmetic. This event is forecast to peak near RONI
        3.0, beyond every analog, so the analog rates are a floor for the El Niño effect. The data
        section is generated by{" "}
        <a href={SCRIPT_URL} target="_blank" rel="noopener noreferrer" className="underline">scripts/elnino_estimates.py</a>
        {" "}(NOAA Climate at a Glance, NOAA tide gauges, NOAA CPC RONI), computed 11 Sep 2026.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CALIFORNIA_ESTIMATES.map((e) => (
          <div key={e.key} id={`working-${e.key}`} className="card bg-base-100 scroll-mt-4">
            <div className="card-body p-5 text-sm">
              <h3 className="card-title text-base">{e.label}: {e.headline} <span className="text-xs font-normal opacity-50">range {e.range}</span></h3>
              <p><span className="font-medium">Resolves Yes if:</span> {e.definition}</p>
              <table className="w-full text-xs mt-1">
                <tbody>
                  {e.rows.map((r) => (
                    <tr key={r.label} className="align-top border-t border-base-200">
                      <td className="pr-2 py-1 opacity-70 w-2/5">{r.label}</td>
                      <td className="pr-2 py-1 font-medium whitespace-nowrap">{r.value}</td>
                      <td className="py-1 opacity-70">{r.detail}</td>
                    </tr>
                  ))}
                  <tr className="align-top border-t border-base-300">
                    <td className="pr-2 py-1 opacity-70">Our number</td>
                    <td className="pr-2 py-1 font-bold whitespace-nowrap">{e.headline}</td>
                    <td className="py-1 opacity-80">{e.method}</td>
                  </tr>
                </tbody>
              </table>
              <ul className="text-xs mt-2 space-y-1">
                {e.sources.map((src) => (
                  <li key={src.url}>
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                      {src.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
  staticData: { title: "California El Niño" },
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
      title="California El Niño '26-'27"
      subtitle="What a record El Niño means for California · base rates, analog winters, and the markets that price the event"
      markets={markets as Market[]}
      groupTitles={GROUP_TITLES}
      groupResolutions={GROUP_RESOLUTION}
      groupKeys={ELNINO_GROUPS}
      groupDaysToShow={{ hottest_2026: 180 }}
      intro={<><CaliforniaEstimates /><EnsoContext /></>}
      footer={<><Working /><div className="mt-6"><Caveats topic="elnino" /></div><SuggestionsPanel topic="elnino" /></>}
    />
  );
}
