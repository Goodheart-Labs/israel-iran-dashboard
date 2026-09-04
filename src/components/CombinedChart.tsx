import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { mergeMarketHistory } from "@/lib/marketPresentation";

type HistoryPoint = { timestamp: number; probability: number };

export type ChartSeries = {
  label: string;
  color: string;
  source: string;
  probability: number;
  history: HistoryPoint[];
  sourceUrl?: string;
  lastUpdated?: number;
  resolveDate?: number;
  historyNote?: string;
};

function SourceLegend({ series }: { series: ChartSeries[] }) {
  return <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-3 text-xs">
    {series.map((s, i) => {
      const detail = [s.lastUpdated !== undefined ? `Last updated: ${new Date(s.lastUpdated).toLocaleString()}` : "",
        s.resolveDate !== undefined ? `Stored closing date: ${new Date(s.resolveDate).toLocaleDateString()}` : "", s.historyNote].filter(Boolean).join(" · ");
      const content = <><svg width="20" height="10" aria-hidden="true"><line x1="0" x2="20" y1="5" y2="5" stroke="currentColor" strokeWidth="2" /></svg><span className="capitalize">{s.label}</span><span className="tabular-nums">{s.probability}%</span></>;
      return s.sourceUrl
        ? <a key={i} href={s.sourceUrl} target="_blank" rel="noopener noreferrer" title={detail} aria-label={`${s.label}: ${s.probability}%. ${detail}`} className="inline-flex items-center gap-1 py-1 hover:underline" style={{ color: s.color }}>{content}</a>
        : <span key={i} title={detail} className="inline-flex items-center gap-1 py-1" style={{ color: s.color }}>{content}</span>;
    })}
  </div>;
}

interface CombinedChartProps {
  series: ChartSeries[];
  daysToShow?: number; // Limit chart to last N days
}

function formatDate(ts: number, includeYear: boolean): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "2-digit" as const } : {}),
  });
}

export function CombinedChart({ series, daysToShow }: CombinedChartProps) {
  const displaySeries = daysToShow
    ? series.map((s) => ({ ...s, history: s.history.filter((p) => p.timestamp >= Date.now() - daysToShow * 86_400_000) }))
    : series;
  const hasHistory = displaySeries.some((s) => s.history.length > 0);

  if (!hasHistory) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No observations in this period</p>
        <SourceLegend series={series} />
      </div>
    );
  }

  const chartData = mergeMarketHistory(displaySeries);
  const includeYear = Number(chartData[chartData.length - 1].timestamp) - Number(chartData[0].timestamp) > 365 * 86_400_000;

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height: "260px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
        >
          <Legend verticalAlign="top" content={<SourceLegend series={series} />} />
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.08}
          />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts: number) => formatDate(ts, includeYear)}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={40}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            label={{ value: "%", angle: 0, position: "top" }}
            width={30}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--chart-tooltip-bg, #1F2937)",
              border: "1px solid var(--chart-tooltip-border, #374151)",
              borderRadius: "8px",
              color: "var(--chart-tooltip-text, #F9FAFB)",
            }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
            formatter={(value: number, name: string) => {
              const idx = parseInt(name.replace("series_", ""));
              const s = series[idx];
              return [`${value}%`, s?.source || name];
            }}
          />
          {series.map((s, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`series_${i}`}
              name={`series_${i}`}
              stroke={s.color}
              strokeWidth={2.5}
              dot={s.history.length === 1 ? { r: 3, fill: s.color } : false}
              connectNulls
              activeDot={{
                r: 5,
                fill: s.color,
                strokeWidth: 2,
                stroke: "#fff",
              }}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
