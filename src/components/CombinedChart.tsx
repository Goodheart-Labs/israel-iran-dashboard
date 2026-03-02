import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
}

// Merge multiple series into a single dataset keyed by date
function mergeSeriesData(series: ChartSeries[]) {
  const dateMap = new Map<
    string,
    { date: string; timestamp: number; [key: string]: number | string }
  >();

  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const key = `series_${i}`;
    for (const point of s.history) {
      const dateStr = new Date(point.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, timestamp: point.timestamp } as any);
      }
      const entry = dateMap.get(dateStr)!;
      // If multiple points on same day, take the latest
      entry[key] = point.probability;
    }
  }

  // Sort by timestamp
  return Array.from(dateMap.values()).sort(
    (a, b) => (a.timestamp as number) - (b.timestamp as number)
  );
}

// Source badge colors
const SOURCE_BADGES: Record<string, { bg: string; text: string }> = {
  polymarket: { bg: "bg-blue-900/50", text: "text-blue-300" },
  kalshi: { bg: "bg-amber-900/50", text: "text-amber-300" },
  metaculus: { bg: "bg-purple-900/50", text: "text-purple-300" },
};

export function CombinedChart({ series }: CombinedChartProps) {
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
              <span className={`text-xs px-1.5 py-0.5 rounded ${SOURCE_BADGES[s.source]?.bg} ${SOURCE_BADGES[s.source]?.text}`}>
                {s.source}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const chartData = mergeSeriesData(series);

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
            dataKey="date"
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            interval="preserveStartEnd"
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
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F9FAFB",
            }}
            formatter={(value: number, name: string) => {
              // name is like "series_0" — map to label
              const idx = parseInt(name.replace("series_", ""));
              const s = series[idx];
              return [`${value}%`, s?.label || name];
            }}
          />
          <Legend
            verticalAlign="top"
            height={30}
            formatter={(value: string) => {
              const idx = parseInt(value.replace("series_", ""));
              const s = series[idx];
              if (!s) return value;
              return `${s.label} (${s.source})`;
            }}
            wrapperStyle={{ fontSize: "0.75rem" }}
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
