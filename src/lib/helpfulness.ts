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
