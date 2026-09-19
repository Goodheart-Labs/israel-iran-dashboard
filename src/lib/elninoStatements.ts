import { itemId } from "@/lib/helpfulness";

// Everything the /el-nino page asserts, as data: the three California estimates, the
// NOAA context, and a registry that gives every statement a stable number, a vote
// slot and the links that back it, so the page can cite it wherever it is used.

export const CPC_RONI_URL = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/";
export const CPC_DISCUSSION_URL =
  "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml";

// ---------------------------------------------------------------------------
// California this winter. Nothing on any exchange prices these, so the tiles
// are our own numbers: a definition in physical units, the base rate over the
// whole record, the rate in the nine strong El Niño winters since 1950, the
// official forecasts where they exist, and the arithmetic. All computed by
// scripts/elnino_estimates.py; the working is docs/elnino-estimates.md.
// ---------------------------------------------------------------------------

export const REPO = "https://github.com/Goodheart-Labs/globalriskodds/blob/main";
export const WORKING_URL = `${REPO}/docs/elnino-estimates.md`;
export const SCRIPT_URL = `${REPO}/scripts/elnino_estimates.py`;

export type DataLink = { label: string; url: string };
// id: short handle for [[id|cited words]] citation markers; face: short label on the tile; data: where the figure comes from
export type Row = { id: string; label: string; value: string; detail?: string; face?: string; data: DataLink[] };

export type Quote = { text: string; who: string; url?: string }; // no url: a message relayed by one of the page's authors, not published anywhere

