// Pure helpers shared by the seed, pollers and history import. No Convex
// imports, so both "use node" actions and plain modules can use them.

// Kalshi's v2 API now reports prices as dollar strings ("0.8050") and leaves
// the old integer-cent fields null. Returns 0-100 or null when unpriced.
export function kalshiPrice(m: any): number | null {
  const toPct = (v: unknown): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  const last = toPct(m?.last_price_dollars);
  if (last !== null && last > 0) return last;
  const bid = toPct(m?.yes_bid_dollars);
  const ask = toPct(m?.yes_ask_dollars);
  if (bid !== null && ask !== null && ask > 0) return Math.round((bid + ask) / 2);
  if (last !== null) return last;
  if (typeof m?.last_price === "number") return m.last_price;
  return null;
}

// sourceUrl: https://kalshi.com/markets/<series>[#<TICKER>]. The fragment pins
// the exact market; without it callers fall back to matching by title.
export function parseKalshiSourceUrl(url: string): { series: string; ticker?: string } {
  const [path, hash] = url.split("#");
  const parts = path.split("/").filter(Boolean);
  return {
    series: (parts[parts.length - 1] || "").toUpperCase(),
    ticker: hash ? hash.toUpperCase() : undefined,
  };
}

// sourceUrl: https://www.metaculus.com/questions/<post>/[?sub-question=<id>]
export function parseMetaculusSourceUrl(url: string): { postId?: string; subQuestionId?: number } {
  const postId = url.match(/questions\/(\d+)/)?.[1];
  const sub = url.match(/sub-question=(\d+)/)?.[1];
  return { postId, subQuestionId: sub ? Number(sub) : undefined };
}

// A Metaculus post is either a single question (`data.question`) or a group
// (`data.group_of_questions.questions[]`); pick the one we track.
export function pickMetaculusQuestion(data: any, subQuestionId?: number): any {
  if (subQuestionId !== undefined) {
    return data?.group_of_questions?.questions?.find((q: any) => q.id === subQuestionId);
  }
  return data?.question;
}
