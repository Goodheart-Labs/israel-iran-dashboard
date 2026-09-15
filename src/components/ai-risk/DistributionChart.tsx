import { useEffect, useMemo, useRef, useState } from "react";
import { formatProbability, percentileAt, representativeValues } from "@/lib/ai-risk/distribution";
import { estimateBounds, estimateLabel } from "@/lib/ai-risk/public-estimates";
import type { ProbabilityCount, PublicFigure, PublicQuote } from "@/lib/ai-risk/types";

export function DistributionChart({ values, figures, quotes, selectedQuote, onSelectQuote, descending, audience, mine }: {
  values: ProbabilityCount[];
  figures: PublicFigure[];
  quotes: PublicQuote[];
  selectedQuote: string | null;
  onSelectQuote: (id: string) => void;
  descending: boolean;
  audience: "researchers" | "viewers";
  mine?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(950);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(270, entries[0].contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const n = values.reduce((sum, item) => sum + item.count, 0);
  const lines = useMemo(() => {
    const result = representativeValues(values, Math.min(100, n));
    return descending ? result.reverse() : result;
  }, [values, descending, n]);
  useEffect(() => setHovered(null), [values, descending]);
  const left = 42;
  const right = width - 24;
  const plotWidth = right - left;
  const xAtPercentile = (p: number) => left + (descending ? 100 - p : p) / 100 * plotWidth;
  const numericQuotes = quotes.filter(quote => estimateBounds(quote.estimate));
  const mobile = width < 600;
  const selected = numericQuotes.find(quote => quote.id === selectedQuote);
  // All statements remain selectable below; on a narrow screen the selected face gets the space.
  const visibleQuotes = mobile ? (selected ? [selected] : numericQuotes.slice(0, 1)) : numericQuotes;
  const orderedQuotes = [...visibleQuotes].sort((a, b) => {
    const aBounds = estimateBounds(a.estimate)!;
    const bBounds = estimateBounds(b.estimate)!;
    return (aBounds[0] + aBounds[1] - bBounds[0] - bBounds[1]) * (descending ? -1 : 1);
  });
  const laneCount = Math.max(1, Math.ceil(orderedQuotes.length / Math.max(1, Math.floor(plotWidth / 78))));
  const columns = Math.ceil(orderedQuotes.length / laneCount);
  const markers = orderedQuotes.map((quote, i) => {
    const bounds = estimateBounds(quote.estimate)!;
    const rankLow = percentileAt(values, bounds[0]).midpoint;
    const rankHigh = percentileAt(values, bounds[1]).midpoint;
    const center = mobile
      ? Math.max(left + 20, Math.min(right - 20, xAtPercentile((rankLow + rankHigh) / 2)))
      : left + (Math.floor(i / laneCount) + 0.5) / columns * plotWidth;
    const lane = i % laneCount;
    return { quote, bounds, rankLow, rankHigh, center, lane, figure: figures.find(figure => figure.id === quote.figureId)! };
  });
  const plotTop = markers.length ? 36 + laneCount * 69 : 32;
  const plotBottom = plotTop + (mobile ? 220 : 270);
  const height = plotBottom + 49;
  const yAt = (value: number) => plotBottom - value / 100 * (plotBottom - plotTop);
  const index = hovered === null ? Math.floor((lines.length - 1) / 2) : Math.min(hovered, lines.length - 1);
  const activeValue = lines[index];
  const activeRank = activeValue === undefined ? null : percentileAt(values, activeValue);
  const activeX = left + (index + 0.5) / Math.max(1, lines.length) * plotWidth;
  function inspect(clientX: number, rect: DOMRect) {
    const x = (clientX - rect.left) / rect.width * width;
    setHovered(Math.max(0, Math.min(lines.length - 1, Math.floor((x - left) / plotWidth * lines.length))));
  }
  return <div ref={container} className="air-distribution">
    {n === 0 ? <div className="air-empty-chart"><span className="air-empty-mark">↗</span><h3>The first forecast could be yours.</h3><p>No viewers have answered this question yet. Add your estimate below to start this distribution.</p><a href="#your-forecast" className="air-text-link">Add your forecast ↓</a></div> : <>
      <div className="air-chart-readout" aria-live="polite">
        <strong>{formatProbability(activeValue)}</strong>
        <span>an answer at this position <span className="air-readout-detail">· {Math.round(activeRank?.below ?? 0)}% of {audience} gave a lower estimate</span></span>
      </div>
      <svg className="air-chart-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Risk estimates from ${n} ${audience}, ordered ${descending ? "highest to lowest" : "lowest to highest"}. Use the slider below to inspect the answers.`}>
        <defs>{markers.map(({ quote }) => <clipPath key={quote.id} id={`face-${quote.id}`}><circle r="19" /></clipPath>)}</defs>
        {[0, 25, 50, 75, 100].map(value => <g key={value}>
          <line x1={left} x2={right} y1={yAt(value)} y2={yAt(value)} stroke="#d8dfd6" strokeDasharray={value === 0 ? undefined : "2 5"} />
          <text x={left - 10} y={yAt(value) + 4} textAnchor="end" fill="#62766b" fontSize="11">{value}%</text>
        </g>)}
        {lines.map((value, i) => {
          const x = left + (i + 0.5) / lines.length * plotWidth;
          return <line key={i} x1={x} x2={x} y1={plotBottom} y2={yAt(value) - (value === 0 ? 2 : 0)} stroke={i === index ? "#173e31" : audience === "viewers" ? "#b47b2f" : "#2f8a65"} strokeWidth={Math.max(1.6, Math.min(3.7, plotWidth / lines.length * 0.48))} strokeLinecap="round" opacity={i === index ? 1 : 0.72} />;
        })}
        {mine !== undefined && <g aria-label={`Your estimate: ${formatProbability(mine)}`}>
          <circle cx={xAtPercentile(percentileAt(values, mine).midpoint)} cy={yAt(mine)} r="7" fill="#deac48" stroke="#fffdf5" strokeWidth="2" />
          <text x={Math.min(right - 28, xAtPercentile(percentileAt(values, mine).midpoint))} y={yAt(mine) - 13} fontSize="11" fill="#6f4d15">YOU</text>
        </g>}
        <circle cx={activeX} cy={yAt(activeValue)} r="4.5" fill="#173e31" stroke="#fffdf5" strokeWidth="2" />
        {markers.map(({ quote, bounds, rankLow, rankHigh, center, lane, figure }) => {
          const active = quote.id === selectedQuote;
          const cy = 25 + lane * 69;
          const color = active ? "#d07a38" : "#61776a";
          const isPoint = quote.estimate.kind === "point";
          const targetX = xAtPercentile(rankLow);
          const targetY = yAt(bounds[0]);
          const otherX = xAtPercentile(rankHigh);
          const otherY = yAt(bounds[1]);
          const label = `${figure.name}: ${estimateLabel(quote.estimate)}. ${quote.originalOutcome}. Select to read the source.`;
          return <g key={quote.id} className={`air-chart-marker ${active ? "is-selected" : ""}`} role="button" tabIndex={0} aria-label={label} aria-pressed={active}
            onClick={() => onSelectQuote(quote.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectQuote(quote.id); } }}>
            <title>{label}</title>
            <path d={`M ${center} ${cy + 31} C ${center} ${plotTop - 10}, ${targetX} ${plotTop - 10}, ${targetX} ${targetY}`} stroke={color} strokeWidth={active ? 2 : 1} fill="none" opacity={active ? 0.85 : 0.45} strokeDasharray={isPoint ? undefined : "4 3"} />
            {!isPoint && <><path d={`M ${center} ${cy + 31} C ${center} ${plotTop - 10}, ${otherX} ${plotTop - 10}, ${otherX} ${otherY}`} stroke={color} strokeWidth="1.4" fill="none" strokeDasharray="4 3" /><line x1={targetX} y1={targetY} x2={otherX} y2={otherY} stroke={color} strokeWidth="5" opacity="0.35" /><circle cx={otherX} cy={otherY} r="4" fill="#f5f1e8" stroke={color} strokeWidth="2" /></>}
            <circle cx={targetX} cy={targetY} r={active ? 6 : 4} fill={isPoint ? color : "#f5f1e8"} stroke="#f5f1e8" strokeWidth="1.5" />
            <g transform={`translate(${center}, ${cy})`}>
              <circle r="22" fill="#f5f1e8" stroke={color} strokeWidth={active ? 3 : 1} />
              <text y="4" textAnchor="middle" fontSize="12" fill="#173e31">{figure.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</text>
              {figure.portrait.src && <image href={figure.portrait.src} x="-19" y="-19" width="38" height="38" preserveAspectRatio="xMidYMid slice" clipPath={`url(#face-${quote.id})`} />}
              <rect x="-27" y="15" width="54" height="19" rx="9" fill={active ? "#d07a38" : "#f5f1e8"} stroke={color} strokeWidth="0.5" />
              <text y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill={active ? "white" : "#173e31"}>{estimateLabel(quote.estimate)}</text>
              <text y="47" textAnchor="middle" fontSize="10" fill="#405c4a">{figure.name.split(" ").slice(-1)[0]}</text>
            </g>
          </g>;
        })}
        <rect x={left} y={plotTop} width={plotWidth} height={plotBottom - plotTop + 10} fill="transparent" className="air-chart-hitarea" onPointerMove={event => inspect(event.clientX, event.currentTarget.ownerSVGElement!.getBoundingClientRect())} onPointerDown={event => inspect(event.clientX, event.currentTarget.ownerSVGElement!.getBoundingClientRect())} />
        <text x={left} y={plotBottom + 28} fill="#62766b" fontSize="11">{descending ? "Highest" : "Lowest"} estimate</text>
        <text x={right} y={plotBottom + 28} fill="#62766b" fontSize="11" textAnchor="end">{descending ? "Lowest" : "Highest"} estimate</text>
      </svg>
      <label className="air-inspect"><span>Slide to inspect answers</span><input type="range" min="0" max={Math.max(0, lines.length - 1)} value={index} onChange={event => setHovered(Number(event.target.value))} aria-label={`Inspect ${audience}' answers`} aria-valuetext={`${formatProbability(activeValue)}, ${Math.round(activeRank?.below ?? 0)} percent gave a lower estimate`} /></label>
      <p className="air-chart-note">{n > 100 ? "100 representative answers, sampled evenly through the full ranked distribution." : `One line per answer · ${n} answer${n === 1 ? "" : "s"}.`} Line height is the chance given. {mobile && numericQuotes.length > 1 ? "Select a statement below to change the face shown." : markers.length > 0 ? "Select a face to read the quote. Dashed connectors mark ranges or bounds." : ""}</p>
    </>}
  </div>;
}
