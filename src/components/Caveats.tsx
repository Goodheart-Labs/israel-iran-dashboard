import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const RATINGS = [
  { value: "helpful", label: "Helpful" },
  { value: "somewhat_helpful", label: "Somewhat helpful" },
  { value: "not_helpful", label: "Not helpful" },
] as const;

type Rating = (typeof RATINGS)[number]["value"];

/** Random per-browser token, so one reader can't stuff the ballot. */
function voterKey(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem("anon-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("anon-id", id);
  return id;
}

type Caveat = {
  _id: Id<"caveats">;
  content: string;
  originalContent: string;
  author?: string;
  editedBy?: string;
  revisionCount: number;
  tally: Record<Rating, number>;
  voters: Array<{ voterKey: string; rating: Rating }>;
};

export function Caveats({ topic }: { topic: string }) {
  const caveats = useQuery(api.caveats.listForTopic, { topic });
  const addCaveat = useMutation(api.caveats.addCaveat);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Caveat | null>(null);

  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await addCaveat({ topic, content: draft });
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <h3 className="card-title text-lg mb-1">Notes &amp; caveats</h3>
        <p className="text-xs opacity-50 mb-4">
          Anyone can add a caveat, vote on how helpful it is, or rewrite one.
          Edits keep a full history and can be reverted.
        </p>

        {caveats === undefined ? (
          <p className="text-sm opacity-50">Loading…</p>
        ) : (
          <ul className="space-y-4">
            {(caveats as Caveat[]).map((caveat) => {
              const total =
                caveat.tally.helpful +
                caveat.tally.somewhat_helpful +
                caveat.tally.not_helpful;
              return (
                <li
                  key={caveat._id}
                  className="border-l-2 border-base-300 pl-4"
                >
                  <p className="text-sm opacity-80">{caveat.content}</p>
                  <div className="flex justify-end mt-1">
                    <button
                      className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                      onClick={() => setOpen(caveat)}
                    >
                      {total > 0
                        ? `${total} vote${total === 1 ? "" : "s"} · rate or edit`
                        : "Rate or edit"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 pt-4 border-t border-base-300">
          <label className="text-sm font-medium block mb-2">
            Add a caveat
          </label>
          <textarea
            className="textarea textarea-bordered w-full text-sm"
            rows={3}
            maxLength={600}
            placeholder="What should a reader know before trusting these numbers?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button
              className="btn btn-primary btn-sm"
              disabled={!draft.trim() || busy}
              onClick={() => void submit()}
            >
              {busy ? "Adding…" : "Add caveat"}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <CaveatDialog caveat={open} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function CaveatDialog({
  caveat,
  onClose,
}: {
  caveat: Caveat;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const slot = `caveat:${caveat._id}`;
  const revisions = useQuery(api.caveats.listRevisions, { slot });
  const vote = useMutation(api.caveats.voteCaveat);
  const addRevision = useMutation(api.caveats.addRevision);

  const [mode, setMode] = useState<"view" | "edit" | "history">("view");
  const [draft, setDraft] = useState(caveat.content);
  const [editor, setEditor] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const key = voterKey();
  const mine = caveat.voters.find((v) => v.voterKey === key)?.rating;

  const save = async (content: string, revertedFrom?: Id<"textRevisions">) => {
    setBusy(true);
    try {
      await addRevision({
        slot,
        content,
        editor: editor || undefined,
        revertedFrom,
      });
      setMode("view");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-base mb-3">Caveat</h3>

        <p className="text-sm opacity-80 mb-4">{caveat.content}</p>

        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Is this caveat helpful?</p>
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating.value}
                className={`btn btn-sm ${mine === rating.value ? "btn-primary" : "btn-outline"}`}
                onClick={() =>
                  void vote({
                    caveatId: caveat._id,
                    rating: rating.value,
                    voterKey: key,
                  })
                }
              >
                {rating.label}
                {caveat.tally[rating.value] > 0 && (
                  <span className="opacity-60 ml-1">
                    {caveat.tally[rating.value]}
                  </span>
                )}
              </button>
            ))}
          </div>
          {mine && (
            <p className="text-xs opacity-50 mt-2">
              You voted &ldquo;
              {RATINGS.find((r) => r.value === mine)?.label}&rdquo; — click
              another to change it.
            </p>
          )}
        </div>

        <div className="border-t border-base-300 pt-4">
          {mode === "view" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setDraft(caveat.content);
                  setMode("edit");
                }}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setMode("history")}
              >
                History
                {caveat.revisionCount > 0 && ` (${caveat.revisionCount})`}
              </button>
              {caveat.editedBy && (
                <span className="text-xs opacity-50">
                  last edited by {caveat.editedBy}
                </span>
              )}
            </div>
          )}

          {mode === "edit" && (
            <div className="space-y-2">
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                rows={4}
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <input
                  className="input input-bordered input-sm flex-1 text-sm"
                  placeholder="Your name (optional)"
                  maxLength={60}
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy || !draft.trim()}
                  onClick={() => void save(draft)}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMode("view")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mode === "history" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Edit history</p>
              <ul className="space-y-3 max-h-64 overflow-y-auto">
                {[
                  ...(revisions ?? []),
                  {
                    _id: "original" as unknown as Id<"textRevisions">,
                    content: caveat.originalContent,
                    editor: caveat.author,
                    createdAt: 0,
                    revertedFrom: undefined,
                  },
                ].map((revision, index) => (
                  <li key={String(revision._id)} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="opacity-50">
                        {revision.createdAt
                          ? new Date(revision.createdAt).toLocaleDateString()
                          : "original"}
                        {revision.editor ? ` · ${revision.editor}` : ""}
                        {revision.revertedFrom ? " · revert" : ""}
                        {index === 0 ? " · current" : ""}
                      </span>
                      {index > 0 && (
                        <button
                          className="btn btn-ghost btn-xs"
                          disabled={busy}
                          onClick={() =>
                            void save(
                              revision.content,
                              String(revision._id) === "original"
                                ? undefined
                                : (revision._id as Id<"textRevisions">)
                            )
                          }
                        >
                          Revert
                        </button>
                      )}
                    </div>
                    <p className="opacity-70 mt-0.5">{revision.content}</p>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setMode("view")}
              >
                Back
              </button>
            </div>
          )}
        </div>

        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-sm">Close</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
