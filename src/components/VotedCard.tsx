import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { chartScore, HIDE_SCORE } from "@/lib/helpfulness";

const HiddenCharts = createContext<{
  target: HTMLDivElement | null;
  register: (slot: string, hidden: boolean) => void;
}>({ target: null, register: () => {} });

export function ChartVisibility({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const register = useCallback((slot: string, hide: boolean) => {
    setHidden((previous) => {
      if (previous.has(slot) === hide) return previous;
      const next = new Set(previous);
      if (hide) next.add(slot);
      else next.delete(slot);
      return next;
    });
  }, []);
  return (
    <HiddenCharts.Provider value={{ target, register }}>
      {children}
      <details
        className="mx-auto my-8 max-w-7xl rounded-lg border border-base-300 p-4"
        hidden={hidden.size === 0}
      >
        <summary className="cursor-pointer text-sm font-medium">
          Hidden by reader votes · {hidden.size}{" "}
          {hidden.size === 1 ? "chart" : "charts"}
        </summary>
        <p className="my-3 text-xs opacity-70">
          Readers rated these less helpful. You can still view them and change
          your vote; items return automatically when rated more helpful.
        </p>
        <div ref={setTarget} className="space-y-6" />
      </details>
    </HiddenCharts.Provider>
  );
}

export function VotedCard({
  slot,
  children,
  className = "",
}: {
  slot: string;
  children: ReactNode;
  className?: string;
}) {
  const votes = useQuery(api.chartVotes.listAll);
  const score = chartScore((votes ?? []).filter((v) => v.slot === slot));
  const hidden = votes !== undefined && score <= HIDE_SCORE;
  const { target, register } = useContext(HiddenCharts);
  useEffect(() => {
    register(slot, hidden);
    return () => register(slot, false);
  }, [slot, hidden, register]);
  const card = (
    <div className={`card min-w-0 bg-base-100 ${className}`}>
      {hidden && (
        <p className="px-4 pt-3 text-xs opacity-70">Hidden by reader votes</p>
      )}
      {children}
    </div>
  );
  return hidden ? (target ? createPortal(card, target, slot) : null) : card;
}
