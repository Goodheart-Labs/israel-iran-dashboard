import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  TopicDashboard,
  type GroupResolution,
  type Market,
} from "@/components/TopicDashboard";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { Caveats } from "@/components/Caveats";
import { ItemVote } from "@/components/ItemVote";
import { useQuery } from "convex/react";
import { chartScore, itemId } from "@/lib/helpfulness";

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

const REPO = "https://github.com/Goodheart-Labs/globalriskodds/blob/main";
const WORKING_URL = `${REPO}/docs/elnino-estimates.md`;
const SCRIPT_URL = `${REPO}/scripts/elnino_estimates.py`;

type DataLink = { label: string; url: string };
type Row = { label: string; value: string; detail?: string; face?: string; data: DataLink[] }; // face: short label on the tile; data: where the figure comes from

type Quote = { text: string; who: string; url?: string }; // no url: a message relayed by one of the page's authors, not published anywhere

type Estimate = {
  key: string;
  label: string;
  headline: string;
  range: string;
  definition: string;
  rows: Row[]; // base rate, analogs, forecasts, in that order
  method: string; // how the rows become the headline
  quotes: Quote[]; // verbatim, pinned to a source; YouTube quotes are lightly corrected auto-captions
};

const ANALOGS = "the 9 strong El Niño winters since 1950 (peak RONI ≥ 1.5)";
const SW_SEP = "https://www.youtube.com/watch?v=2v4k0nbUU1s";
const SW_AUG = "https://www.youtube.com/watch?v=0THLEMorMDI";
const SWAIN_SEP = "Daniel Swain, Weather West September update, 10 Sep 2026";
const SWAIN_AUG = "Daniel Swain, Weather West August update, 10 Aug 2026";
const HS = "Huang & Swain 2022, Science Advances";

// The exact series scripts/elnino_estimates.py reads, plus the pages they come from.
const CAG = "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series/4/pcp";
const D_PRECIP_DJF: DataLink = { label: "NOAA Climate at a Glance: California Dec–Feb precipitation, 1895–2026", url: `${CAG}/3/2/1895-2026` };
const D_PRECIP_DJF_CSV: DataLink = { label: "same series, CSV", url: `${CAG}/3/2/1895-2026/data.csv` };
const D_PRECIP_MONTHLY_CSV: DataLink = { label: "NOAA Climate at a Glance: California monthly precipitation, CSV", url: `${CAG}/1/0/1895-2026/data.csv` };
const D_RONI: DataLink = { label: "NOAA CPC RONI table (which winters count as strong El Niño)", url: CPC_RONI_URL };
const D_HTF: DataLink = { label: "NOAA monthly high-tide flood counts, Los Angeles gauge 9410660 (JSON)", url: "https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_monthly.json?station=9410660" };
const D_FLOOD_LEVELS: DataLink = { label: "NOAA flood thresholds for gauge 9410660 (JSON)", url: "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9410660/floodlevels.json" };
const D_HS: DataLink = { label: "Huang & Swain 2022, Science Advances, Fig. 5B", url: "https://www.science.org/doi/10.1126/sciadv.abq0995" };

