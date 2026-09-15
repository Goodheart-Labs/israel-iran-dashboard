export type OutcomeId =
  | "extinction"
  | "extinction-century"
  | "loss-of-control"
  | "extremely-good"
  | "good"
  | "neutral"
  | "bad"
  | "extremely-bad";

export interface ProbabilityCount {
  value: number;
  count: number;
}

export interface SurveyQuestion {
  id: OutcomeId;
  shortLabel: string;
  label: string;
  description: string;
  group: "risk" | "outcomes";
  column: string;
  n: number;
  mean: number;
  median: number;
  values: ProbabilityCount[];
  wordingNote: string;
}

export interface SurveyData {
  year: number;
  sourceLabel: string;
  sourceUrl: string;
  methodsUrl: string;
  questions: SurveyQuestion[];
}

export type ProbabilityEstimate =
  | { kind: "point"; value: number }
  | { kind: "range"; low: number; high: number }
  | { kind: "lower-bound"; value: number }
  | { kind: "upper-bound"; value: number }
  | { kind: "qualitative"; label: string };

export interface PublicQuote {
  id: string;
  figureId: string;
  outcomeIds: OutcomeId[];
  estimate: ProbabilityEstimate;
  quote: string;
  sourceTitle: string;
  sourceUrl: string;
  date: string | null;
  originalOutcome: string;
  context: string;
  comparison: "related" | "same-question";
  findingConsensusUrl?: string;
}

export interface PublicFigure {
  id: string;
  name: string;
  role: string;
  portrait: { src: string; sourceUrl: string; credit: string };
}

export interface PublicFiguresData {
  checkedAt: string;
  figures: PublicFigure[];
  quotes: PublicQuote[];
  researchNote: string;
}

export type UsefulnessRating = "useful" | "somewhat_useful" | "not_useful";

export interface UsefulnessTally {
  slot: string;
  useful: number;
  somewhat_useful: number;
  not_useful: number;
  mine?: UsefulnessRating;
}
