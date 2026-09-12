import { type ReactNode, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { chartScore, HIDE_SCORE } from "@/lib/helpfulness";

// Spilled-Ink-style usefulness voting on individual items (a quote, a source):
// three inline chips, one vote per browser, items ordered by net score and the
// strongly down-voted ones tucked away. Reuses the chart-vote table and slots.

const RATINGS = [
  { value: "useful", label: "Useful" },
  { value: "somewhat_useful", label: "Somewhat useful" },
  { value: "not_useful", label: "Not useful" },
] as const;

type Rating = (typeof RATINGS)[number]["value"];
type Vote = { slot: string; rating: string; voterKey: string };

function voterKey(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem("anon-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("anon-id", id);
  return id;
}

export function ItemVote({ slot, votes }: { slot: string; votes: Vote[] }) {
  const castVote = useMutation(api.chartVotes.vote);
  const [open, setOpen] = useState(false);
  const key = voterKey();
  const forSlot = votes.filter((v) => v.slot === slot);
  const mine = forSlot.find((v) => v.voterKey === key)?.rating as Rating | undefined;
  const total = forSlot.length;
  const score = chartScore(forSlot);
  const tally = (r: Rating) => forSlot.filter((v) => v.rating === r).length;
  const chip = "btn btn-xs h-5 min-h-0 px-1.5 text-[10px] leading-none max-sm:h-8 max-sm:px-2";

  if (!open) {
    return (
      <span className="inline-flex items-center ml-2 align-middle not-prose">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${chip} ${mine ? "btn-ghost opacity-60 hover:opacity-100" : "btn-ghost border border-base-300 bg-base-200 opacity-45 hover:opacity-80"}`}
        >
          {mine
            ? `You found this ${RATINGS.find((r) => r.value === mine)?.label.toLowerCase()}${total > 1 ? ` · ${total} votes` : ""}`
            : `Vote${total > 0 ? ` (${total})` : ""}`}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 ml-2 align-middle not-prose">
      <span className="text-[10px] opacity-60">Useful?</span>
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => { void castVote({ slot, rating: r.value, voterKey: key }); setOpen(false); }}
          className={`${chip} ${mine === r.value ? "btn-primary" : "btn-outline"}`}
          aria-pressed={mine === r.value}
        >
          {r.label}
          {tally(r.value) > 0 && <span className="opacity-60 ml-1">{tally(r.value)}</span>}
        </button>
      ))}
      {total > 0 && (
        <span className="text-[10px] opacity-50" title="net usefulness: useful +1, somewhat +½, not useful −1">
          {score > 0 ? `+${score}` : score}
        </span>
      )}
      <button type="button" className={`${chip} btn-ghost`} onClick={() => setOpen(false)} aria-label="Close">×</button>
    </span>
  );
}

/** Renders items ordered by net usefulness; those at or below HIDE_SCORE fold away. */
export function VotableList<T>({
  items,
  slotFor,
  render,
  className,
  itemClassName,
}: {
  items: T[];
  slotFor: (item: T) => string;
  render: (item: T) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const votes = useQuery(api.chartVotes.listAll) ?? [];
  const [showHidden, setShowHidden] = useState(false);
  const scored = items.map((item, i) => {
    const slot = slotFor(item);
    return { item, slot, i, score: chartScore(votes.filter((v) => v.slot === slot)) };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const shown = scored.filter((s) => s.score > HIDE_SCORE);
  const hidden = scored.filter((s) => s.score <= HIDE_SCORE);
  const row = (s: (typeof scored)[number]) => (
    <li key={s.slot} className={itemClassName}>
      {render(s.item)}
      <ItemVote slot={s.slot} votes={votes} />
    </li>
  );
  return (
    <>
      <ul className={className}>{(showHidden ? scored : shown).map(row)}</ul>
      {hidden.length > 0 && (
        <button type="button" className="btn btn-ghost btn-xs opacity-50 mt-1" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? "Hide" : "Show"} {hidden.length} {hidden.length === 1 ? "item" : "items"} readers found unhelpful
        </button>
      )}
    </>
  );
}
