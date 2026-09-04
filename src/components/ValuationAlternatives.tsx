export type ValuationForecast = {
  name: string;
  color: string;
  buckets: {
    lower: number;
    upper: number | null;
    openLower: boolean;
    probability: number;
  }[];
};

function valuationQuantile(forecast: ValuationForecast, q: number) {
  const total = forecast.buckets.reduce((sum, b) => sum + b.probability, 0);
  if (!(total > 0)) return null;
  let cumulative = 0;
  for (const bucket of forecast.buckets) {
    const mass = bucket.probability / total;
    if (mass > 0 && cumulative + mass >= q) {
      if (bucket.openLower)
        return { value: bucket.upper ?? bucket.lower, bound: "<" };
      if (bucket.upper == null) return { value: bucket.lower, bound: "≥" };
      return {
        value:
          bucket.lower +
          ((bucket.upper - bucket.lower) * (q - cumulative)) / mass,
        bound: "",
      };
    }
    cumulative += mass;
  }
  return null;
}

const ranges = [
  [10, 90],
  [20, 80],
  [25, 75],
] as const;
const money = (point: { value: number; bound: string }) =>
  `${point.bound}$${point.value.toFixed(2)}T`;

export function ValuationAlternatives({
  forecasts,
}: {
  forecasts: ValuationForecast[];
}) {
  if (!forecasts.length)
    return (
      <p className="p-8 text-center opacity-60">Loading valuation forecasts…</p>
    );
  const values = forecasts.flatMap((f) =>
    [0.1, 0.9].map((q) => valuationQuantile(f, q)?.value ?? 0),
  );
  const min = Math.floor(Math.min(...values) * 2) / 2;
  const max = Math.max(min + 0.5, Math.ceil(Math.max(...values) * 2) / 2);
  const ticks = Array.from(
    { length: Math.round((max - min) / 0.5) + 1 },
    (_, i) => min + i * 0.5,
  );
  return (
    <div className="space-y-6">
      {(["Horizontal", "Vertical"] as const).flatMap(
        (orientation, orientationIndex) =>
          ranges.map(([low, high]) => {
            if (orientationIndex !== 0 || low !== 25) return null;
            const vertical = orientation === "Vertical";
            const rows = forecasts.flatMap((f) => {
              const lower = valuationQuantile(f, low / 100);
              const upper = valuationQuantile(f, high / 100);
              const median = valuationQuantile(f, 0.5);
              return lower && upper && median
                ? [{ ...f, lower, upper, median }]
                : [];
            });
            const scale = (value: number) =>
              vertical
                ? 258 - ((value - min) / (max - min)) * 200
                : 100 + ((value - min) / (max - min)) * 480;
            return (
              <section
                key={`${orientation}-${low}`}
                className="valuation-range rounded-lg border border-[#d5cfc3] bg-[#f2f5f7] p-3 text-[#292b2c] sm:p-5"
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-semibold">
                    The middle half of the forecast
                  </h4>
                  <span className="text-xs text-[#62615c]">
                    Central {high - low}% of forecast · USD trillions
                  </span>
                </div>
                <svg
                  viewBox={vertical ? "0 0 640 320" : "0 0 640 230"}
                  className="hidden w-full sm:block"
                  role="img"
                  aria-label={`${orientation} IPO valuation forecast, ${low}th to ${high}th percentiles`}
                >
                  {ticks.map((t) =>
                    vertical ? (
                      <g key={t}>
                        <line
                          x1="65"
                          x2="610"
                          y1={scale(t)}
                          y2={scale(t)}
                          stroke="#ded8cd"
                        />
                        <text
                          x="55"
                          y={scale(t) + 4}
                          textAnchor="end"
                          fontSize="12"
                          fill="#62615c"
                        >
                          ${t.toFixed(1)}T
                        </text>
                      </g>
                    ) : (
                      <g key={t}>
                        <line
                          x1={scale(t)}
                          x2={scale(t)}
                          y1="25"
                          y2="175"
                          stroke="#ded8cd"
                        />
                        <text
                          x={scale(t)}
                          y="200"
                          textAnchor="middle"
                          fontSize="12"
                          fill="#62615c"
                        >
                          ${t.toFixed(1)}T
                        </text>
                      </g>
                    ),
                  )}
                  {rows.map((row, i) => {
                    const position = vertical ? 235 + i * 240 : 65 + i * 80;
                    return (
                      <g key={row.name}>
                        <title>
                          {row.name}: median {money(row.median)}; range{" "}
                          {money(row.lower)} to {money(row.upper)}
                        </title>
                        {vertical ? (
                          <>
                            <rect
                              x={position - 23}
                              y={scale(row.upper.value)}
                              width="46"
                              height={
                                scale(row.lower.value) - scale(row.upper.value)
                              }
                              fill={row.color}
                              fillOpacity="0.65"
                            />
                            <line
                              x1={position - 30}
                              x2={position + 30}
                              y1={scale(row.median.value)}
                              y2={scale(row.median.value)}
                              stroke="#292b2c"
                              strokeWidth="3"
                            />
                            <text
                              x={position}
                              y="286"
                              textAnchor="middle"
                              fontSize="15"
                              fontWeight="600"
                            >
                              {row.name}
                            </text>
                            <text
                              x={position}
                              y="307"
                              textAnchor="middle"
                              fontSize="12"
                            >
                              Median {money(row.median)}
                            </text>
                            <text
                              x={position}
                              y={scale(row.upper.value) - 9}
                              textAnchor="middle"
                              fontSize="12"
                            >
                              {money(row.upper)}
                            </text>
                          </>
                        ) : (
                          <>
                            <text
                              x="0"
                              y={position + 5}
                              fontSize="14"
                              fontWeight="600"
                            >
                              {row.name}
                            </text>
                            <rect
                              x={scale(row.lower.value)}
                              y={position - 12}
                              width={
                                scale(row.upper.value) - scale(row.lower.value)
                              }
                              height="24"
                              fill={row.color}
                              fillOpacity="0.65"
                            />
                            <line
                              x1={scale(row.median.value)}
                              x2={scale(row.median.value)}
                              y1={position - 18}
                              y2={position + 18}
                              stroke="#292b2c"
                              strokeWidth="3"
                            />
                            <text
                              x={scale(row.median.value)}
                              y={position - 25}
                              textAnchor="middle"
                              fontSize="13"
                              fontWeight="600"
                            >
                              {money(row.median)}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="space-y-5 py-3 sm:hidden">
                  {vertical ? (
                    <div className="flex h-72 gap-4">
                      <div className="relative mb-12 w-10 shrink-0 text-[10px] text-[#62615c]">
                        {ticks.map((t) => (
                          <span
                            key={t}
                            className="absolute right-0 translate-y-1/2"
                            style={{
                              bottom: `${((t - min) / (max - min)) * 100}%`,
                            }}
                          >
                            ${t.toFixed(1)}T
                          </span>
                        ))}
                      </div>
                      {rows.map((row) => (
                        <div
                          key={row.name}
                          className="flex min-w-0 flex-1 flex-col"
                        >
                          <div className="relative flex-1 border-b border-[#d5cfc3]">
                            <div
                              className="absolute left-1/2 w-8 -translate-x-1/2"
                              style={{
                                bottom: `${((row.lower.value - min) / (max - min)) * 100}%`,
                                height: `${((row.upper.value - row.lower.value) / (max - min)) * 100}%`,
                                background: row.color,
                                opacity: 0.65,
                              }}
                            />
                            <div
                              className="absolute left-1/2 w-11 -translate-x-1/2 border-t-[3px] border-[#292b2c]"
                              style={{
                                bottom: `${((row.median.value - min) / (max - min)) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="h-12 pt-2 text-center text-xs">
                            <strong>{row.name}</strong>
                            <div>{money(row.median)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    rows.map((row) => (
                      <div key={row.name}>
                        <div className="mb-2 flex justify-between text-sm">
                          <strong>{row.name}</strong>
                          <span>Median {money(row.median)}</span>
                        </div>
                        <div className="relative h-9 border-b border-[#d5cfc3]">
                          <div
                            className="absolute top-2 h-4"
                            style={{
                              left: `${((row.lower.value - min) / (max - min)) * 100}%`,
                              width: `${((row.upper.value - row.lower.value) / (max - min)) * 100}%`,
                              background: row.color,
                              opacity: 0.65,
                            }}
                          />
                          <div
                            className="absolute top-1 h-6 border-l-[3px] border-[#292b2c]"
                            style={{
                              left: `${((row.median.value - min) / (max - min)) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-[#62615c]">
                          <span>${min.toFixed(1)}T</span>
                          <span>${max.toFixed(1)}T</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-[#d5cfc3] pt-3 text-xs text-[#62615c]">
                  {rows.map((row) => (
                    <span key={row.name}>
                      {row.name}: {money(row.lower)}–{money(row.upper)}
                    </span>
                  ))}
                </div>
              </section>
            );
          }),
      )}
    </div>
  );
}
