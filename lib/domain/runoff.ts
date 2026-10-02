import { pickOne, type Rng } from './random';
import type { CategoryId, RunoffOutcome, RunoffVote } from './types';

export function scoreRunoff(input: {
  finalists: CategoryId[];
  runoffVotes: RunoffVote[];
  rng: Rng;
}): RunoffOutcome {
  const counts = input.finalists.map((categoryId) => ({
    categoryId,
    votes: input.runoffVotes.filter((v) => v.categoryId === categoryId).length,
  }));
  const max = Math.max(...counts.map((c) => c.votes));
  const top = counts.filter((c) => c.votes === max).map((c) => c.categoryId);
  if (top.length === 1) return { kind: 'winner', winner: top[0], counts };
  return { kind: 'roulette', finalists: top, winner: pickOne(top, input.rng), counts };
}
