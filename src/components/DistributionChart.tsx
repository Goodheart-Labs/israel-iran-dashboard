import { useEffect, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
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
  yAxisLabel = "Chance it lands this month",
}: {
  series: DistributionSeries[];
  height?: number;
  yAxisLabel?: string;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
    <div
      className="bg-base-200 flex flex-col rounded-lg p-2"
      style={{ height }}
    >
      <div className="flex h-7 shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        {series.map((item) => (
          <span
            key={item.name}
            className="inline-flex items-center gap-1"
            style={{ color: item.color }}
          >
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={item.dash}
              />
            </svg>
            {item.name}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1">
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
              interval={compact ? "preserveStartEnd" : 0}
              minTickGap={compact ? 18 : 5}
              tick={{ fontSize: compact ? 9 : 10 }}
              stroke="#9CA3AF"
              angle={compact ? -55 : -45}
              textAnchor="end"
              height={compact ? 58 : 54}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#9CA3AF"
              tickFormatter={(v: number) => `${v}%`}
              width={compact ? 36 : 44}
              tickLine={false}
              label={
                compact
                  ? undefined
                  : {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      offset: 8,
                      fontSize: 10,
                      fill: "#6B7280",
                    }
              }
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
            {series.map((s) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                strokeDasharray={s.dash}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: s.color,
                  strokeWidth: 2,
                  stroke: "#fff",
                }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
