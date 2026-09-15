import { useEffect, useMemo, useRef, useState } from "react";
import { formatProbability, percentileAt, representativeValues } from "@/lib/ai-risk/distribution";
import { estimateBounds, estimateLabel } from "@/lib/ai-risk/public-estimates";
import { packPortraits } from "@/lib/ai-risk/portrait-layout";
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
  const left = 40;
  const right = width - 24;
  const plotWidth = right - left;
  const xAtPercentile = (p: number) => left + (descending ? 100 - p : p) / 100 * plotWidth;
  const radius = 22;
  const numericQuotes = quotes.filter(quote => estimateBounds(quote.estimate));
  const anchors = numericQuotes.map(quote => {
    const bounds = estimateBounds(quote.estimate)!;
    const rankLow = percentileAt(values, bounds[0]).midpoint;
    const rankHigh = percentileAt(values, bounds[1]).midpoint;
    return { id: quote.id, x: xAtPercentile((rankLow + rankHigh) / 2), quote, bounds, rankLow, rankHigh, figure: figures.find(figure => figure.id === quote.figureId)! };
  });
  const packed = packPortraits(anchors, { minX: left, maxX: right, radius });
  const clusterHeight = packed.length ? Math.max(...packed.map(item => item.rise)) + radius * 2 : 0;
  const markers = anchors.map(anchor => {
    const point = packed.find(item => item.id === anchor.id)!;
    return { ...anchor, center: point.x, cy: 8 + clusterHeight - radius - point.rise };
  });
  const plotTop = clusterHeight + 34;
  const plotBottom = plotTop + (width < 600 ? 220 : 270);
  const height = plotBottom + 40;
  const yAt = (value: number) => plotBottom - value / 100 * (plotBottom - plotTop);
  const index = Math.min(hovered ?? 0, Math.max(0, lines.length - 1));
  const activeValue = lines[index];
  const activeRank = activeValue === undefined ? null : percentileAt(values, activeValue);
  const activeX = left + (index + 0.5) / Math.max(1, lines.length) * plotWidth;
  const selected = markers.find(marker => marker.id === selectedQuote);
  function inspect(clientX: number, rect: DOMRect) {
    const x = (clientX - rect.left) / rect.width * width;
    setHovered(Math.max(0, Math.min(lines.length - 1, Math.floor((x - left) / plotWidth * lines.length))));
  }
  return <div ref={container} className="air-distribution">
    {n === 0 ? <div className="air-empty-chart"><p>No viewer forecasts for this outcome yet.</p><a href="#your-forecast" className="air-text-link">Add your forecast</a></div> : <>
      {hovered !== null && <div className="air-chart-hover" aria-live="polite"><strong>{formatProbability(activeValue)}</strong><span>{Math.round(activeRank?.below ?? 0)}% gave a lower estimate</span></div>}
      <svg className="air-chart-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Risk estimates from ${n} ${audience}, ordered ${descending ? "highest to lowest" : "lowest to highest"}. Select a face for its quote, or use the slider below to inspect answers.`}>
        <defs>{markers.map(({ id }) => <clipPath key={id} id={`face-${id}`}><circle r={radius - 2} /></clipPath>)}</defs>
        {[0, 25, 50, 75, 100].map(value => <g key={value}>
          <line x1={left} x2={right} y1={yAt(value)} y2={yAt(value)} stroke="#e2e8eb" />
          <text x={left - 9} y={yAt(value) + 4} textAnchor="end" fill="#657782" fontSize="11">{value}%</text>
        </g>)}
        {lines.map((value, i) => {
          const x = left + (i + 0.5) / lines.length * plotWidth;
          const active = hovered !== null && i === index;
          return <line className="air-answer-line" key={i} x1={x} x2={x} y1={plotBottom} y2={yAt(value) - (value === 0 ? 2 : 0)} stroke={active ? "#173e31" : audience === "viewers" ? "#b47b2f" : "#2f8a65"} strokeWidth={Math.max(1.6, Math.min(3.7, plotWidth / lines.length * 0.48))} strokeLinecap="round" opacity={active ? 1 : 0.72} />;
        })}
        {selected && (() => {
          const { quote, center, cy, bounds, rankLow, rankHigh } = selected;
          const isPoint = quote.estimate.kind === "point";
          const targetX = xAtPercentile(rankLow);
          const targetY = yAt(bounds[0]);
          const otherX = xAtPercentile(rankHigh);
          const otherY = yAt(bounds[1]);
          return <g className="air-active-connector" data-quote-id={quote.id} pointerEvents="none">
            <path d={`M ${center} ${cy + radius} C ${center} ${plotTop - 8}, ${targetX} ${plotTop - 8}, ${targetX} ${targetY}`} stroke="#ae743b" strokeWidth="2" fill="none" strokeDasharray={isPoint ? undefined : "4 3"} />
            {!isPoint && <><line x1={targetX} y1={targetY} x2={otherX} y2={otherY} stroke="#ae743b" strokeWidth="6" opacity="0.35" /><circle cx={otherX} cy={otherY} r="4" fill="white" stroke="#ae743b" strokeWidth="2" /></>}
            <circle cx={targetX} cy={targetY} r="5" fill={isPoint ? "#ae743b" : "white"} stroke="#ae743b" strokeWidth="2" />
          </g>;
        })()}
        {mine !== undefined && <g aria-label={`Your estimate: ${formatProbability(mine)}`}>
          <circle cx={xAtPercentile(percentileAt(values, mine).midpoint)} cy={yAt(mine)} r="6" fill="#deac48" stroke="white" strokeWidth="2" />
          <text x={Math.min(right - 28, xAtPercentile(percentileAt(values, mine).midpoint))} y={yAt(mine) - 13} fontSize="11" fill="#6f4d15">YOU</text>
        </g>}
        {hovered !== null && <circle cx={activeX} cy={yAt(activeValue)} r="4.5" fill="#173e31" stroke="white" strokeWidth="2" />}
        {markers.map(({ quote, center, cy, figure }) => {
          const active = quote.id === selectedQuote;
          const label = `${figure.name}: ${estimateLabel(quote.estimate)}. Select to read the quote.`;
          return <g key={quote.id} transform={`translate(${center}, ${cy})`} className={`air-chart-marker ${active ? "is-selected" : ""}`} data-quote-id={quote.id} data-anchor-x={anchors.find(anchor => anchor.id === quote.id)!.x} role="button" tabIndex={0} aria-label={label} aria-pressed={active}
            onClick={() => onSelectQuote(quote.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectQuote(quote.id); } }}>
            <title>{label}</title>
            <circle r={radius} fill="white" stroke={active ? "#ae743b" : "#d3dce1"} strokeWidth={active ? 3 : 1.5} />
            <text y="4" textAnchor="middle" fontSize="12" fill="#1d303c">{figure.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</text>
            {figure.portrait.src && <image href={figure.portrait.src} x={2 - radius} y={2 - radius} width={(radius - 2) * 2} height={(radius - 2) * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#face-${quote.id})`} />}
          </g>;
        })}
        <rect x={left} y={plotTop} width={plotWidth} height={plotBottom - plotTop + 10} fill="transparent" className="air-chart-hitarea" onPointerMove={event => inspect(event.clientX, event.currentTarget.ownerSVGElement!.getBoundingClientRect())} onPointerDown={event => inspect(event.clientX, event.currentTarget.ownerSVGElement!.getBoundingClientRect())} onPointerLeave={() => setHovered(null)} />
        <text x={left} y={plotBottom + 28} fill="#657782" fontSize="11">{descending ? "Highest" : "Lowest"} estimate</text>
        <text x={right} y={plotBottom + 28} fill="#657782" fontSize="11" textAnchor="end">{descending ? "Lowest" : "Highest"} estimate</text>
      </svg>
      <label className="air-inspect"><span>Inspect answers</span><input type="range" min="0" max={Math.max(0, lines.length - 1)} value={index} onChange={event => setHovered(Number(event.target.value))} onBlur={() => setHovered(null)} aria-label={`Inspect ${audience}' answers`} aria-valuetext={hovered === null ? "Select an answer" : `${formatProbability(activeValue)}, ${Math.round(activeRank?.below ?? 0)} percent gave a lower estimate`} /></label>
    </>}
  </div>;
}
