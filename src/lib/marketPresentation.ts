export const DAY_MS = 86_400_000;

export function isPastDeadline(markets: { resolveDate?: number }[], now: number) {
  return markets.length > 0 && markets.every(
    (market) => market.resolveDate !== undefined && market.resolveDate <= now,
  );
}

type Point = { timestamp: number; probability: number };

// Keep actual observations only. Don't extend a source beyond its last reading,
// or bridge gaps longer than two days with an apparently current price.
export function mergeMarketHistory(series: { history: Point[] }[]) {
  const histories = series.map((s) => [...s.history].sort((a, b) => a.timestamp - b.timestamp));
  const timestamps = [...new Set(histories.flatMap((h) => h.flatMap((p, i) =>
    h[i + 1] && h[i + 1].timestamp - p.timestamp > 2 * DAY_MS
      ? [p.timestamp, p.timestamp + 2 * DAY_MS + 1]
      : [p.timestamp],
  )))].sort((a, b) => a - b);
  const indices = histories.map(() => 0);
  return timestamps.map((timestamp) => {
    const row: Record<string, number | null> = { timestamp };
    histories.forEach((history, i) => {
      while (indices[i] < history.length - 1 && history[indices[i] + 1].timestamp <= timestamp) indices[i]++;
      const point = history[indices[i]];
      row[`series_${i}`] = point && point.timestamp <= timestamp
        && timestamp <= history[history.length - 1].timestamp
        && timestamp - point.timestamp <= 2 * DAY_MS ? point.probability : null;
    });
    return row;
  });
}
