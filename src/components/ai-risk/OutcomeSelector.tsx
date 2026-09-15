import type { CSSProperties } from "react";
import type { OutcomeId } from "@/lib/ai-risk/types";
import { OUTCOME_STOPS } from "./outcome-options";
import "./outcome-selector.css";

const RISK_OPTIONS = [
  { id: "extinction", label: "Extinction / disempowerment" },
  { id: "extinction-century", label: "Within 100 years" },
  { id: "loss-of-control", label: "From loss of control" },
] as const;

interface Props {
  value: OutcomeId;
  onChange: (value: OutcomeId) => void;
}

export function OutcomeSelector({ value, onChange }: Props) {
  const selectedStop = OUTCOME_STOPS.findIndex(stop => stop.id === value);
  const isOutcomes = selectedStop !== -1;
  const stops = isOutcomes ? OUTCOME_STOPS : RISK_OPTIONS;
  const selectedIndex = stops.findIndex(stop => stop.id === value);
  const position = (index: number) => `${index / (stops.length - 1) * 100}%`;

  return <div className="air-outcome-selector" aria-label="Choose a survey outcome">
    <div className="air-outcome-tabs" aria-label="Question group">
      <button type="button" aria-pressed={isOutcomes} onClick={() => { if (!isOutcomes) onChange("extremely-bad"); }}>Outcomes</button>
      <button type="button" aria-pressed={!isOutcomes} onClick={() => { if (isOutcomes) onChange("extinction"); }}>Extinction risk</button>
    </div>

    <div className={`air-outcome-scale${isOutcomes ? "" : " is-risk"}`}>
      <div className="air-outcome-track">
        <div className="air-outcome-ticks" aria-hidden="true">{stops.map((stop, index) => <span key={stop.id} style={{ left: position(index) }} />)}</div>
        <input
          type="range"
          min="0"
          max={stops.length - 1}
          step="1"
          value={selectedIndex}
          onChange={event => onChange(stops[Number(event.target.value)].id)}
          aria-label={isOutcomes ? "AI outcome" : "Extinction risk question"}
          aria-valuetext={stops[selectedIndex].label}
        />
        <div className="air-outcome-labels">
          {stops.map((stop, index) => <button
            key={stop.id}
            type="button"
            style={{ "--stop-position": position(index) } as CSSProperties}
            aria-pressed={selectedIndex === index}
            onClick={() => onChange(stop.id)}
          >{stop.label}</button>)}
        </div>
      </div>
    </div>
  </div>;
}
