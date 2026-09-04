type Point = { timestamp: number; probability: number };

function array(value: unknown): unknown[] {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error("Invalid market outcomes");
  return parsed;
}

export async function fetchPolymarketHistory(slug: string, signal?: AbortSignal): Promise<Point[]> {
  const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`, { signal });
  if (!response.ok) throw new Error(`Market lookup failed (${response.status})`);
  const markets = await response.json() as Array<{ slug: string; outcomes: unknown; clobTokenIds: unknown }>;
  // Never use the first market of a multi-question event or assume token 0 is Yes.
  const market = markets.find((m) => m.slug === slug);
  if (!market) throw new Error("Exact market not found");
  const yes = array(market.outcomes).findIndex((outcome) => outcome === "Yes");
  const token = array(market.clobTokenIds)[yes];
  if (yes < 0 || typeof token !== "string") throw new Error("Yes outcome missing");
  const historyResponse = await fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=max&fidelity=1440`, { signal });
  if (!historyResponse.ok) throw new Error(`History lookup failed (${historyResponse.status})`);
  const data = await historyResponse.json() as { history?: Array<{ t: number; p: number }> };
  const points = (data.history ?? []).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p) && p.p >= 0 && p.p <= 1)
    .map((p) => ({ timestamp: p.t * 1000, probability: p.p * 100 })).sort((a, b) => a.timestamp - b.timestamp);
  if (!points.length) throw new Error("No historical observations returned");
  return points;
}

export function mergeRecordedHistory<T extends Point>(recorded: T[], historical: Point[]): Array<T | Point> {
  const points = new Map(historical.map((point) => [point.timestamp, point]));
  // Retain the stored value at identical timestamps; fetching never edits it.
  for (const point of recorded) points.set(point.timestamp, point);
  return [...points.values()].sort((a, b) => a.timestamp - b.timestamp);
}
