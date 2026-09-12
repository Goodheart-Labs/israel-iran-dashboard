export const HIDE_SCORE = -3;

export function helpfulnessScore(tally: {
  helpful: number;
  somewhat_helpful: number;
  not_helpful: number;
}) {
  return tally.helpful + tally.somewhat_helpful * 0.5 - tally.not_helpful;
}

export function chartScore(votes: { rating: string }[]) {
  return votes.reduce(
    (score, vote) =>
      score +
      (vote.rating === "useful"
        ? 1
        : vote.rating === "somewhat_useful"
          ? 0.5
          : -1),
    0,
  );
}

/** Short stable id for a votable item, so slots survive redeploys while the text is unchanged. */
export function itemId(...parts: string[]): string {
  let h = 5381;
  for (const ch of parts.join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
