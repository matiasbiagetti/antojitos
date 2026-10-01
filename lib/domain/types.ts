export type CategoryId =
  | 'pizza'
  | 'burgers'
  | 'sushi'
  | 'pasta'
  | 'empanadas'
  | 'grill'
  | 'milanesa'
  | 'middle_eastern'
  | 'mexican'
  | 'chinese'
  | 'peruvian'
  | 'chicken'
  | 'sandwiches'
  | 'veggie';

export type VoteValue = 'super' | 'yes' | 'no';

export const VOTE_WEIGHTS: Readonly<Record<VoteValue, number>> = { super: 2, yes: 1, no: 0 };

export type RoomPhase = 'lobby' | 'voting' | 'runoff' | 'roulette' | 'result';

export type VisibilityConfig = {
  showRanking: boolean;
  showScores: boolean;
  showSuperCounts: boolean;
  showTiebreakPath: boolean;
  showWhoVotedWhat: boolean;
};

export type RoundSeconds = 45 | 60 | 90;

export const ROUND_SECONDS_OPTIONS: readonly RoundSeconds[] = [45, 60, 90];

export type RoomConfig = { visibility: VisibilityConfig; roundSeconds: RoundSeconds };

export const DEFAULT_CONFIG: RoomConfig = {
  visibility: {
    showRanking: true,
    showScores: true,
    showSuperCounts: true,
    showTiebreakPath: true,
    showWhoVotedWhat: false,
  },
  roundSeconds: 60,
};

export type Vote = { participantId: string; categoryId: CategoryId; value: VoteValue };

export type RunoffVote = { participantId: string; categoryId: CategoryId };

export type CategoryStat = { categoryId: CategoryId; score: number; superCount: number };

export type RoundOutcome =
  | { kind: 'no_cravings'; stats: CategoryStat[] }
  | { kind: 'winner'; winner: CategoryId; stats: CategoryStat[] }
  | { kind: 'runoff'; finalists: CategoryId[]; stats: CategoryStat[] }
  | { kind: 'roulette'; finalists: CategoryId[]; winner: CategoryId; stats: CategoryStat[] };

export type RunoffCount = { categoryId: CategoryId; votes: number };

export type RunoffOutcome =
  | { kind: 'winner'; winner: CategoryId; counts: RunoffCount[] }
  | { kind: 'roulette'; finalists: CategoryId[]; winner: CategoryId; counts: RunoffCount[] };

export type ResultPath =
  | 'no_cravings'
  | 'direct'
  | 'runoff'
  | 'roulette_after_skip'
  | 'roulette_after_runoff';

/** Resultado completo y privado: nunca sale del servidor tal cual. */
export type FullResult = {
  path: ResultPath;
  winner: CategoryId | null;
  stats: CategoryStat[];
  finalists: CategoryId[];
  runoffCounts: RunoffCount[] | null;
  votes: Vote[];
  runoffVotes: RunoffVote[];
};

export type IndividualVotes = {
  nickname: string;
  votes: { categoryId: CategoryId; value: VoteValue }[];
  runoffChoice: CategoryId | null;
};

/** Resultado filtrado por la configuración de visibilidad. `winner: null` = no hubo antojos. */
export type PublicResult = {
  winner: CategoryId | null;
  ranking?: CategoryId[];
  scores?: { categoryId: CategoryId; score: number }[];
  superCounts?: { categoryId: CategoryId; superCount: number }[];
  tiebreak?: { path: ResultPath; finalists: CategoryId[]; runoffCounts: RunoffCount[] | null };
  individualVotes?: IndividualVotes[];
};
