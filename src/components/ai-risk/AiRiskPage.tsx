import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import surveyJson from "@/data/ai-risk-survey.json";
import peopleJson from "@/data/ai-risk-public-figures.json";
import { estimateLabel, sortQuotes } from "@/lib/ai-risk/public-estimates";
import type { OutcomeId, PublicFiguresData, SurveyData } from "@/lib/ai-risk/types";
import { DistributionChart } from "./DistributionChart";
import { ForecastForm } from "./ForecastForm";
import { Portrait } from "./Portrait";
import { AccuracyVote } from "./AccuracyVote";
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

export function AiRiskPage({ accessToken }: { accessToken: string }) {
  const [voterKey] = useState(browserKey);
  const [outcome, setOutcome] = useState<OutcomeId>("extinction");
  const [audience, setAudience] = useState<"researchers" | "viewers">("researchers");
  const [descending, setDescending] = useState(false);
  const [quoteSort, setQuoteSort] = useState("high");
  const [showAll, setShowAll] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const question = survey.questions.find(item => item.id === outcome)!;
  const questionIndex = survey.questions.indexOf(question);
  const summary = useQuery(api.aiRisk.getSummary, { voterKey, accessToken });
  const rate = useMutation(api.aiRisk.rate);
  // Accuracy votes have separate slots so earlier usefulness votes retain their meaning.
  const slots = useMemo(() => people.quotes.flatMap(quote => [`ai-risk:number-accuracy:${quote.id}`, `ai-risk:quote-accuracy:${quote.id}`]), []);
  const feedback = useQuery(api.aiRisk.getFeedback, { voterKey, slots, accessToken });
  const feedbackBySlot = Object.fromEntries((feedback ?? []).map(tally => [tally.slot, tally]));
  const quoteVotes = Object.fromEntries(people.quotes.map(quote => [quote.id, feedbackBySlot[`ai-risk:number-accuracy:${quote.id}`]?.useful ?? 0]));
  const relatedQuotes = people.quotes.filter(quote => quote.outcomeIds.includes(outcome));
  const quotes = sortQuotes(showAll ? people.quotes : relatedQuotes, quoteSort, quoteVotes);
  const selected = people.quotes.find(quote => quote.id === selectedQuote);
  const selectedFigure = people.figures.find(figure => figure.id === selected?.figureId);
  const viewers = summary?.distributions.find(item => item.outcomeId === outcome);
  const values = audience === "researchers" ? question.values : viewers?.values ?? [];
  const mine = summary?.mine ?? emptyMine;

  function chooseOutcome(next: OutcomeId) {
    setOutcome(next);
    setSelectedQuote(null);
  }

  function selectQuote(id: string) {
    const quote = people.quotes.find(item => item.id === id)!;
    if (!quote.outcomeIds.includes(outcome) && quote.outcomeIds.length) setOutcome(quote.outcomeIds[0]);
    setSelectedQuote(id);
    setAudience("researchers");
  }

  function closeQuote() {
    if (selectedQuote) document.getElementById(`person-${selectedQuote}`)?.focus({ preventScroll: true });
    setSelectedQuote(null);
  }

  const quoteContent = audience === "researchers" && selected && selectedFigure && <article className="air-selected-quote" id={`quote-${selected.id}`} aria-label={`${selectedFigure.name}’s statement`}>
        <div className="air-person-heading">
          <Portrait figure={selectedFigure} />
          <div><h2>{selectedFigure.name}</h2><time dateTime={selected.date ?? undefined}>{dateLabel(selected.date)}</time></div>
          <button className="air-dismiss" type="button" aria-label="Close quote" onClick={closeQuote}>×</button>
        </div>
        <blockquote>“{selected.quote}”</blockquote>
        <div className="air-quote-number"><strong>{estimateLabel(selected.estimate)}</strong><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceTitle} ↗</a></div>
        <div className="air-accuracy-questions">
          {selected.estimate.kind !== "qualitative" && <AccuracyVote key={`number-${selected.id}`} question="Is the number we give an accurate summary of this quote?" tally={feedbackBySlot[`ai-risk:number-accuracy:${selected.id}`]} loading={!feedback} onRate={rating => rate({ voterKey, accessToken, slot: `ai-risk:number-accuracy:${selected.id}`, rating })} />}
          <AccuracyVote key={`quote-${selected.id}`} question="Is the quote accurate?" tally={feedbackBySlot[`ai-risk:quote-accuracy:${selected.id}`]} loading={!feedback} onRate={rating => rate({ voterKey, accessToken, slot: `ai-risk:quote-accuracy:${selected.id}`, rating })} />
        </div>
      </article>;

  return <div className="air-page not-prose">
    <header className="air-intro">
      <p className="air-eyebrow">AI IMPACTS · 2024 EXPERT SURVEY ON PROGRESS IN AI</p>
      <h1>{outcome === "extinction" ? (audience === "researchers" ? "AI researchers’ p(doom)" : "Site viewers’ p(doom)") : question.label}</h1>
      <p className="air-question-description">{question.description}</p>
    </header>

    <section className="air-chart-panel" aria-label="AI risk distribution">
    <div className="air-outcome-panel" aria-label="Choose a survey outcome">
      <label className="air-outcome-select">Outcome
        <select value={outcome} onChange={event => chooseOutcome(event.target.value as OutcomeId)}>
          <optgroup label="Catastrophic risk">{survey.questions.filter(item => item.group === "risk").map(item => <option key={item.id} value={item.id}>{item.shortLabel}</option>)}</optgroup>
          <optgroup label="Long-run impact, assuming human-level AI">{outcomeQuestions.map(item => <option key={item.id} value={item.id}>{item.shortLabel}</option>)}</optgroup>
        </select>
      </label>
      <label className="air-outcome-slider"><span className="sr-only">Slide through outcomes</span><input type="range" min="0" max={survey.questions.length - 1} step="1" value={questionIndex} onChange={event => chooseOutcome(survey.questions[Number(event.target.value)].id)} aria-valuetext={question.shortLabel} /></label>
    </div>

      <div className="air-chart-toolbar">
        <div className="air-segmented" aria-label="Whose answers to display">
          <button type="button" aria-pressed={audience === "researchers"} onClick={() => setAudience("researchers")}>AI researchers <span>{question.n.toLocaleString()}</span></button>
          <button type="button" aria-pressed={audience === "viewers"} onClick={() => { setAudience("viewers"); setSelectedQuote(null); }}>Viewers to this site <span>{viewers?.n ?? "…"}</span></button>
        </div>
        <label className="air-sort-label"><span className="sr-only">Order chart answers</span><select value={descending ? "high" : "low"} onChange={event => setDescending(event.target.value === "high")}><option value="low">Lowest first</option><option value="high">Highest first</option></select></label>
      </div>
      {audience === "viewers" && !summary ? <div className="air-empty-chart" role="status">Loading viewer forecasts…</div> : <DistributionChart values={values} figures={people.figures} quotes={audience === "researchers" ? relatedQuotes : []} selectedQuote={selectedQuote} onSelectQuote={selectQuote} onCloseQuote={closeQuote} quoteContent={quoteContent} descending={descending} audience={audience} mine={mine[outcome]} />}

      {selected?.estimate.kind === "qualitative" && quoteContent}
      <p className="air-chart-source">{audience === "viewers" ? "Answers: Viewers to this site. Question source: " : "Source: "}<a href={survey.sourceUrl} target="_blank" rel="noreferrer">{survey.sourceLabel}</a></p>
    </section>

    <details className="air-statements">
      <summary>All public statements <span>{people.quotes.length}</span></summary>
      <div className="air-quote-controls">
        <label><span className="sr-only">Which public statements</span><select value={showAll ? "all" : "related"} onChange={event => setShowAll(event.target.value === "all")}><option value="related">Related to this outcome</option><option value="all">All outcomes</option></select></label>
        <label><span className="sr-only">Sort public statements</span><select value={quoteSort} onChange={event => setQuoteSort(event.target.value)}><option value="high">Highest estimate first</option><option value="low">Lowest estimate first</option><option value="newest">Newest first</option><option value="useful">Most “Yes” votes</option></select></label>
      </div>
      {quotes.length === 0 && <p className="air-small">No sourced public statements for this outcome yet.</p>}
      <div className="air-statement-list">{quotes.map(quote => {
        const figure = people.figures.find(item => item.id === quote.figureId)!;
        return <button type="button" className="air-statement-row" key={quote.id} aria-pressed={quote.id === selectedQuote} onClick={() => {
          selectQuote(quote.id);
          requestAnimationFrame(() => document.getElementById(`quote-${quote.id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }));
        }}><Portrait figure={figure} /><span>{figure.name}<small>{dateLabel(quote.date)} · {quote.originalOutcome}</small></span><b>{estimateLabel(quote.estimate)}</b></button>;
      })}</div>
    </details>

    <ForecastForm key={question.group === "outcomes" ? "outcomes" : outcome} question={question} outcomeQuestions={outcomeQuestions} mine={mine} voterKey={voterKey} accessToken={accessToken} ready={!!summary} />

    <details className="air-methods"><summary>Data & methods</summary><div className="air-methods-content">
      <h3>The researcher survey</h3>
      <p>Source: <a href={survey.sourceUrl} target="_blank" rel="noreferrer">{survey.sourceLabel}</a>. The three risk questions were randomly assigned and are shown separately. Each chart uses valid answers to its question; denominators vary. The five long-run effects use complete responses that sum to 100% and are conditional on human-level AI eventually existing.</p>
      <p>{question.wordingNote}</p>
      <p>The 100 lines sample observed values at evenly spaced ranks. Hover statistics and public-figure positions use every valid answer. Tied estimates are placed at the middle of the tied group. Portraits are nudged slightly to avoid overlaps. A range or bound connects to its endpoints; no midpoint probability is attributed to the speaker.</p>
      <h3>Public statements</h3>
      <p>Historical statements from 2023–2026 may not reflect current views. They concern related outcomes with different definitions and time horizons; the faces are comparisons, not survey participants. The connector shows where a quoted number falls among the survey answers. Qualitative statements have no numerical marker. Ranges sort by their lower bound.</p>
      <p><a href="https://findingconsensus.ai" target="_blank" rel="noreferrer">Finding Consensus</a> provided quotes and source leads about SB 1047. Policy scores are not treated as probabilities.</p>
      <h3>Viewer forecasts and votes</h3>
      <p>Voluntary viewer responses are stored on the server and totals update live. A random browser token lets you revise your forecasts and votes. These are not verified unique people: another browser or device can count again. Two separate votes ask whether the number summarizes the quote and whether the quote is accurate. These are counted separately from earlier usefulness votes.</p>
      <h3>Portrait credits</h3>
      <ul>{people.figures.map(figure => <li key={figure.id}><a href={figure.portrait.sourceUrl} target="_blank" rel="noreferrer">{figure.name}</a> — {figure.portrait.credit}</li>)}</ul>
    </div></details>
  </div>;
}
