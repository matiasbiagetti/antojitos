import { describe, expect, it } from 'vitest';
import { resultFromRound, resultFromRunoff } from '@/lib/domain/result';
import { computeStats } from '@/lib/domain/scoring';
import type { Vote } from '@/lib/domain/types';

const votes: Vote[] = [{ participantId: 'a', categoryId: 'pizza', value: 'yes' }];
const stats = computeStats(votes);

describe('resultFromRound', () => {
  it('maps no_cravings', () => {
    expect(resultFromRound({ kind: 'no_cravings', stats }, votes)).toMatchObject({
      path: 'no_cravings',
      winner: null,
      finalists: [],
      runoffCounts: null,
    });
  });

  it('maps a direct winner', () => {
    expect(resultFromRound({ kind: 'winner', winner: 'pizza', stats }, votes)).toMatchObject({
      path: 'direct',
      winner: 'pizza',
      votes,
    });
  });

  it('maps a roulette after skipping the runoff', () => {
    expect(
      resultFromRound({ kind: 'roulette', finalists: ['pizza', 'sushi'], winner: 'sushi', stats }, votes),
    ).toMatchObject({ path: 'roulette_after_skip', winner: 'sushi', finalists: ['pizza', 'sushi'] });
  });
});

describe('resultFromRunoff', () => {
  const first = { kind: 'runoff' as const, finalists: ['pizza' as const, 'sushi' as const], stats };
  const runoffVotes = [{ participantId: 'a', categoryId: 'pizza' as const }];

  it('maps a runoff winner', () => {
    const counts = [
      { categoryId: 'pizza' as const, votes: 1 },
      { categoryId: 'sushi' as const, votes: 0 },
    ];
    expect(resultFromRunoff(first, { kind: 'winner', winner: 'pizza', counts }, votes, runoffVotes)).toEqual({
      path: 'runoff',
      winner: 'pizza',
      stats,
      finalists: ['pizza', 'sushi'],
      runoffCounts: counts,
      votes,
      runoffVotes,
    });
  });

  it('maps a roulette after a tied runoff', () => {
    const counts = [
      { categoryId: 'pizza' as const, votes: 0 },
      { categoryId: 'sushi' as const, votes: 0 },
    ];
    expect(
      resultFromRunoff(first, { kind: 'roulette', finalists: ['pizza', 'sushi'], winner: 'pizza', counts }, votes, []),
    ).toMatchObject({ path: 'roulette_after_runoff', winner: 'pizza' });
  });
});
