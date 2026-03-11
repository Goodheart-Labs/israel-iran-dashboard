import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TimelinePoint {
  timestamp: number;
  probability: number; // 0-100 (centers[0] * 100)
  lowerBound?: number; // 0-1 raw from Metaculus
  upperBound?: number; // 0-1 raw from Metaculus
}

interface TimelineChartProps {
  history: TimelinePoint[];
  scalingRangeMin: number; // Unix seconds
  scalingRangeMax: number; // Unix seconds
  color?: string;
}

/** Convert a 0-1 position on the Metaculus range to a fractional year */
function scaleToYear(
  value01: number,
  rangeMin: number,
  rangeMax: number
): number {
  const timestampSec = rangeMin + (rangeMax - rangeMin) * value01;
  const d = new Date(timestampSec * 1000);
  return d.getFullYear() + d.getMonth() / 12;
}

function formatXDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatYear(year: number): string {
  return Math.round(year).toString();
}

export function TimelineChart({
  history,
  scalingRangeMin,
  scalingRangeMax,
  color = "#8B5CF6",
}: TimelineChartProps) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No historical data available</p>
      </div>
    );
  }

  // Transform history into chart data
  const chartData = history.map((h) => {
    const center01 = h.probability / 100;
    const centerYear = scaleToYear(center01, scalingRangeMin, scalingRangeMax);

    let lowerYear: number | undefined;
    let upperYear: number | undefined;

    if (h.lowerBound !== undefined && h.upperBound !== undefined) {
      lowerYear = scaleToYear(h.lowerBound, scalingRangeMin, scalingRangeMax);
      upperYear = scaleToYear(h.upperBound, scalingRangeMin, scalingRangeMax);
    }

    return {
      timestamp: h.timestamp,
      year: Math.min(centerYear, 2050),
      range:
        lowerYear !== undefined && upperYear !== undefined
          ? [Math.min(lowerYear, 2050), Math.min(upperYear, 2050)]
          : undefined,
    };
  });

  // Cap Y-axis at a reasonable range
  const allYears = chartData.flatMap((d) => {
    const years = [d.year];
    if (d.range) {
      years.push(d.range[0], d.range[1]);
    }
    return years;
  });
  const minYear = Math.floor(Math.min(...allYears));
  const maxYear = Math.min(Math.ceil(Math.max(...allYears)), 2050);
  const yMin = Math.max(minYear - 2, 2024);
  const yMax = Math.min(maxYear + 2, 2050);

  const hasBounds = chartData.some((d) => d.range !== undefined);

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
            tickFormatter={formatXDate}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={50}
            tickLine={false}
            label={{ value: "Date of forecast", position: "insideBottom", offset: -2, fontSize: 10, fill: "#6B7280" }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            tickFormatter={formatYear}
            width={50}
            tickLine={false}
            label={{ value: "Date it ceases", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "#6B7280" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--chart-tooltip-bg, #1F2937)",
              border: "1px solid var(--chart-tooltip-border, #374151)",
              borderRadius: "8px",
              color: "var(--chart-tooltip-text, #F9FAFB)",
            }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
            formatter={(value: unknown, name: string) => {
              if (name === "range" && Array.isArray(value)) {
                return [
                  `${Math.round(value[0])} – ${Math.round(value[1])}`,
                  "90% CI",
                ];
              }
              if (name === "year") {
                return [Math.round(value as number).toString(), "Median"];
              }
              return [String(value), name];
            }}
          />
          {hasBounds && (
            <Area
              type="monotone"
              dataKey="range"
              fill={color}
              fillOpacity={0.15}
              stroke="none"
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            type="monotone"
            dataKey="year"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            connectNulls
            activeDot={{
              r: 5,
              fill: color,
              strokeWidth: 2,
              stroke: "#fff",
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
