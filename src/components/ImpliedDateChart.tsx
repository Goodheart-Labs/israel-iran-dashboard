import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ImpliedDateSeries = {
  name: string;
  color: string;
  dash?: string;
  points: { t: number; impliedT: number }[];
};

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

/** Y axis is a date, so label it as one rather than as a number. */
function formatImplied(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatForecastDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * How each source's implied IPO date has moved as forecasts came in.
 * X is when the forecast was made; Y is the date it pointed at.
 */
export function ImpliedDateChart({
  series,
  height = 260,
}: {
  series: ImpliedDateSeries[];
  height?: number;
}) {
  const rowsByTime = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const point of s.points) {
      const row = rowsByTime.get(point.t) ?? { t: point.t };
      row[s.name] = point.impliedT;
      rowsByTime.set(point.t, row);
    }
  }
  const rows = Array.from(rowsByTime.values()).sort((a, b) => a.t - b.t);

  if (rows.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>Not enough history yet</p>
      </div>
    );
  }

  const values = series.flatMap((s) => s.points.map((p) => p.impliedT));
  const domain: [number, number] = [
    Math.min(...values) - MONTH_MS,
    Math.max(...values) + MONTH_MS,
  ];

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.08}
          />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={formatForecastDate}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            tickLine={false}
            height={30}
          />
          <YAxis
            domain={domain}
            tickFormatter={formatImplied}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            width={62}
            tickLine={false}
            label={{
              value: "Implied IPO date",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              fontSize: 10,
              fill: "#6B7280",
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--chart-tooltip-bg, #1F2937)",
              border: "1px solid var(--chart-tooltip-border, #374151)",
              borderRadius: "8px",
              color: "var(--chart-tooltip-text, #F9FAFB)",
            }}
            labelFormatter={(t) => new Date(t as number).toLocaleDateString()}
            formatter={(value: unknown, name: string) => [
              new Date(value as number).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
              name,
            ]}
          />
          <Legend verticalAlign="top" height={26} wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              strokeDasharray={s.dash}
              dot={false}
              connectNulls
              isAnimationActive={false}
              activeDot={{ r: 5, fill: s.color, strokeWidth: 2, stroke: "#fff" }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
