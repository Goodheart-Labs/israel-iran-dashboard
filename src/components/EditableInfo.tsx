import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * An explanation anyone can rewrite, with history and revert.
 *
 * `slot` identifies the text (e.g. "ipo:central-chart"); `children` is what
 * the site shipped with, shown until someone edits it. Edits append to
 * textRevisions rather than overwriting, so nothing is lost and a revert is
 * just another revision.
 */
export function EditableInfo({
  slot,
  children,
  trailing,
}: {
  slot: string;
  children: string;
  /** Rendered straight after the text — e.g. footnote markers. */
  trailing?: ReactNode;
}) {
  const revisions = useQuery(api.caveats.listRevisions, { slot });
  const [open, setOpen] = useState(false);

  const current = revisions?.[0]?.content ?? children;

  return (
    <p className="text-xs opacity-50 leading-relaxed mb-3">
      {current}
      {trailing}{" "}
      <button
        className="link link-hover opacity-70 hover:opacity-100 inline-flex items-center gap-0.5 align-baseline"
        onClick={() => setOpen(true)}
        title="Edit this explanation"
      >
        <Pencil className="w-3 h-3" />
        edit
      </button>
      {open && (
        <InfoDialog
          slot={slot}
          original={children}
          current={current}
          onClose={() => setOpen(false)}
        />
      )}
    </p>
  );
}

function InfoDialog({
  slot,
  original,
  current,
  onClose,
}: {
  slot: string;
  original: string;
  current: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const revisions = useQuery(api.caveats.listRevisions, { slot });
  const addRevision = useMutation(api.caveats.addRevision);

  const [mode, setMode] = useState<"edit" | "history">("edit");
  const [draft, setDraft] = useState(current);
  const [editor, setEditor] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const save = async (content: string, revertedFrom?: Id<"textRevisions">) => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await addRevision({
        slot,
        content,
        editor: editor || undefined,
        revertedFrom,
      });
      setMode("edit");
    } finally {
      setBusy(false);
    }
  };

  const history = [
    ...(revisions ?? []),
    {
      _id: "original" as unknown as Id<"textRevisions">,
      content: original,
      editor: undefined,
      createdAt: 0,
      revertedFrom: undefined,
    },
  ];

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box max-w-2xl text-left">
        <h3 className="font-bold text-base mb-1">Edit this explanation</h3>
        <p className="text-xs opacity-50 mb-4">
          Anyone can rewrite this. Every version is kept and can be restored.
        </p>

        <div role="tablist" className="tabs tabs-border mb-3">
          <button
            role="tab"
            className={`tab ${mode === "edit" ? "tab-active" : ""}`}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            role="tab"
            className={`tab ${mode === "history" ? "tab-active" : ""}`}
            onClick={() => setMode("history")}
          >
            History{revisions?.length ? ` (${revisions.length})` : ""}
          </button>
        </div>

        {mode === "edit" ? (
          <div className="space-y-2">
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={5}
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
                disabled={busy || !draft.trim() || draft === current}
                onClick={() => void save(draft)}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <ul className="space-y-3 max-h-72 overflow-y-auto">
            {history.map((revision, index) => (
              <li key={String(revision._id)} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="opacity-50">
                    {revision.createdAt
                      ? new Date(revision.createdAt).toLocaleString()
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
                            : (revision._id as Id<"textRevisions">),
                        )
                      }
                    >
                      Restore
                    </button>
                  )}
                </div>
                <p className="opacity-70 mt-0.5">{revision.content}</p>
              </li>
            ))}
          </ul>
        )}

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
