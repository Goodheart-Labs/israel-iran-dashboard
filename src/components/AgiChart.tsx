import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { agiChartRows, type AgiSource } from "@/lib/agi";

export function AgiChart({
  sources,
  bandId,
}: {
  sources: AgiSource[];
  bandId?: string;
}) {
  const [full, setFull] = useState(false);
  const [log, setLog] = useState(false);
  const probability = sources[0]?.kind === "probability";
  const rows = agiChartRows(sources);
  if (!rows.length)
    return (
      <p className="p-6 text-sm opacity-60">
        No observations available for this source.
      </p>
    );
  const values = sources.flatMap((s) =>
    s.points.flatMap((p) => [p.value, ...(p.range ?? [])]),
  );
  const lower = probability
    ? 0
    : Math.min(2024, Math.floor(Math.min(...values)));
  const upper = probability
    ? 100
    : full
      ? Math.ceil(Math.max(...values))
      : 2060;
  const base = lower - 1;
  const transform = (n: number) => (log && !probability ? n - base : n);
  const inverse = (n: number) => (log && !probability ? n + base : n);
  const chartRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        key === "t"
          ? value
          : Array.isArray(value)
            ? value.map(transform)
            : transform(value),
      ]),
    ),
  );
  const download = () => {
    const lines = [
      "source,forecast_date,median,lower_10,upper_90",
      ...sources.flatMap((s) =>
        s.points.map((p) =>
          [
            JSON.stringify(s.name),
            p.date,
            p.value,
            p.range?.[0] ?? "",
            p.range?.[1] ?? "",
          ].join(","),
        ),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "agi-forecasts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <div className="bg-base-200 rounded-lg p-2">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pb-3 text-xs">
          {sources.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1"
              style={{ color: s.color }}
            >
              <svg width="18" height="8" aria-hidden="true">
                <path d="M0 4H18" stroke="currentColor" strokeWidth="2" />
              </svg>
              {s.name}
            </span>
          ))}
        </div>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartRows}
              margin={{ top: 8, right: 10, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                stroke="currentColor"
                opacity={0.08}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={(t: number) =>
                  new Date(t).toLocaleDateString("en-US", {
                    month: "short",
                    year: "2-digit",
                  })
                }
                tick={{ fontSize: 10 }}
                minTickGap={35}
                tickLine={false}
                stroke="#9CA3AF"
              />
              <YAxis
                domain={[transform(lower), transform(upper)]}
                allowDataOverflow
                scale={log && !probability ? "log" : "linear"}
                tickFormatter={(n: number) =>
                  `${Math.round(inverse(n))}${probability ? "%" : ""}`
                }
                width={44}
                tick={{ fontSize: 10 }}
                tickLine={false}
                stroke="#9CA3AF"
              />
              <Tooltip
                labelFormatter={(t) => new Date(Number(t)).toLocaleDateString()}
                formatter={(value: number | number[], name: string) => [
                  Array.isArray(value)
                    ? value.map((n) => Math.round(inverse(n))).join("–")
                    : `${Math.round(inverse(value))}${probability ? "%" : ""}`,
                  sources.find((s) => s.id === name)?.name ??
                    "10th–90th percentile",
                ]}
                contentStyle={{
                  background: "var(--color-base-100)",
                  border: "1px solid var(--color-base-300)",
                  borderRadius: 6,
                }}
              />
              {bandId && (
                <Area
                  dataKey={`${bandId}-range`}
                  type="monotone"
                  fill={sources.find((s) => s.id === bandId)?.color}
                  fillOpacity={0.12}
                  stroke="none"
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {sources.map((s) => (
                <Line
                  key={s.id}
                  dataKey={s.id}
                  type="monotone"
                  stroke={s.color}
                  strokeWidth={s.id === "index" ? 3 : 2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs opacity-65">
        <button className="py-2 hover:underline" onClick={download}>
          Download data
        </button>
        {!probability && (
          <div className="flex flex-wrap gap-3">
            <button
              className="py-2 hover:underline"
              aria-pressed={full}
              onClick={() => setFull(!full)}
            >
              {full ? "Full year range" : "Axis capped at 2060"}
            </button>
            <button
              className="py-2 hover:underline"
              aria-pressed={log}
              onClick={() => setLog(!log)}
            >
              {log ? "Log scale" : "Linear scale"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
