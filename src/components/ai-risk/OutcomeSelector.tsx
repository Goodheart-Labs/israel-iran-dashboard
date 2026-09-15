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

  return <div className="air-outcome-selector" aria-label="Choose a survey outcome">
    <div className="air-outcome-tabs" aria-label="Question group">
      <button type="button" aria-pressed={isOutcomes} onClick={() => { if (!isOutcomes) onChange("extremely-bad"); }}>Outcomes</button>
      <button type="button" aria-pressed={!isOutcomes} onClick={() => { if (isOutcomes) onChange("extinction"); }}>Extinction risk</button>
    </div>

    {isOutcomes ? <div className="air-outcome-scale">
      <div className="air-outcome-track">
        <div className="air-outcome-ticks" aria-hidden="true">{OUTCOME_STOPS.map((stop, index) => <span key={stop.id} style={{ left: `${index * 25}%` }} />)}</div>
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={selectedStop}
          onChange={event => onChange(OUTCOME_STOPS[Number(event.target.value)].id)}
          aria-label="AI outcome"
          aria-valuetext={OUTCOME_STOPS[selectedStop].label}
        />
        <div className="air-outcome-labels">
          {OUTCOME_STOPS.map((stop, index) => <button
            key={stop.id}
            type="button"
            style={{ "--stop-position": `${index * 25}%` } as CSSProperties}
            aria-pressed={selectedStop === index}
            onClick={() => onChange(stop.id)}
          >{stop.label}</button>)}
        </div>
      </div>
    </div> : <div className="air-outcome-risk-options" aria-label="Extinction risk question">
      {RISK_OPTIONS.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}
    </div>}
  </div>;
}
