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

export type DistributionSeries = {
  name: string;
  color: string;
  dash?: string;
  points: { label: string; time: number; value: number }[];
};

/**
 * The central chart: how likely each company is to IPO in each month.
 *
 * One line per company, each blended from that company's sources. Rows are
 * merged on month so sources with different horizons still line up, and lines
 * connect across each other's gaps.
 */
export function DistributionChart({
  series,
  height = 320,
}: {
  series: DistributionSeries[];
  height?: number;
}) {
  const rowsByTime = new Map<number, Record<string, string | number>>();
  for (const s of series) {
    for (const point of s.points) {
      const row = rowsByTime.get(point.time) ?? { label: point.label };
      row[s.name] = point.value;
      rowsByTime.set(point.time, row);
    }
  }
  const rows = Array.from(rowsByTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row);

  if (rows.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.08}
          />
          <XAxis
            dataKey="label"
            interval={0}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={54}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            tickFormatter={(v: number) => `${v}%`}
            width={44}
            tickLine={false}
            label={{
              value: "Chance it lands this month",
              angle: -90,
              position: "insideLeft",
              offset: 8,
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
            formatter={(value: number, name: string) => [`${value}%`, name]}
          />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              strokeDasharray={s.dash}
              dot={false}
              activeDot={{ r: 5, fill: s.color, strokeWidth: 2, stroke: "#fff" }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