const CALIFORNIA_ESTIMATES: Estimate[] = [
  {
    key: "wet",
    label: "Very wet winter",
    headline: "~65%",
    range: "45–85%",
    definition:
      "California's statewide Dec–Feb 2026-27 precipitation is at least 15.1 inches: the wettest 20% of the 131 winters on record (median 10.8 in).",
    rows: [
      { label: "Base rate, all 131 winters", value: "20%", detail: "by construction", data: [D_PRECIP_DJF, D_PRECIP_DJF_CSV] },
      { label: `Rate in ${ANALOGS}`, value: "33%", detail: "3 of 9: 1957-58, 1982-83, 1997-98. Above the median: 6 of 9.", data: [D_PRECIP_DJF_CSV, D_RONI] },
      { label: "ECMWF September ensemble", value: ">70%", detail: "odds of a top-20% winter along the coast; ~2 in 3 for a top-10% winter; ~20% for a record-wet winter in a significant chunk of the state (Swain, 10 Sep)", data: [{ label: "Swain reading the ensemble on screen, 41:46 (secondhand: the page has not pulled ECMWF's own numbers)", url: SW_SEP + "&t=2506s" }, { label: "ECMWF seasonal forecast charts (Copernicus C3S)", url: "https://climate.copernicus.eu/charts/packages/c3s_seasonal/" }] },
      { label: "NOAA CPC outlook, 20 Aug", value: ">50%", detail: "odds of above-normal (top-third) precipitation for coastal California", data: [{ label: "NOAA CPC seasonal outlook discussion", url: "https://www.cpc.ncep.noaa.gov/products/predictions/long_range/fxus05.html" }] },
    ],
    method:
      "Between the analog rate (33%) and the ECMWF ensemble (>70%), leaning to the model. It correctly hindcast 2015-16 as a dry strong-El Niño winter and 1982-83 and 1997-98 as wet ones, and this event is forecast to peak near RONI 3.0, beyond every analog (max 2.4). Claude F5.1 stops short of the model because it is one system and, as Swain notes, an under-dispersed ensemble can be too wet or too dry.",
    quotes: [
      { text: "a greater than 70% chance of precipitation this December through February being among the wettest 20%.", who: SWAIN_SEP + ", 41:46", url: SW_SEP + "&t=2506s" },
      { text: "It is more likely than not, probably about two in three odds of a winter among the wettest 10% we've seen. That's a more defensible headline.", who: SWAIN_SEP + ", 1:01:07", url: SW_SEP + "&t=3667s" },
      { text: "this model correctly identified that 2015-2016, despite being a very strong El Niño year, would not be a very wet year in California, and also correctly identified in reforecasts that 1982-1983 and 97-98 would be very wet winters in California.", who: SWAIN_SEP + ", 43:18", url: SW_SEP + "&t=2598s" },
      { text: "realistically there is something like a 20% chance that a significant chunk of California sees record wet conditions this winter.", who: SWAIN_SEP + ", 1:01:42", url: SW_SEP + "&t=3702s" },
      { text: "Contrary to some newspaper headlines, that does not mean that California is, quote, heading for the wettest winter ever. That's something that we just can't know at this juncture.", who: "Daniel Swain, Weather West clip, Aug 2026", url: "https://www.youtube.com/watch?v=_hsTA3yfhEU" },
      { text: "increased significantly to above 50 percent across much of coastal California and adjacent areas of southern Arizona from DJF through FMA, peaking in coverage during JFM.", who: "NOAA CPC seasonal outlook discussion, 20 Aug 2026 (odds of above-normal precipitation)", url: "https://www.cpc.ncep.noaa.gov/products/predictions/long_range/fxus05.html" },
    ],
  },
  {
    key: "coast",
    label: "Coastal flooding",
    headline: "~75%",
    range: "55–90%",
    definition:
      "The Los Angeles tide gauge (NOAA 9410660) records at least 3 days between Nov 2026 and Apr 2027 at or above NOAA's minor coastal flood level: 11.18 ft on the station datum, 1.9 ft above mean higher high water.",
    rows: [
      { label: "Base rate, 72 winters since 1950", value: "10%", detail: "7 of 72. Last 11 winters: 3 of 11 (2025-26 had 6 days with no El Niño).", data: [D_HTF, D_FLOOD_LEVELS, { label: "NOAA high tide flooding overview", url: "https://tidesandcurrents.noaa.gov/high-tide-flooding/" }] },
      { label: `Rate in ${ANALOGS}`, value: "38%", detail: "3 of 8 with data: 1982-83 (6 days), 2015-16 (5), 1997-98 (3). At least 1 day: 7 of 8.", data: [D_HTF, D_RONI] },
      { label: "El Niño sea-level lift", value: "6–12 in", detail: "already observed off California in September (Swain), a third to a half of the 22-inch margin between mean higher high water and the flood level; NOAA: 6–10 in seasonal rise", data: [{ label: "Swain on observed sea level, 24:57 (secondhand: no tide-gauge series pulled)", url: SW_SEP + "&t=1497s" }, { label: "NOAA Ocean Service: El Niño and high tide flooding, May 2026", url: "https://oceanservice.noaa.gov/news/may26/el-nino-flooding.html" }, D_FLOOD_LEVELS] },
    ],
    method:
      "The analog rate, raised a long way: the two most recent analogs both cleared 3 days easily, last winter cleared it with no El Niño at all, the lift is already 6–12 inches in September, and Swain expects record sea levels in San Diego and much of the state this winter.",
    quotes: [
      { text: "There will be significant coastal flooding that will get worse from here. That is almost 100% guaranteed. How bad it gets will depend.", who: SWAIN_SEP + ", 1:06:15", url: SW_SEP + "&t=3975s" },
      { text: "I expect us to break the records in San Diego. So I think we'll probably see record sea levels in many parts of California except possibly San Francisco proper", who: SWAIN_SEP + ", 32:53", url: SW_SEP + "&t=1973s" },
      { text: "we're already seeing significant elevation of sea level along the California coast exceeding that 15 cm level. So, we're between 15 and 30.", who: SWAIN_SEP + ", 24:57", url: SW_SEP + "&t=1497s" },
      { text: "all of our progressive sea level records have been broken during strong El Niño events. 82-83 was the highest sea level we'd ever seen in the Bay Area by a wide margin at that point in time.", who: SWAIN_AUG + ", 23:02", url: SW_AUG + "&t=1382s" },
      { text: "there's no guarantee, although the coastal flooding is about as close to a guarantee as we can get. The inland flooding is a bigger wild card", who: SWAIN_AUG + ", 1:04:52", url: SW_AUG + "&t=3892s" },
    ],
  },
  {
    key: "megaflood",
    label: "Megaflood (ARkStorm)",
    headline: "~3%",
    range: "2–8%",
    definition:
      "A month-long megastorm on the ARkStorm scale: roughly 447 mm (17.6 in) or more of precipitation averaged over the whole state in 30 days, the ARkHist scenario of ARkStorm 2.0, which brings slightly less rain than the winter of 1861-62 did. The biggest calendar month in the 131-year record is 12.5 in (Jan 1995).",
    rows: [
      { label: "Base rate at today's warming", value: "2.5–3% / yr", detail: "Huang & Swain 2022, Fig. 5B: about 1%/yr in the pre-industrial climate, rising ~1.2 points per °C of global warming. At 1.3–1.65°C (30-year-smoothed vs single-year 2026 estimates) that is 2.5–3%. Cross-check: a stationary 131-year record is beaten with probability 1/132 = 0.8%; warming to date has roughly doubled the 1920 rate.", data: [D_HS, { label: "Weather West summary of the paper", url: "https://weatherwest.com/archives/16626" }, D_PRECIP_MONTHLY_CSV] },
      { label: "El Niño multiplier", value: "×1–3", detail: "Every one of the most intense simulated 30-day sequences in the paper's ensemble fell in a moderate-to-strong El Niño year, which are a quarter to a third of years. The instrumental record: 2 of 9 strong El Niño winters had a 9-inch month vs 12 of 131 overall (2.4×). Applying no multiplier is the cautious reading.", face: "El Niño", data: [D_HS, D_PRECIP_MONTHLY_CSV, D_RONI] },
    ],
    method:
      "The headline is the unconditioned Fig. 5B rate, ~3%, which is where the ~2.5% figure circulating online comes from. Conditioning on this being a strong El Niño winter, as the paper's own results suggest, would give 5–8%; the range covers both readings.",
    quotes: [
      { text: "Recent estimates suggest that floods equal to or greater in magnitude to those in 1862 occur five to seven times per millennium [i.e., a 1.0 to 0.5% annual likelihood or 100- to 200-year recurrence interval (RI)]", who: HS, url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { text: "We find that the annual likelihood of an ARkHist level event increases rapidly for each 1°C of global warming [by ~0.012/year per degree C from a baseline of ~0.01/year]", who: HS + ", Fig. 5B", url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { text: "We find that climate change to date (as of 2022) has already increased the annual likelihood of an ARkHist event by ~105% relative to 1920 in the CESM1-LENS ensemble", who: HS, url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { text: "We further find that all of the most intense 30-day megastorm events in the CESM1-LENS ensemble occur during moderate to strong ENSO warm phase (El Niño) conditions—both in the historical and warmer future scenarios—suggesting that these events may potentially exhibit some degree of predictability at seasonal scale.", who: HS, url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { text: "Collectively, seven of eight historical and future potential California megastorm events occur under moderate or strong El Niño conditions as defined by the ELI (eight of eight, if rounding to the nearest degree of longitude).", who: HS, url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { text: "California-wide average cumulative precipitation during the 30-day periods encompassing both extreme storm sequence scenarios represents a considerable fraction of the total annual [October-September water year (WY)] precipitation occurring during both ARkHist (~447 mm or 46% of the WY total) and ARkFuture (~586 mm, of 40% of the WY total).", who: HS, url: "https://www.science.org/doi/10.1126/sciadv.abq0995" },
      { text: "California is likely to see anywhere from extra precipitation & storm surge to a megastorm and a megaflood this winter (~2.5% chance).", who: "@Just_Curius on X, 11 Sep 2026", url: "https://x.com/Just_Curius/status/2098592816028954706" },
      { text: "So I revise my risk estimate for a CA megastorm to 10-13% for this winter. If we take seriously that ballpark 7/8 CA megastorms can be expected to happen during moderate+ El Nino winters, then 2.5-3% risk from the predicted GMST anomaly alone becomes 10-12.5% because it'll be a moderate+ El Nino.", who: "Belikewater (co-author), message to Nathan Young, 18 Sep 2026" },
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
        <p className="grow-0"><span className="font-medium">Resolves yes if:</span> {e.definition}</p>
        <table className="w-full text-xs">
          <tbody>
            {e.rows.map((r) => (
              <tr key={r.label} className="align-top">
                <td className="pr-2 py-0.5 opacity-70">{r.label}</td>
                <td className="py-0.5 font-medium whitespace-nowrap">{r.value}</td>
              </tr>
            ))}
            <tr className="align-top border-t border-base-300">
              <td className="pr-2 py-0.5 opacity-70">Claude F5.1's number</td>
              <td className="py-0.5 font-bold whitespace-nowrap">{e.headline}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs opacity-80">{e.method}</p>
        <blockquote className="text-xs border-l-2 border-base-300 pl-2 opacity-80">
          “{e.quotes[0].text}” <span className="opacity-60">— {e.quotes[0].who}</span>
        </blockquote>
        <Link to="/el-nino" search={{ mode: "review" }} hash={`working-${e.key}`} className="text-xs underline">
          Check the working, quotes and sources
        </Link>
      </div>
    </div>
  );
}

function Byline() {
  return (
    <p className="text-sm -mt-6 mb-6 not-prose">
      <span className="opacity-70">By </span>
      <a href="https://x.com/NathanpmYoung" target="_blank" rel="noopener noreferrer" className="underline">Nathan Young</a>
      <span className="opacity-70"> and </span>
      <a href="https://x.com/Just_Curius" target="_blank" rel="noopener noreferrer" className="underline">Belikewater</a>
    </p>
  );
}

// The big summary under the title. Text lives in Convex (`headlines`), written only
// from statements readers have marked useful; nothing renders until one exists.
function Headline() {
  const headline = useQuery(api.headlines.latest, { topic: "elnino" });
  if (!headline) return null;
  const date = new Date(headline.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className="mb-8 not-prose max-w-4xl">
      <p className="text-2xl md:text-3xl leading-snug tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {headline.text}
      </p>
      <p className="text-xs opacity-60 mt-2">
        Summary by {headline.author}, {date}, using only the {headline.citedSlots.length} statements it cites that
        readers have marked useful.{" "}
        <Link to="/el-nino" search={{ mode: "review" }} className="underline">Review them</Link>
      </p>
    </section>
  );
}

function CaliforniaEstimates() {
  return (
    <section className="mb-8 not-prose">
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight">California this winter</h2>
        <p className="text-sm opacity-60">
          No exchange prices these, so the numbers are Claude F5.1's estimates. Hover a tile for the definition and
          the base rates.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CALIFORNIA_ESTIMATES.map((e) => <EstimateTile key={e.key} e={e} />)}
      </div>
    </section>
  );
}

// Vote slots. These ids predate the review view; changing them orphans readers' votes.
const rowSlot = (e: Estimate, r: Row) => `elnino:row:${e.key}:${itemId(r.label)}`;
const oursSlot = (e: Estimate) => `elnino:ours:${e.key}`;
const quoteSlot = (e: Estimate, q: Quote) => `elnino:quote:${e.key}:${itemId(q.url ?? "", q.text.slice(0, 60))}`;
const ALL_SLOTS = CALIFORNIA_ESTIMATES.flatMap((e) => [
  ...e.rows.map((r) => rowSlot(e, r)),
  oursSlot(e),
  ...e.quotes.map((q) => quoteSlot(e, q)),
]);

type Vote = { slot: string; rating: string; voterKey: string };

// Checked = at least one "useful" vote and a positive net score.
function checkedCount(votes: Vote[]) {
  return ALL_SLOTS.filter((slot) => {
    const forSlot = votes.filter((v) => v.slot === slot);
    return forSlot.some((v) => v.rating === "useful") && chartScore(forSlot) > 0;
  }).length;
}

function ModeToggle({ review }: { review: boolean }) {
  const tab = (active: boolean) => `btn btn-sm join-item ${active ? "btn-neutral" : "btn-outline"}`;
  return (
    <div className="join not-prose" role="group" aria-label="Page mode">
      <Link to="/el-nino" search={{}} className={tab(!review)} aria-current={review ? undefined : "page"}>Read</Link>
      <Link to="/el-nino" search={{ mode: "review" }} className={tab(review)} aria-current={review ? "page" : undefined}>Review</Link>
    </div>
  );
}

function Statement({ slot, votes, cited, children }: { slot: string; votes: Vote[]; cited: string[]; children: ReactNode }) {
  return (
    <li className="flex flex-col items-start gap-1.5 border-t border-base-200 py-2.5 first:border-t-0">
      {cited.includes(slot) && <span className="badge badge-neutral badge-xs">in summary</span>}
      <div className="min-w-0 text-sm leading-snug">{children}</div>
      <ItemVote slot={slot} votes={votes} expanded />
    </li>
  );
}

function StatementGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-1">{title}</div>
      <ul>{children}</ul>
    </div>
  );
}

function Review() {
  const votes = useQuery(api.chartVotes.listAll) ?? [];
  const cited = useQuery(api.headlines.latest, { topic: "elnino" })?.citedSlots ?? [];
  const me = typeof window === "undefined" ? "" : (localStorage.getItem("anon-id") ?? "");
  const mine = ALL_SLOTS.filter((slot) => votes.some((v) => v.slot === slot && v.voterKey === me)).length;
  return (
    <section className="mt-10 not-prose">
      <h2 className="text-xl font-semibold tracking-tight mb-1">How the California numbers are made</h2>
      <p className="text-sm opacity-70 mb-3">
        The three California numbers rest on the {ALL_SLOTS.length} statements below. Vote on each: for a
        quote, does the source say it; for data, does the working reproduce it; for Claude F5.1's number, does the
        reasoning hold. Same recipe for each: a definition in physical units, the base rate over the whole
        record, the rate in the nine strong El Niño winters since 1950 (peak RONI ≥ 1.5: 1957-58, 1965-66,
        1972-73, 1982-83, 1986-87, 1991-92, 1997-98, 2009-10, 2015-16), the official forecasts where they
        exist, then the arithmetic. YouTube quotes are lightly corrected auto-captions, linked to the
        timestamp. Data computed 11 Sep 2026 by{" "}
        <a href={SCRIPT_URL} target="_blank" rel="noopener noreferrer" className="underline">scripts/elnino_estimates.py</a>
        ; full working in{" "}
        <a href={WORKING_URL} target="_blank" rel="noopener noreferrer" className="underline">docs/elnino-estimates.md</a>.
      </p>
      <div className="mb-6">
        <progress className="progress w-full" value={mine} max={ALL_SLOTS.length} />
        <div className="text-xs opacity-60">
          You have voted on {mine} of {ALL_SLOTS.length} · {checkedCount(votes)} checked (at least one reader
          found it useful)
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {CALIFORNIA_ESTIMATES.map((e) => (
          <div key={e.key} id={`working-${e.key}`} className="card bg-base-100 scroll-mt-4">
            <div className="card-body p-5">
              <h3 className="card-title text-base">{e.label}: {e.headline} <span className="text-xs font-normal opacity-50">range {e.range}</span></h3>
              <p className="text-sm grow-0"><span className="font-medium">Resolves yes if:</span> {e.definition}</p>
              <StatementGroup title="Data">
                {e.rows.map((r) => (
                  <Statement key={r.label} slot={rowSlot(e, r)} votes={votes} cited={cited}>
                    <span className="font-medium">{r.label}: {r.value}</span>
                    {r.detail && <div className="opacity-70 mt-0.5">{r.detail}</div>}
                    <div className="mt-1 text-xs">
                      <span className="opacity-50">Data: </span>
                      {r.data.map((d, i) => (
                        <span key={d.url}>
                          {i > 0 && <span className="opacity-40"> · </span>}
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline opacity-80">{d.label}</a>
                        </span>
                      ))}
                    </div>
                  </Statement>
                ))}
              </StatementGroup>
              <StatementGroup title="Claude F5.1's judgment">
                <Statement slot={oursSlot(e)} votes={votes} cited={cited}>
                  <span className="font-medium">Claude F5.1's number: {e.headline}</span>
                  <div className="opacity-70 mt-0.5">{e.method}</div>
                </Statement>
              </StatementGroup>
              <StatementGroup title="What the sources say, verbatim">
                {e.quotes.map((q) => (
                  <Statement key={quoteSlot(e, q)} slot={quoteSlot(e, q)} votes={votes} cited={cited}>
                    “{q.text}”{" "}
                    {q.url
                      ? <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline opacity-70">— {q.who}</a>
                      : <span className="opacity-70">— {q.who}</span>}
                  </Statement>
                ))}
              </StatementGroup>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewPointer() {
  const votes = useQuery(api.chartVotes.listAll) ?? [];
  return (
    <section className="mt-10 not-prose card bg-base-100">
      <div className="card-body p-5 text-sm">
        <h2 className="text-xl font-semibold tracking-tight">How the California numbers are made</h2>
        <p className="opacity-70 grow-0">
          Each number starts from a definition in physical units, then the base rate over the whole record,
          the rate in the nine strong El Niño winters since 1950, and the official forecasts where they
          exist. {ALL_SLOTS.length} statements (data, quotes and Claude F5.1's reasoning) sit behind the
          three numbers; {checkedCount(votes)} have been checked by a reader so far.
        </p>
        <Link to="/el-nino" search={{ mode: "review" }} className="btn btn-sm btn-neutral w-fit">Review them</Link>
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

export const Route = createFileRoute("/el-nino")({
  staticData: { title: "California El Niño" },
  validateSearch: (search: Record<string, unknown>): { mode?: "review" } =>
    search.mode === "review" ? { mode: "review" } : {},
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(simpleMarketsQuery);
  },
  component: ElNinoPage,
});

function ElNinoPage() {
  const { data: markets } = useSuspenseQuery(simpleMarketsQuery);
  const review = Route.useSearch({ select: (search) => search.mode === "review" });

  return (
    <TopicDashboard
      topic="elnino"
      title="California El Niño '26-'27"
      subtitle="What a record El Niño means for California · base rates and related markets"
      markets={markets as Market[]}
      groupTitles={GROUP_TITLES}
      groupResolutions={GROUP_RESOLUTION}
      groupKeys={ELNINO_GROUPS}
      groupDaysToShow={{ hottest_2026: 180 }}
      headerActions={<ModeToggle review={review} />}
      voteMode={review ? "expanded" : "hidden"}
      intro={<><Byline /><Headline /><CaliforniaEstimates /><EnsoContext /></>}
      footer={<>
        {review ? <Review /> : <ReviewPointer />}
        <div className="mt-6"><Caveats topic="elnino" readOnly={!review} /></div>
        {review && <SuggestionsPanel topic="elnino" />}
      </>}
    />
  );
}
