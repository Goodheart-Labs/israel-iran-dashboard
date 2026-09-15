import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatProbability } from "@/lib/ai-risk/distribution";
import type { SurveyQuestion } from "@/lib/ai-risk/types";

export function ForecastForm({ question, outcomeQuestions, mine, voterKey, accessToken, ready }: {
  question: SurveyQuestion;
  outcomeQuestions: SurveyQuestion[];
  mine: Record<string, number>;
  voterKey: string;
  accessToken: string;
  ready: boolean;
}) {
  const save = useMutation(api.aiRisk.saveForecasts);
  const clear = useMutation(api.aiRisk.clearForecasts);
  const family = question.group === "outcomes";
  const questions = family ? outcomeQuestions : [question];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!dirty) setDraft(Object.fromEntries(questions.map(item => [item.id, mine[item.id] === undefined ? "" : String(mine[item.id])])));
  // The form is keyed by question/family; preserve edits when live totals refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, dirty]);
  const total = Math.round(questions.reduce((sum, item) => sum + (Number(draft[item.id]) || 0), 0) * 10) / 10;
  const filled = questions.every(item => draft[item.id] !== undefined && draft[item.id] !== "" && Number.isFinite(Number(draft[item.id])) && Number(draft[item.id]) >= 0 && Number(draft[item.id]) <= 100 && Math.abs(Number(draft[item.id]) * 10 - Math.round(Number(draft[item.id]) * 10)) < 1e-7);
  const valid = filled && (!family || total === 100);
  function update(id: string, value: string) { setDraft(current => ({ ...current, [id]: value })); setDirty(true); setMessage(""); setError(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setPending(true); setError(""); setMessage("");
    try {
      await save({ voterKey, accessToken, values: questions.map(item => ({ outcomeId: item.id, value: Number(draft[item.id]) })) });
      setDirty(false);
      setMessage("Saved.");
    } catch { setError("Your forecast wasn’t saved. Check your connection and try again."); }
    finally { setPending(false); }
  }
  async function remove() {
    setPending(true); setError("");
    try { await clear({ voterKey, accessToken }); setDirty(false); setDraft({}); setMessage("Forecasts removed."); }
    catch { setError("Your forecasts couldn’t be removed. Please try again."); }
    finally { setPending(false); }
  }
  const hasAnswers = Object.keys(mine).length > 0;
  return <section id="your-forecast" className="air-forecast">
    <div className="air-forecast-intro"><h2>Your forecast</h2><p>Added to “Viewers to this site”.</p></div>
    <form onSubmit={event => void submit(event)} className="air-forecast-form">
      <p className="air-form-question">{family ? "If human-level AI is eventually developed, how likely is each long-run effect on humanity?" : question.description}</p>
      {questions.map(item => <div key={item.id} className="air-probability-input">
        <label htmlFor={`forecast-${item.id}`}>{family ? item.shortLabel : "Your estimated chance"}</label>
        <div className="air-input-row"><input type="range" min="0" max="100" step="0.1" disabled={pending} value={Number(draft[item.id]) || 0} onChange={event => update(item.id, event.target.value)} aria-label={`${item.shortLabel} chance slider`} aria-valuetext={draft[item.id] ? formatProbability(Number(draft[item.id])) : "Not answered"} /><span className="air-number-field"><input id={`forecast-${item.id}`} type="number" min="0" max="100" step="0.1" inputMode="decimal" required disabled={pending} placeholder="—" value={draft[item.id] ?? ""} onChange={event => update(item.id, event.target.value)} /><span>%</span></span></div>
      </div>)}
      {family && <div className={`air-total ${total === 100 ? "is-complete" : ""}`} role="status"><span>Total</span><b>{total}% / 100%</b></div>}
      {family && <p className="air-small">Allocate 100% across these five possible outcomes.</p>}
      <div className="air-form-actions"><button type="submit" className="air-primary-button" disabled={!valid || pending || !ready}>{pending ? "Saving…" : questions.some(item => mine[item.id] !== undefined) ? "Update my forecast" : "Add my forecast"}<span aria-hidden="true">↗</span></button>{hasAnswers && <button type="button" className="air-clear-button" disabled={pending || !ready} onClick={() => void remove()}>Remove my forecasts</button>}</div>
      {!ready && <p className="air-small" role="status">Connecting…</p>}
      {message && <p className="air-success" role="status">{message}</p>}
      {error && <p className="air-error" role="alert">{error}</p>}
    </form>
  </section>;
}
