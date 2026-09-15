import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import surveyJson from "@/data/ai-risk-survey.json";
import peopleJson from "@/data/ai-risk-public-figures.json";
import { distributionStats, formatProbability, percentileAt } from "@/lib/ai-risk/distribution";
import { estimateBounds, estimateLabel, sortQuotes } from "@/lib/ai-risk/public-estimates";
import type { OutcomeId, PublicFiguresData, SurveyData } from "@/lib/ai-risk/types";
import { DistributionChart } from "./DistributionChart";
import { ForecastForm } from "./ForecastForm";
import { Portrait } from "./Portrait";
import { UsefulnessBar } from "./UsefulnessBar";
import "./ai-risk.css";

const survey = surveyJson as SurveyData;
const people = peopleJson as PublicFiguresData;
const outcomeQuestions = survey.questions.filter(question => question.group === "outcomes");
const emptyMine: Record<string, number> = {};

function browserKey() {
  const key = "globalriskodds:ai-risk:voter";
  try {
    const previous = localStorage.getItem(key);
    if (previous && /^[A-Za-z0-9_-]{36,128}$/.test(previous)) return previous;
    const next = crypto.randomUUID();
    localStorage.setItem(key, next);
    return next;
  } catch { return crypto.randomUUID(); }
}

function dateLabel(date: string | null) {
  return date ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Date not specified";
}

function ordinal(value: number) {
  const rounded = Math.round(value);
  const tens = rounded % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[rounded % 10] ?? "th";
  return `${rounded}${suffix}`;
}

