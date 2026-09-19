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
import { chartScore } from "@/lib/helpfulness";
import {
  ALL_SLOTS,
  CALIFORNIA_ESTIMATES,
  CPC_DISCUSSION_URL,
  CPC_RONI_URL,
  ENSO_CONTEXT,
  PEOPLE,
  SCRIPT_URL,
  STATEMENT_BY_SLOT,
  WORKING_URL,
  componentsOf,
  contextSlot,
  oursSlot,
  personFor,
  personSlot,
  quoteSlot,
  rowSlot,
  slotFor,
  type Estimate,
  type StatementRef,
} from "@/lib/elninoStatements";

// RONI = NOAA CPC's Relative Oceanic Niño Index: the Niño-3.4 anomaly minus
// the warming shared by the whole tropical ocean, so events from different
// decades compare like for like. CPC's table peaks at 2.4 (1982-83) and 2.3
// (1997-98, 2015-16), so "2.5 or above" is a post-1950 record by construction.

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

type Vote = { slot: string; rating: string; voterKey: string };

// Checked = at least one "useful" vote and a positive net score.
function isChecked(votes: Vote[], slot: string) {
  const forSlot = votes.filter((v) => v.slot === slot);
  return forSlot.some((v) => v.rating === "useful") && chartScore(forSlot) > 0;
}

const BODY_FONT = { fontFamily: '"Inter", system-ui, -apple-system, sans-serif' };

// ---------------------------------------------------------------------------
// Citations. Wherever the page leans on a statement it shows that statement's
// number; clicking it pulls up the statement, its sources and the vote chips.
// ---------------------------------------------------------------------------

function CitationNeeded({ children }: { children?: ReactNode }) {
  return (
    <>
      {children && <span className="underline decoration-dotted decoration-base-content/40 underline-offset-4">{children}</span>}
      <span className="badge badge-outline badge-xs align-middle opacity-70 mx-0.5 whitespace-nowrap" style={BODY_FONT}>citation needed</span>
    </>
  );
}

// Cards nest: a judgment's card cites the data and quotes it leans on, and those words
// open their own cards in turn. MAX_DEPTH stops a citation loop from recursing forever.
const MAX_DEPTH = 3;

