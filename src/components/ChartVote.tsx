import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const RATINGS = [
  { value: "useful", label: "Useful" },
  { value: "somewhat_useful", label: "Somewhat" },
  { value: "not_useful", label: "Not useful" },
] as const;

type Rating = (typeof RATINGS)[number]["value"];

/** Random per-browser token; the same one the suggestions panel uses. */
function voterKey(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem("anon-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("anon-id", id);
  return id;
}

/**
 * "Was this chart useful?" — a small Vote button that opens the three options,
 * so the question is findable without competing with the chart.
 */
export function ChartVote({ slot }: { slot: string }) {
  const all = useQuery(api.chartVotes.listAll);
  const castVote = useMutation(api.chartVotes.vote);
  const [open, setOpen] = useState(false);

  const key = voterKey();
  const forSlot = (all ?? []).filter((v) => v.slot === slot);
  const mine = forSlot.find((v) => v.voterKey === key)?.rating;
  const total = forSlot.length;

  const tally = (rating: Rating) =>
    forSlot.filter((v) => v.rating === rating).length;

  if (mine && !open) {
    return (
      <div className="flex justify-end mt-2">
        <button
          className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
          onClick={() => setOpen(true)}
        >
          You found this {RATINGS.find((r) => r.value === mine)?.label.toLowerCase()}
          {total > 1 ? ` · ${total} votes` : ""}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-end mt-2">
        <button className="btn btn-outline btn-xs" onClick={() => setOpen(true)}>
          Vote{total > 0 ? ` (${total})` : ""}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 mt-2">
      <span className="text-xs opacity-50 mr-1">Is this chart useful?</span>
      {RATINGS.map((rating) => (
        <button
          key={rating.value}
          className={`btn btn-xs ${mine === rating.value ? "btn-primary" : "btn-outline"}`}
          onClick={() => {
            void castVote({ slot, rating: rating.value, voterKey: key });
            setOpen(false);
          }}
        >
          {rating.label}
          {tally(rating.value) > 0 && (
            <span className="opacity-60 ml-1">{tally(rating.value)}</span>
          )}
        </button>
      ))}
      <button
        className="btn btn-ghost btn-xs"
        onClick={() => setOpen(false)}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
