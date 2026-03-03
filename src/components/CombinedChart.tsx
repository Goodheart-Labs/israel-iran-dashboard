import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type HistoryPoint = { timestamp: number; probability: number };

export type ChartSeries = {
  label: string;
  color: string;
  source: string;
  probability: number;
  history: HistoryPoint[];
};

interface CombinedChartProps {
  series: ChartSeries[];
  daysToShow?: number; // Limit chart to last N days
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Merge multiple series into a single dataset keyed by timestamp.
// Each series keeps its own timestamps; we collect all unique timestamps
// and for each series carry forward the last known value.
function mergeSeriesData(series: ChartSeries[]) {
  // Collect all unique timestamps across all series
  const allTimestamps = new Set<number>();
  for (const s of series) {
    for (const p of s.history) {
      allTimestamps.add(p.timestamp);
    }
  }

  const sorted = Array.from(allTimestamps).sort((a, b) => a - b);

  // Build lookup per series: sorted arrays for carry-forward
  const seriesData = series.map((s) => {
    const sorted = [...s.history].sort((a, b) => a.timestamp - b.timestamp);
    return sorted;
  });

  const result: Array<Record<string, number | null>> = [];

  // Track current index into each series for carry-forward
  const indices = new Array(series.length).fill(0);

  for (const ts of sorted) {
    const row: Record<string, number | null> = { timestamp: ts };

    for (let i = 0; i < series.length; i++) {
      const data = seriesData[i];
      // Advance index to the latest point at or before this timestamp
      while (
        indices[i] < data.length - 1 &&
        data[indices[i] + 1].timestamp <= ts
      ) {
        indices[i]++;
      }

      if (data.length === 0 || data[indices[i]].timestamp > ts) {
        row[`series_${i}`] = null;
      } else {
        row[`series_${i}`] = data[indices[i]].probability;
      }
    }

    result.push(row);
  }

  return result;
}

export function CombinedChart({ series, daysToShow }: CombinedChartProps) {
  const hasHistory = series.some((s) => s.history.length > 0);

  if (!hasHistory) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No historical data yet</p>
        <div className="flex justify-center gap-6 mt-3">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-sm">{s.probability}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Optionally limit to last N days
  const displaySeries = daysToShow
    ? series.map((s) => {
        const cutoff = Date.now() - daysToShow * 24 * 60 * 60 * 1000;
        return { ...s, history: s.history.filter((p) => p.timestamp >= cutoff) };
      })
    : series;

  const chartData = mergeSeriesData(displaySeries);

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height: "260px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
        >
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
            tickFormatter={formatDate}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={40}
            tickLine={false}
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
              dot={false}
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