export type Estimate = {
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
const D_ONI: DataLink = { label: "NOAA CPC ONI series (text file)", url: "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt" };
const D_RONI: DataLink = { label: "NOAA CPC RONI table (which winters count as strong El Niño)", url: CPC_RONI_URL };
const D_HTF: DataLink = { label: "NOAA monthly high-tide flood counts, Los Angeles gauge 9410660 (JSON)", url: "https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_monthly.json?station=9410660" };
const D_FLOOD_LEVELS: DataLink = { label: "NOAA flood thresholds for gauge 9410660 (JSON)", url: "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9410660/floodlevels.json" };
const D_HS: DataLink = { label: "Huang & Swain 2022, Science Advances, Fig. 5B", url: "https://www.science.org/doi/10.1126/sciadv.abq0995" };

export const CALIFORNIA_ESTIMATES: Estimate[] = [
  {
    key: "wet",
    label: "Very wet winter",
    headline: "~65%",
    range: "45–85%",
    definition:
      "California's statewide Dec–Feb 2026-27 precipitation is at least 15.1 inches: [[base|the wettest 20% of the 131 winters on record (median 10.8 in)]].",
    rows: [
      { id: "base", label: "Base rate, all 131 winters", value: "20%", detail: "by construction", data: [D_PRECIP_DJF, D_PRECIP_DJF_CSV] },
      { id: "analogs", label: `Rate in ${ANALOGS}`, value: "33%", detail: "3 of 9: 1957-58, 1982-83, 1997-98. Above the median: 6 of 9.", data: [D_PRECIP_DJF_CSV, D_RONI] },
      { id: "ecmwf", label: "ECMWF September ensemble", value: ">70%", detail: "odds of a top-20% winter along the coast; ~2 in 3 for a top-10% winter; ~20% for a record-wet winter in a significant chunk of the state (Swain, 10 Sep)", data: [{ label: "Swain reading the ensemble on screen, 41:46 (secondhand: the page has not pulled ECMWF's own numbers)", url: SW_SEP + "&t=2506s" }, { label: "ECMWF seasonal forecast charts (Copernicus C3S)", url: "https://climate.copernicus.eu/charts/packages/c3s_seasonal/" }] },
      { id: "cpc", label: "NOAA CPC outlook, 20 Aug", value: ">50%", detail: "odds of above-normal (top-third) precipitation for coastal California", data: [{ label: "NOAA CPC seasonal outlook discussion", url: "https://www.cpc.ncep.noaa.gov/products/predictions/long_range/fxus05.html" }] },
    ],
    method:
      "Between [[analogs|the analog rate (33%)]] and [[ecmwf|the ECMWF ensemble (>70%)]], leaning to the model. [[q3|It correctly hindcast 2015-16 as a dry strong-El Niño winter and 1982-83 and 1997-98 as wet ones]], and this event is [[?|forecast to peak near RONI 3.0]], [[analogs|beyond every analog (max 2.4)]]. Claude F5.1 stops short of the model because it is one system and, [[?|as Swain notes, an under-dispersed ensemble can be too wet or too dry]].",
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
      "The Los Angeles tide gauge (NOAA 9410660) records at least 3 days between Nov 2026 and Apr 2027 at or above [[base|NOAA's minor coastal flood level: 11.18 ft on the station datum, 1.9 ft above mean higher high water]].",
    rows: [
      { id: "base", label: "Base rate, 72 winters since 1950", value: "10%", detail: "7 of 72. Last 11 winters: 3 of 11 (2025-26 had 6 days with no El Niño).", data: [D_HTF, D_FLOOD_LEVELS, { label: "NOAA high tide flooding overview", url: "https://tidesandcurrents.noaa.gov/high-tide-flooding/" }] },
      { id: "analogs", label: `Rate in ${ANALOGS}`, value: "38%", detail: "3 of 8 with data: 1982-83 (6 days), 2015-16 (5), 1997-98 (3). At least 1 day: 7 of 8.", data: [D_HTF, D_RONI] },
      { id: "lift", label: "El Niño sea-level lift", value: "6–12 in", detail: "already observed off California in September (Swain), a third to a half of the 22-inch margin between mean higher high water and the flood level; NOAA: 6–10 in seasonal rise", data: [{ label: "Swain on observed sea level, 24:57 (secondhand: no tide-gauge series pulled)", url: SW_SEP + "&t=1497s" }, { label: "NOAA Ocean Service: El Niño and high tide flooding, May 2026", url: "https://oceanservice.noaa.gov/news/may26/el-nino-flooding.html" }, D_FLOOD_LEVELS] },
    ],
    method:
      "[[analogs|The analog rate]], raised a long way: [[analogs|the two most recent analogs both cleared 3 days easily]], [[base|last winter cleared it with no El Niño at all]], [[lift|the lift is already 6–12 inches in September]], and [[q2|Swain expects record sea levels in San Diego and much of the state this winter]].",
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
    headline: "~8%",
    range: "5–15%",
    definition:
      "A month-long megastorm on the ARkStorm scale: [[q6|roughly 447 mm (17.6 in) or more of precipitation averaged over the whole state in 30 days, the ARkHist scenario of ARkStorm 2.0]], [[?|which brings slightly less rain than the winter of 1861-62 did]]. [[base|The biggest calendar month in the 131-year record is 12.5 in (Jan 1995)]].",
    rows: [
      { id: "base", label: "Base rate at today's warming", value: "2.5–3% / yr", detail: "Huang & Swain 2022, Fig. 5B: about 1%/yr in the pre-industrial climate, rising ~1.2 points per °C of global warming. At 1.3–1.65°C (30-year-smoothed vs single-year 2026 estimates) that is 2.5–3%. Cross-check: a stationary 131-year record is beaten with probability 1/132 = 0.8%; warming to date has roughly doubled the 1920 rate.", data: [D_HS, { label: "Weather West summary of the paper", url: "https://weatherwest.com/archives/16626" }, D_PRECIP_MONTHLY_CSV] },
      { id: "mult", label: "El Niño multiplier", value: "×2–5", detail: "Huang & Swain: 7 of the 8 most intense simulated 30-day sequences fell in a moderate-to-strong El Niño year (8 of 8 with rounding). Such winters are 18% of NOAA's record since 1950 on ONI (14 of 76) and 24% on RONI (18 of 76), so taken at face value the lift is ×3.7–4.8. Two things pull it down: half the paper's events come from a simulated 2071–80 and the paper does not say how common El Niño years are inside the model (if 35–50%, the lift is only ×2–2.5), and the instrumental record shows ×2.4 (2 of 9 strong El Niño winters had a 9-inch month vs 12 of 131 overall).", face: "El Niño", data: [D_HS, D_ONI, D_RONI, D_PRECIP_MONTHLY_CSV] },
    ],
    method:
      "[[base|Base rate 2.5–3% a year (Fig. 5B)]] times [[mult|an El Niño multiplier of ×2–5]] gives 5–15%; the headline takes about ×3. [[q8|Belikewater argues for 10–13%]] by taking [[q5|the 7-of-8 finding]] at face value against [[mult|how rare such winters are]]. Claude F5.1 sits lower because the model's own El Niño frequency is unknown and [[mult|the instrumental record suggests ×2.4]]. Until 18 Sep this tile showed the unconditioned ~3%.",
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

// The El Niño itself: NOAA CPC's ENSO Diagnostic Discussion of 10 Sep 2026, quoted verbatim.
export type Context = { id: string; text: string; who: string; url: string };
const CPC_DISC = "NOAA CPC ENSO Diagnostic Discussion, 10 Sep 2026";
export const ENSO_CONTEXT: Context[] = [
  { id: "nino34", text: "values in the other Niño indices increased, reaching +1.8°C in Niño-3.4", who: CPC_DISC, url: CPC_DISCUSSION_URL },
  { id: "verystrong", text: "El Niño is strengthening, with a greater than 90% chance of a very strong event during the Northern Hemisphere fall and winter 2026-27.", who: CPC_DISC, url: CPC_DISCUSSION_URL },
  { id: "historic", text: "there is a 75% chance of a historic event that would exceed the strength of previous El Niño events dating back to 1950 (+2.5°C or more for a 3-month RONI value)", who: CPC_DISC, url: CPC_DISCUSSION_URL },
];

// Vote slots. The row/ours/quote ids predate the review view; changing them orphans readers' votes.
export const rowSlot = (e: Estimate, r: Row) => `elnino:row:${e.key}:${itemId(r.label)}`;
export const oursSlot = (e: Estimate) => `elnino:ours:${e.key}`;
export const quoteSlot = (e: Estimate, q: Quote) => `elnino:quote:${e.key}:${itemId(q.url ?? "", q.text.slice(0, 60))}`;
export const contextSlot = (c: Context) => `elnino:context:${c.id}`;

export type StatementRef = {
  slot: string;
  n: number; // the number shown in citations, stable while the lists above keep their order
  kind: "Data" | "Judgment" | "Quote" | "Context";
  title: string;
  body?: string;
  links: DataLink[];
};

/** Drops citation markers and keeps their words, for places that show prose without citations. */
export const plain = (text: string) => text.replace(/\[\[[a-z0-9?]+(?:\|([^\]]*))?\]\]/g, "$1");

const refs: Omit<StatementRef, "n">[] = [
  ...ENSO_CONTEXT.map((c) => ({ slot: contextSlot(c), kind: "Context" as const, title: `“${c.text}”`, links: [{ label: c.who, url: c.url }] })),
  ...CALIFORNIA_ESTIMATES.flatMap((e) => [
    ...e.rows.map((r) => ({ slot: rowSlot(e, r), kind: "Data" as const, title: `${e.label}. ${r.label}: ${r.value}`, body: r.detail, links: r.data })),
    { slot: oursSlot(e), kind: "Judgment" as const, title: `${e.label}. Claude F5.1's number: ${e.headline} (range ${e.range})`, body: plain(e.method), links: [] },
    ...e.quotes.map((q) => ({ slot: quoteSlot(e, q), kind: "Quote" as const, title: `“${q.text}”`, body: q.url ? undefined : q.who, links: q.url ? [{ label: q.who, url: q.url }] : [] })),
  ]),
];
export const STATEMENTS: StatementRef[] = refs.map((r, i) => ({ ...r, n: i + 1 }));
export const STATEMENT_BY_SLOT = new Map(STATEMENTS.map((st) => [st.slot, st]));
export const ALL_SLOTS = STATEMENTS.map((st) => st.slot);

/** Resolves a [[id]] marker inside one estimate's prose: a row id, "ours", or "qN" (1-based quote). */
export function slotFor(e: Estimate, id: string): string | undefined {
  const row = e.rows.find((r) => r.id === id);
  if (row) return rowSlot(e, row);
  if (id === "ours") return oursSlot(e);
  const q = /^q(\d+)$/.exec(id);
  const quote = q ? e.quotes[Number(q[1]) - 1] : undefined;
  return quote ? quoteSlot(e, quote) : undefined;
}