export function AiRiskPage({ accessToken }: { accessToken: string }) {
  const [voterKey] = useState(browserKey);
  const [outcome, setOutcome] = useState<OutcomeId>("extinction");
  const [audience, setAudience] = useState<"researchers" | "viewers">("researchers");
  const [descending, setDescending] = useState(false);
  const [quoteSort, setQuoteSort] = useState("high");
  const [showAll, setShowAll] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<string | null>("daniel-70-2025");
  const question = survey.questions.find(item => item.id === outcome)!;
  const questionIndex = survey.questions.indexOf(question);
  const summary = useQuery(api.aiRisk.getSummary, { voterKey, accessToken });
  const rate = useMutation(api.aiRisk.rate);
  const slots = useMemo(() => [`ai-risk:chart:${outcome}`, ...people.quotes.map(quote => `ai-risk:quote:${quote.id}`)], [outcome]);
  const feedback = useQuery(api.aiRisk.getFeedback, { voterKey, slots, accessToken });
  const feedbackBySlot = Object.fromEntries((feedback ?? []).map(tally => [tally.slot, tally]));
  const quoteVotes = Object.fromEntries(people.quotes.map(quote => [quote.id, feedbackBySlot[`ai-risk:quote:${quote.id}`]?.useful ?? 0]));
  const relatedQuotes = people.quotes.filter(quote => quote.outcomeIds.includes(outcome));
  const quotes = sortQuotes(showAll ? people.quotes : relatedQuotes, quoteSort, quoteVotes);
  const selected = relatedQuotes.find(quote => quote.id === selectedQuote);
  const selectedFigure = people.figures.find(figure => figure.id === selected?.figureId);
  const viewers = summary?.distributions.find(item => item.outcomeId === outcome);
  const values = audience === "researchers" ? question.values : viewers?.values ?? [];
  const stats = distributionStats(values);
  const selectedBounds = selected && estimateBounds(selected.estimate);
  const selectedRank = selectedBounds && stats.n > 0 ? percentileAt(values, selectedBounds[0]).midpoint : null;
  const mine = summary?.mine ?? emptyMine;

  function chooseOutcome(next: OutcomeId) {
    setOutcome(next);
    const candidate = people.quotes.find(quote => quote.outcomeIds.includes(next) && quote.estimate.kind !== "qualitative");
    setSelectedQuote(candidate?.id ?? null);
  }

  function selectQuote(id: string) {
    const quote = people.quotes.find(item => item.id === id)!;
    if (!quote.outcomeIds.includes(outcome) && quote.outcomeIds.length) setOutcome(quote.outcomeIds[0]);
    setSelectedQuote(id);
    setAudience("researchers");
  }

  return <div className="air-page not-prose">
    <header className="air-intro"><div><p className="air-eyebrow">AI IMPACTS · 2024 EXPERT SURVEY ON PROGRESS IN AI</p><h1>What are the odds<br className="air-desktop-break" /> of AI doom?</h1><p className="air-lede">Explore researchers’ answers, see where public figures would land, and add your own forecast.</p></div><div className="air-intro-index"><span>THE AI RISK EXPLORER</span><b>8</b><span>survey questions</span><span className="air-index-divider" /><b>{people.figures.length}</b><span>public voices</span></div></header>

    <section className="air-outcome-panel" aria-label="Choose a survey outcome">
      <div className="air-control-heading"><span className="air-eyebrow">01 · CHOOSE AN OUTCOME</span><span>{questionIndex + 1} of {survey.questions.length}</span></div>
      <label className="air-outcome-slider"><span className="sr-only">Survey outcome</span><input type="range" min="0" max={survey.questions.length - 1} step="1" value={questionIndex} onChange={event => chooseOutcome(survey.questions[Number(event.target.value)].id)} aria-valuetext={question.shortLabel} /><span aria-hidden="true" className="air-slider-stops">{survey.questions.map(item => <i key={item.id} />)}</span></label>
      <div className="air-outcome-groups"><div><span className="air-group-label">Catastrophic risk · independent questions</span><div className="air-outcome-buttons">{survey.questions.filter(item => item.group === "risk").map(item => <button key={item.id} type="button" aria-pressed={outcome === item.id} onClick={() => chooseOutcome(item.id)}>{item.shortLabel}</button>)}</div></div><div><span className="air-group-label">Long-run impact · assuming human-level AI exists</span><div className="air-outcome-buttons">{outcomeQuestions.map(item => <button key={item.id} type="button" aria-pressed={outcome === item.id} onClick={() => chooseOutcome(item.id)}>{item.shortLabel}</button>)}</div></div></div>
    </section>

    <section className="air-chart-panel" aria-label="AI risk distribution">
      <div className="air-chart-heading"><div><p className="air-eyebrow">02 · EXPLORE THE ANSWERS</p><h2>{outcome === "extinction" ? (audience === "researchers" ? "AI researchers’ p(doom)" : "Site viewers’ p(doom)") : question.label}</h2><p className="air-question-description">{question.description}</p></div><div className="air-median-stat"><b>{stats.n ? formatProbability(stats.median) : "—"}</b><span>median answer</span></div></div>
      <div className="air-chart-toolbar"><div className="air-segmented" aria-label="Whose answers to display"><button type="button" aria-pressed={audience === "researchers"} onClick={() => setAudience("researchers")}>AI researchers <span>{question.n.toLocaleString()}</span></button><button type="button" aria-pressed={audience === "viewers"} onClick={() => setAudience("viewers")}>Viewers to this site <span>{viewers?.n ?? "…"}</span></button></div><label className="air-sort-label">Order <select value={descending ? "high" : "low"} onChange={event => setDescending(event.target.value === "high")} aria-label="Order chart answers"><option value="low">Lowest first</option><option value="high">Highest first</option></select></label></div>
      {audience === "viewers" && <p className="air-audience-note">Voluntary viewer responses · one answer per browser for this question · updated live</p>}
      {audience === "researchers" && relatedQuotes.some(quote => quote.estimate.kind !== "qualitative") && <><p className="air-comparison-note">Faces show historical estimates of related outcomes. Definitions and time horizons differ.</p><div className="air-mobile-people" aria-label="Select a public figure">{relatedQuotes.filter(quote => quote.estimate.kind !== "qualitative").map(quote => { const figure = people.figures.find(person => person.id === quote.figureId)!; return <button key={quote.id} type="button" aria-pressed={selectedQuote === quote.id} aria-label={`Show ${figure.name} on chart`} onClick={() => selectQuote(quote.id)}><Portrait figure={figure} /><span>{figure.name.split(" ").slice(-1)[0]}</span></button>; })}</div></>}
      {audience === "viewers" && !summary ? <div className="air-empty-chart" role="status"><h3>Connecting to viewer forecasts…</h3><p>The survey and public statements are available while this loads.</p></div> : <DistributionChart values={values} figures={people.figures} quotes={audience === "researchers" ? relatedQuotes : []} selectedQuote={selectedQuote} onSelectQuote={selectQuote} descending={descending} audience={audience} mine={mine[outcome]} />}
      {audience === "researchers" && selected && selectedFigure && <div className="air-selected-statement"><Portrait figure={selectedFigure} /><div><strong>{selectedFigure.name} <span>· {estimateLabel(selected.estimate)}</span></strong><p>{selected.originalOutcome}</p><span className="air-small">{dateLabel(selected.date)}{selectedRank !== null && selected.estimate.kind === "point" ? ` · Would sit at the ${ordinal(selectedRank)} percentile of these answers` : " · Range / wording preserved in the source below"}</span></div><a href={`#quote-${selected.id}`} className="air-text-link">Read quote ↓</a></div>}
      <div className="air-chart-footer"><p>{audience === "viewers" ? "Answers: Viewers to this site. Question source: " : "Source: "}<a href={survey.sourceUrl} target="_blank" rel="noreferrer">{survey.sourceLabel}</a></p><p>Public statements are separate comparisons, not survey answers. Their definitions and time horizons differ.</p></div>
      <UsefulnessBar label="Rate this survey chart" tally={feedbackBySlot[`ai-risk:chart:${outcome}`]} loading={!feedback} onRate={rating => rate({ voterKey, accessToken, slot: `ai-risk:chart:${outcome}`, rating })} />
    </section>

    <ForecastForm key={question.group === "outcomes" ? "outcomes" : outcome} question={question} outcomeQuestions={outcomeQuestions} mine={mine} voterKey={voterKey} accessToken={accessToken} ready={!!summary} />

    <section className="air-public-figures" aria-label="Public figures and sources">
      <div className="air-section-heading"><div><p className="air-eyebrow">03 · THE PEOPLE BEHIND THE NUMBERS</p><h2>What have people said?</h2><p>Dated statements, in their own words. Select a numerical estimate to place it on the chart.</p></div><div className="air-quote-controls"><label><span className="sr-only">Which public statements</span><select value={showAll ? "all" : "related"} onChange={event => setShowAll(event.target.value === "all")}><option value="related">Related to this outcome</option><option value="all">All public statements</option></select></label><label><span className="sr-only">Sort public statements</span><select value={quoteSort} onChange={event => setQuoteSort(event.target.value)}><option value="high">Highest estimate first</option><option value="low">Lowest estimate first</option><option value="newest">Newest statement first</option><option value="useful">Most useful first</option></select></label></div></div>
      <p className="air-small">Historical quotes from 2023–2026; these may not be people’s latest views. Ranges sort by their lower bound. No numerical estimate is inferred from a qualitative view.</p>
      {quotes.length === 0 && <div className="air-no-quotes"><h3>No sourced public estimates for this question yet.</h3><p>The researcher answers above still apply. Browse the public statements for other outcomes.</p><button type="button" className="air-text-link" onClick={() => setShowAll(true)}>Show all public statements →</button></div>}
      <div className="air-quote-grid">{quotes.map(quote => {
        const figure = people.figures.find(item => item.id === quote.figureId)!;
        const numeric = quote.estimate.kind !== "qualitative";
        const slot = `ai-risk:quote:${quote.id}`;
        return <article className={`air-quote-card ${quote.id === selectedQuote ? "is-selected" : ""}`} key={quote.id} id={`quote-${quote.id}`}>
          <div className="air-person-heading"><Portrait figure={figure} /><div><h3>{figure.name}</h3><p>{figure.role}</p></div><time dateTime={quote.date ?? undefined}>{dateLabel(quote.date)}</time></div>
          <div className="air-estimate-row"><strong className={numeric ? "" : "air-qualitative-label"}>{estimateLabel(quote.estimate)}</strong>{numeric ? <button type="button" className="air-locate" aria-pressed={quote.id === selectedQuote} onClick={() => { selectQuote(quote.id); document.querySelector(".air-chart-panel")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }}>{quote.id === selectedQuote ? "Located on chart ↗" : "Locate on chart ↗"}</button> : <span className="air-small">No numerical marker</span>}</div>
          <p className="air-original-outcome">{quote.originalOutcome}</p>
          <blockquote>“{quote.quote}”</blockquote>
          <p className="air-quote-context">{quote.context}</p>
          <div className="air-source-links"><a href={quote.sourceUrl} target="_blank" rel="noreferrer">{quote.sourceTitle} ↗</a>{quote.findingConsensusUrl && <span>Collected by <a href={quote.findingConsensusUrl} target="_blank" rel="noreferrer">Finding Consensus ↗</a></span>}</div>
          <UsefulnessBar label={`Rate ${figure.name}’s statement`} tally={feedbackBySlot[slot]} loading={!feedback} onRate={rating => rate({ voterKey, accessToken, slot, rating })} />
        </article>;
      })}</div>
    </section>

    <details className="air-methods"><summary>About the data, comparisons & portraits <span>+</span></summary><div className="air-methods-content"><h3>The researcher survey</h3><p>Source: <a href={survey.sourceUrl} target="_blank" rel="noreferrer">{survey.sourceLabel}</a>. The three risk questions were randomly assigned and are shown separately. Each chart uses valid answers to its question; denominators vary. The five long-run effects use complete responses that sum to 100% and are conditional on human-level AI eventually existing.</p><p>{question.wordingNote}</p><p>The 100 lines sample observed values at evenly spaced ranks. Hover statistics, medians and public-figure positions use every valid answer, not just the displayed lines. Tied estimates are placed at the middle of the tied group. A range or bound connects to its endpoints; no midpoint probability is attributed to the speaker. “Extinction / disempowerment” is shorthand for the full outcome above.</p><h3>Public statements</h3><p>These are illustrative historical statements, not a representative sample of public figures. Placement compares the quoted numerical value with the survey distribution, even where the underlying question differs. Read each card’s outcome, context and date before comparing people.</p><p>Finding Consensus’s public records concern SB 1047. We used its quotes and source leads, while keeping policy scores out of this probability chart. <a href="https://findingconsensus.ai" target="_blank" rel="noreferrer">Finding Consensus ↗</a></p><h3>Viewer forecasts and votes</h3><p>Submissions are stored on the site’s server and the aggregate updates for everyone. A random browser token lets you revise your answers and usefulness votes. Individual browser tokens are not returned in public results. These counts are not verified unique people: private browsing or another device can create another token. Usefulness votes rate the presentation or statement’s usefulness, not whether its probability is correct.</p><h3>Portrait credits</h3><ul>{people.figures.map(figure => <li key={figure.id}><a href={figure.portrait.sourceUrl} target="_blank" rel="noreferrer">{figure.name}</a> — {figure.portrait.credit}</li>)}</ul></div></details>
    <footer className="air-page-footer"><span>GLOBAL RISK ODDS</span><span>Source: {survey.sourceLabel}</span></footer>
  </div>;
}
