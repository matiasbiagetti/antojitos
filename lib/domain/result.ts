import type { FullResult, RoundOutcome, RunoffOutcome, RunoffVote, Vote } from './types';

export function resultFromRound(
  outcome: Exclude<RoundOutcome, { kind: 'runoff' }>,
  votes: Vote[],
): FullResult {
  switch (outcome.kind) {
    case 'no_cravings':
      return { path: 'no_cravings', winner: null, stats: outcome.stats, finalists: [], runoffCounts: null, votes, runoffVotes: [] };
    case 'winner':
      return { path: 'direct', winner: outcome.winner, stats: outcome.stats, finalists: [], runoffCounts: null, votes, runoffVotes: [] };
    case 'roulette':
      return {
        path: 'roulette_after_skip',
        winner: outcome.winner,
        stats: outcome.stats,
        finalists: outcome.finalists,
        runoffCounts: null,
        votes,
        runoffVotes: [],
      };
  }
}

export function resultFromRunoff(
  first: Extract<RoundOutcome, { kind: 'runoff' }>,
  runoff: RunoffOutcome,
  votes: Vote[],
  runoffVotes: RunoffVote[],
): FullResult {
  return {
    path: runoff.kind === 'winner' ? 'runoff' : 'roulette_after_runoff',
    winner: runoff.winner,
    stats: first.stats,
    finalists: first.finalists,
    runoffCounts: runoff.counts,
    votes,
    runoffVotes,
  };
}
