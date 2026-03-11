import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ThumbsUp, Flag, Send } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

async function getIpHash(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const { ip } = (await res.json()) as { ip: string };
    const encoder = new TextEncoder();
    const data = encoder.encode(ip + "iran-dashboard-salt");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback: random persistent ID stored in localStorage
    const stored = localStorage.getItem("anon-id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("anon-id", id);
    return id;
  }
}

export function SuggestionsPanel() {
  const suggestions = useQuery(api.suggestions.listActive) ?? [];
  const submitMutation = useMutation(api.suggestions.submit);
  const upvoteMutation = useMutation(api.suggestions.upvote);
  const flagMutation = useMutation(api.suggestions.flag);

  const [ipHash, setIpHash] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [myUpvotes, setMyUpvotes] = useState<Set<string>>(new Set());
  const [myFlags, setMyFlags] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getIpHash().then(setIpHash);
  }, []);

  // Sort by upvotes descending
  const sorted = [...suggestions].sort((a, b) => b.upvotes - a.upvotes);

  const handleSubmit = useCallback(async () => {
    if (!ipHash || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMutation({ text, ipHash });
      setText("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }, [ipHash, text, submitMutation]);

  const handleUpvote = useCallback(
    async (id: Id<"suggestions">) => {
      if (!ipHash) return;
      // Optimistic toggle
      setMyUpvotes((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      await upvoteMutation({ suggestionId: id, ipHash });
    },
    [ipHash, upvoteMutation]
  );

  const handleFlag = useCallback(
    async (id: Id<"suggestions">) => {
      if (!ipHash) return;
      if (myFlags.has(id)) return; // already flagged
      setMyFlags((prev) => new Set(prev).add(id));
      await flagMutation({ suggestionId: id, ipHash });
    },
    [ipHash, myFlags, flagMutation]
  );

  return (
    <div className="mt-12 border-t border-base-300 pt-10">
      <h2 className="text-xl font-bold mb-1">Suggest a market</h2>
      <p className="text-sm opacity-50 mb-6">
        What question should be on this dashboard? Suggest it below — top suggestions may get added.
      </p>

      {/* Submit form */}
      <div className="flex gap-2 mb-8 not-prose">
        <input
          type="text"
          className="input input-bordered flex-1 text-sm"
          placeholder="e.g. Will Iran conduct a nuclear test before 2027?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void handleSubmit()}
          disabled={submitting || !text.trim() || !ipHash}
        >
          <Send className="w-4 h-4" />
          Submit
        </button>
      </div>

      {error && <p className="text-error text-sm mb-4">{error}</p>}
      {success && <p className="text-success text-sm mb-4">Suggestion submitted — thanks!</p>}

      {/* Suggestions list */}
      {sorted.length === 0 ? (
        <p className="text-sm opacity-40 italic">No suggestions yet. Be the first!</p>
      ) : (
        <ul className="space-y-3 not-prose">
          {sorted.map((s) => {
            const voted = myUpvotes.has(s._id);
            const flagged = myFlags.has(s._id);
            return (
              <li
                key={s._id}
                className="flex items-start gap-3 p-3 rounded-lg bg-base-200"
              >
                {/* Upvote */}
                <button
                  className={`btn btn-sm btn-ghost flex-col gap-0 min-w-[3rem] ${voted ? "text-primary" : "opacity-60"}`}
                  onClick={() => void handleUpvote(s._id)}
                  title="Upvote"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-xs font-bold">{s.upvotes}</span>
                </button>

                {/* Text */}
                <p className="flex-1 text-sm pt-1">{s.text}</p>

                {/* Flag */}
                <button
                  className={`btn btn-sm btn-ghost opacity-30 hover:opacity-60 hover:text-error ${flagged ? "text-error opacity-60" : ""}`}
                  onClick={() => void handleFlag(s._id)}
                  title={flagged ? "Already flagged" : "Flag as inappropriate"}
                  disabled={flagged}
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
