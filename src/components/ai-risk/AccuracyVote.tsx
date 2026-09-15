import { useState } from "react";
import type { UsefulnessRating, UsefulnessTally } from "@/lib/ai-risk/types";

// The existing three-value storage format is scoped to new number-accuracy and quote-accuracy slots.
// No earlier usefulness votes are reinterpreted as accuracy votes.
const ratings: { id: UsefulnessRating; label: string }[] = [
  { id: "useful", label: "Yes" },
  { id: "somewhat_useful", label: "Somewhat" },
  { id: "not_useful", label: "No" },
];

export function AccuracyVote({ tally, onRate, question, loading = false }: {
  tally?: UsefulnessTally;
  onRate: (rating: UsefulnessRating) => Promise<unknown>;
  question: string;
  loading?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const total = (tally?.useful ?? 0) + (tally?.somewhat_useful ?? 0) + (tally?.not_useful ?? 0);
  async function vote(rating: UsefulnessRating) {
    setPending(true);
    setError("");
    try { await onRate(rating); }
    catch { setError("Your vote wasn’t saved. Please try again."); }
    finally { setPending(false); }
  }
  return <div className="air-feedback" role="group" aria-label={question}>
    <div className="air-feedback-heading"><span>{question}</span><span>{loading ? "Connecting…" : `${total} vote${total === 1 ? "" : "s"}`}</span></div>
    <div className="air-vote-options">
      {ratings.map(({ id, label: ratingLabel }) => <button key={id} type="button"
        aria-pressed={tally?.mine === id} disabled={pending || loading}
        className={`air-vote air-vote-${id}`} onClick={() => void vote(id)}>
        <span className="air-vote-fill" style={{ width: `${total ? (tally?.[id] ?? 0) / total * 100 : 0}%` }} />
        <span>{tally?.mine === id ? "✓ " : ""}{ratingLabel}</span><b>{tally?.[id] ?? 0}</b>
      </button>)}
    </div>
    {error && <p role="alert" className="air-error">{error}</p>}
  </div>;
}