function CiteCard({ id, st, alignRight, depth }: { id: string; st: StatementRef; alignRight: boolean; depth: number }) {
  const votes = useQuery(api.chartVotes.listAll) ?? [];
  const marked = st.marked;
  const components = marked ? componentsOf(marked.estimate) : [];
  return (
    <span id={id} role="dialog" aria-label={`Citation ${st.n}`} style={BODY_FONT}
      className={`absolute top-full z-40 mt-1 block w-[min(24rem,88vw)] cursor-auto rounded-md border border-base-300 bg-base-100 p-3 text-left text-sm font-normal leading-snug tracking-normal text-base-content opacity-100 shadow-lg max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto max-sm:w-auto ${alignRight ? "right-0" : "left-0"}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-50">[{st.n}] {st.kind}</span>
      <span className="mt-1 block font-medium">{st.title}</span>
      {marked && depth < MAX_DEPTH
        ? <span className="mt-1 block text-xs text-base-content/70"><Cited text={marked.text} resolve={(markerId) => slotFor(marked.estimate, markerId)} depth={depth + 1} /></span>
        : st.body && <span className="mt-1 block text-xs opacity-70">{st.body}</span>}
      {components.length > 0 && (
        <span className="mt-1.5 block text-xs font-medium">
          Built from {components.length} components; readers have marked {components.filter((slot) => isChecked(votes, slot)).length} useful.
        </span>
      )}
      {st.links.length > 0 && (
        <span className="mt-1.5 block text-xs">
          {st.links.map((l, i) => (
            <span key={l.url + l.label}>
              {i > 0 && <span className="opacity-40"> · </span>}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline opacity-80">{l.label}</a>
            </span>
          ))}
        </span>
      )}
      {st.speaker && depth < MAX_DEPTH && (
        <span className="mt-1.5 block text-xs text-base-content/70">
          <Cite slot={st.speaker.slot} depth={depth + 1}>Who is {st.speaker.name}?</Cite>
        </span>
      )}
      <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ItemVote slot={st.slot} votes={votes} expanded />
        <Link to="/el-nino" search={{ mode: "review" }} hash={`s-${st.n}`} className="text-xs underline opacity-70">See it in Review</Link>
      </span>
    </span>
  );
}

// `children` = the words this statement backs. Hovering or tapping them (or the
// number) pulls up the statement; a click pins it so the votes can be reached.
function Cite({ slot, children, depth = 0 }: { slot: string | undefined; children?: ReactNode; depth?: number }) {
  const st = slot ? STATEMENT_BY_SLOT.get(slot) : undefined;
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  const open = hovered || pinned;
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) { setPinned(false); setHovered(false); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!st) return <CitationNeeded>{children}</CitationNeeded>;
  const place = () => {
    const box = anchor.current?.getBoundingClientRect();
    setAlignRight(!!box && box.left > window.innerWidth / 2);
  };
  // Short delays: a pointer sweeping across the paragraph opens nothing, and one
  // crossing the gap into the card does not lose it.
  const hover = (next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (next) place(); setHovered(next); }, next ? 150 : 250);
  };
  const toggle = () => { place(); setPinned(!open); setHovered(false); window.clearTimeout(timer.current); };
  return (
    <span ref={wrap}
      onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) hover(true); }}
      onMouseLeave={() => hover(false)}
      onKeyDown={(event) => { if (event.key === "Escape") { setPinned(false); setHovered(false); } }}>
      {children && (
        <span onClick={toggle}
          className={`cursor-pointer rounded-sm transition-colors hover:bg-primary/10 ${open ? "bg-primary/15" : ""}`}>
          {children}
        </span>
      )}
      <span ref={anchor} className="relative inline-block">
        <button type="button" aria-expanded={open} aria-controls={id} aria-label={`Citation ${st.n}, ${st.kind.toLowerCase()}`}
          onClick={toggle} style={BODY_FONT}
          className="cursor-pointer align-super text-[max(0.55em,10px)] font-medium leading-none text-primary hover:underline px-px">
          [{st.n}]
        </button>
        {open && <CiteCard id={id} st={st} alignRight={alignRight} depth={depth} />}
      </span>
    </span>
  );
}

/**
 * Prose with citation markers. [[id|words]] and {{i|words}} cite a statement for those
 * words (the caller resolves id or i to a slot); [[?|words]] marks words nothing backs.
 * The bare forms [[id]] and {{i}} still work, with no words attached.
 */
function Cited({ text, resolve, depth = 0 }: { text: string; resolve: (id: string) => string | undefined; depth?: number }) {
  return (
    <>
      {text.split(/(\[\[[a-z0-9?]+(?:\|[^\]]*)?\]\]|\{\{\d+(?:\|[^}]*)?\}\})/).map((part, i) => {
        const marker = /^\[\[([a-z0-9?]+)(?:\|([^\]]*))?\]\]$|^\{\{(\d+)(?:\|([^}]*))?\}\}$/.exec(part);
        if (!marker) return part;
        const markerId = marker[1] ?? marker[3];
        const words = marker[2] ?? marker[4];
        return markerId === "?"
          ? <CitationNeeded key={i}>{words}</CitationNeeded>
          : <Cite key={i} slot={resolve(markerId)} depth={depth}>{words}</Cite>;
      })}
    </>
  );
}

// Hovering (or tapping) a tile opens its working; every line in there is a live citation,
// so cards open inside it. The tile face stays plain so the two layers do not fight.
function EstimateTile({ e }: { e: Estimate }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  const open = hovered || pinned;
  const hover = (next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovered(next), next ? 150 : 250);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) { setPinned(false); setHovered(false); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const [base, analogs] = e.rows;
  const resolve = (markerId: string) => slotFor(e, markerId);
  return (
    <div ref={ref} className="relative"
      onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) hover(true); }}
      onMouseLeave={() => hover(false)}
      onKeyDown={(event) => { if (event.key === "Escape") { setPinned(false); setHovered(false); } }}>
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => { window.clearTimeout(timer.current); setPinned(!open); setHovered(false); }}
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
        <p className="grow-0"><span className="font-medium">Resolves yes if:</span> <Cited text={e.definition} resolve={resolve} /></p>
        <table className="w-full text-xs">
          <tbody>
            {e.rows.map((r) => (
              <tr key={r.label} className="align-top">
                <td className="pr-2 py-0.5 opacity-70">{r.label}</td>
                <td className="py-0.5 font-medium whitespace-nowrap"><Cite slot={rowSlot(e, r)}>{r.value}</Cite></td>
              </tr>
            ))}
            <tr className="align-top border-t border-base-300">
              <td className="pr-2 py-0.5 opacity-70">Claude F5.1's number</td>
              <td className="py-0.5 font-bold whitespace-nowrap"><Cite slot={oursSlot(e)}>{e.headline}</Cite></td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs opacity-80"><Cited text={e.method} resolve={resolve} /></p>
        <blockquote className="text-xs border-l-2 border-base-300 pl-2 opacity-80">
          <Cite slot={quoteSlot(e, e.quotes[0])}>“{e.quotes[0].text}”</Cite> <span className="opacity-60">— {e.quotes[0].who}</span>
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
      <Cite slot={personSlot(PEOPLE[1])} />
    </p>
  );
}

// The big summary under the title is built from the three boxes, so it cannot drift from
// them: each number is that box's judgment, and its card shows the components behind it.
const SUMMARY_SLOTS = CALIFORNIA_ESTIMATES.map(oursSlot);

function Headline() {
  const pct = (e: Estimate) => Number(/\d+/.exec(e.headline)?.[0] ?? NaN);
  const band = (lo: number, hi: number) => CALIFORNIA_ESTIMATES.filter((e) => pct(e) >= lo && pct(e) < hi);
  const odds = (e: Estimate) => <Cite slot={oursSlot(e)}>about {pct(e)}%</Cite>;
  const list = (items: Estimate[], each: (e: Estimate) => ReactNode) =>
    items.map((e, i) => <span key={e.key}>{i > 0 && (i === items.length - 1 ? " and " : ", ")}{each(e)}</span>);
  const capital = (text: string) => text[0].toUpperCase() + text.slice(1);
  const [likely, possible, unlikely] = [band(50, 101), band(20, 50), band(0, 20)];
  return (
    <section className="mb-8 not-prose max-w-4xl">
      <p className="text-2xl md:text-3xl leading-snug tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {likely.length > 0 && <>California will probably get {list(likely, (e) => <>{e.phrase} ({odds(e)})</>)}. </>}
        {possible.map((e) => <span key={e.key}>{capital(e.phrase)} is possible: {odds(e)}. </span>)}
        {unlikely.map((e) => <span key={e.key}>{capital(e.phrase)} is unlikely: {odds(e)}. </span>)}
      </p>
      <p className="text-xs opacity-60 mt-2">
        A summary of the three boxes below. Each number is Claude F5.1's judgment, built from the components in
        its box; hover it to see them and vote.{" "}
        <Link to="/el-nino" search={{ mode: "review" }} className="underline">Review them</Link>
      </p>
    </section>
  );
}

function CaliforniaEstimates() {
  return (
    <section className="mb-8 not-prose">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CALIFORNIA_ESTIMATES.map((e) => <EstimateTile key={e.key} e={e} />)}
      </div>
    </section>
  );
}

const checkedCount = (votes: Vote[]) => ALL_SLOTS.filter((slot) => isChecked(votes, slot)).length;

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
  const n = STATEMENT_BY_SLOT.get(slot)?.n;
  return (
    <li id={`s-${n}`} className="flex scroll-mt-4 flex-col items-start gap-1.5 border-t border-base-200 py-2.5 first:border-t-0">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-50">
        [{n}]
        {cited.includes(slot) && <span className="badge badge-neutral badge-xs font-normal">in summary</span>}
      </div>
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
  const cited = SUMMARY_SLOTS;
  const me = typeof window === "undefined" ? "" : (localStorage.getItem("anon-id") ?? "");
  const mine = ALL_SLOTS.filter((slot) => votes.some((v) => v.slot === slot && v.voterKey === me)).length;
  return (
    <section className="mt-10 not-prose">
      <h2 className="text-xl font-semibold tracking-tight mb-1">How the California numbers are made</h2>
      <p className="text-sm opacity-70 mb-3">
        The page rests on the {ALL_SLOTS.length} numbered statements below; the same numbers appear as citations
        wherever a statement is used. Vote on each: for a quote, does the source say it; for data, does the working
        reproduce it; for Claude F5.1's number, does the reasoning hold. Same recipe for each estimate: a definition in
        physical units, the base rate over the whole record, the rate in the nine strong El Niño winters since 1950
        (peak RONI ≥ 1.5: 1957-58, 1965-66, 1972-73, 1982-83, 1986-87, 1991-92, 1997-98, 2009-10, 2015-16), the
        official forecasts where they exist, then the arithmetic. YouTube quotes are lightly corrected auto-captions,
        linked to the timestamp. Data computed 11 Sep 2026 by{" "}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
      <div id="working-people" className="card bg-base-100 scroll-mt-4">
        <div className="card-body p-5">
          <h3 className="card-title text-base">Who is quoted</h3>
          <StatementGroup title="People">
            {PEOPLE.map((p) => (
              <Statement key={p.id} slot={personSlot(p)} votes={votes} cited={cited}>
                <span className="font-medium">{p.name}.</span> {p.text}
                <div className="mt-1 text-xs">
                  {p.links.map((l, i) => (
                    <span key={l.url}>
                      {i > 0 && <span className="opacity-40"> · </span>}
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline opacity-80">{l.label}</a>
                    </span>
                  ))}
                </div>
              </Statement>
            ))}
          </StatementGroup>
        </div>
      </div>
      <div id="working-context" className="card bg-base-100 scroll-mt-4">
        <div className="card-body p-5">
          <h3 className="card-title text-base">The El Niño itself</h3>
          <StatementGroup title="What NOAA says, verbatim">
            {ENSO_CONTEXT.map((c) => (
              <Statement key={c.id} slot={contextSlot(c)} votes={votes} cited={cited}>
                “{c.text}”{" "}
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline opacity-70">— {c.who}</a>
              </Statement>
            ))}
          </StatementGroup>
        </div>
      </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {CALIFORNIA_ESTIMATES.map((e) => {
          const resolve = (markerId: string) => slotFor(e, markerId);
          return (
            <div key={e.key} id={`working-${e.key}`} className="card bg-base-100 scroll-mt-4">
              <div className="card-body p-5">
                <h3 className="card-title text-base">{e.label}: {e.headline} <span className="text-xs font-normal opacity-50">range {e.range}</span></h3>
                <p className="text-sm grow-0"><span className="font-medium">Resolves yes if:</span> <Cited text={e.definition} resolve={resolve} /></p>
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
                    <div className="opacity-70 mt-0.5"><Cited text={e.method} resolve={resolve} /></div>
                  </Statement>
                </StatementGroup>
                <StatementGroup title="What the sources say, verbatim">
                  {e.quotes.map((q) => (
                    <Statement key={quoteSlot(e, q)} slot={quoteSlot(e, q)} votes={votes} cited={cited}>
                      “{q.text}”{" "}
                      {q.url
                        ? <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline opacity-70">— {q.who}</a>
                        : <span className="opacity-70">— {q.who}</span>}
                      {personFor(q.who) && <Cite slot={personSlot(personFor(q.who)!)} />}
                    </Statement>
                  ))}
                </StatementGroup>
              </div>
            </div>
          );
        })}
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
          exist. {ALL_SLOTS.length} numbered statements (data, quotes and Claude F5.1's reasoning) sit behind the
          page; {checkedCount(votes)} have been checked by a reader so far.
        </p>
        <Link to="/el-nino" search={{ mode: "review" }} className="btn btn-sm btn-neutral w-fit">Review them</Link>
      </div>
    </section>
  );
}

function EnsoContext() {
  const [nino34, veryStrong, historic] = ENSO_CONTEXT;
  return (
    <p className="text-sm opacity-70 mb-6 not-prose">
      NOAA's 10 September discussion has <Cite slot={contextSlot(nino34)}>Niño-3.4 at +1.8°C</Cite>,{" "}
      <Cite slot={contextSlot(veryStrong)}>a greater than 90% chance of a very strong El Niño this fall and winter</Cite>, and{" "}
      <Cite slot={contextSlot(historic)}>a 75% chance of a historic event stronger than any since 1950</Cite>. The markets below price the
      strength of the event and its knock-on for global temperature; the tiles above are what that means for
      California.{" "}
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
