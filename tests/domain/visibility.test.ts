import { describe, expect, it } from 'vitest';
import { resultFromRunoff } from '@/lib/domain/result';
import { computeStats } from '@/lib/domain/scoring';
import type { FullResult, Vote, VisibilityConfig } from '@/lib/domain/types';
import { toPublicResult } from '@/lib/domain/visibility';

const votes: Vote[] = [
  { participantId: 'id-ana', categoryId: 'pizza', value: 'super' },
  { participantId: 'id-ana', categoryId: 'sushi', value: 'yes' },
  { participantId: 'id-beto', categoryId: 'sushi', value: 'super' },
  { participantId: 'id-beto', categoryId: 'pizza', value: 'yes' },
];
const stats = computeStats(votes);
const full: FullResult = resultFromRunoff(
  { kind: 'runoff', finalists: ['pizza', 'sushi'], stats },
  {
    kind: 'winner',
    winner: 'pizza',
    counts: [
      { categoryId: 'pizza', votes: 2 },
      { categoryId: 'sushi', votes: 0 },
    ],
  },
  votes,
  [
    { participantId: 'id-ana', categoryId: 'pizza' },
    { participantId: 'id-beto', categoryId: 'pizza' },
  ],
);
const nicknames = { 'id-ana': 'Ana', 'id-beto': 'Beto' };
const allOff: VisibilityConfig = {
  showRanking: false,
  showScores: false,
  showSuperCounts: false,
  showTiebreakPath: false,
  showWhoVotedWhat: false,
};

describe('toPublicResult', () => {
  it('with everything off only the winner is visible', () => {
    expect(toPublicResult(full, allOff, nicknames)).toEqual({ winner: 'pizza' });
  });

  it('never leaks participant ids or nicknames unless showWhoVotedWhat is on', () => {
    const everythingButWho = { ...allOff, showRanking: true, showScores: true, showSuperCounts: true, showTiebreakPath: true };
    const json = JSON.stringify(toPublicResult(full, everythingButWho, nicknames));
    expect(json).not.toContain('id-ana');
    expect(json).not.toContain('id-beto');
    expect(json).not.toContain('Ana');
    expect(json).not.toContain('Beto');
  });

  it('showRanking adds all 14 categories in ranking order', () => {
    const out = toPublicResult(full, { ...allOff, showRanking: true }, nicknames);
    expect(out.ranking).toHaveLength(14);
    expect(out.ranking?.slice(0, 2).sort()).toEqual(['pizza', 'sushi']);
    expect(out.scores).toBeUndefined();
  });

  it('showScores adds scores, showSuperCounts adds super counts', () => {
    const out = toPublicResult(full, { ...allOff, showScores: true, showSuperCounts: true }, nicknames);
    expect(out.scores).toContainEqual({ categoryId: 'pizza', score: 3 });
    expect(out.superCounts).toContainEqual({ categoryId: 'sushi', superCount: 1 });
  });

  it('showTiebreakPath adds the path, finalists and runoff counts', () => {
    const out = toPublicResult(full, { ...allOff, showTiebreakPath: true }, nicknames);
    expect(out.tiebreak).toEqual({
      path: 'runoff',
      finalists: ['pizza', 'sushi'],
      runoffCounts: [
        { categoryId: 'pizza', votes: 2 },
        { categoryId: 'sushi', votes: 0 },
      ],
    });
  });

  it('showWhoVotedWhat adds individual votes by nickname, including the runoff choice', () => {
    const out = toPublicResult(full, { ...allOff, showWhoVotedWhat: true }, nicknames);
    expect(out.individualVotes).toEqual([
      {
        nickname: 'Ana',
        votes: [
          { categoryId: 'pizza', value: 'super' },
          { categoryId: 'sushi', value: 'yes' },
        ],
        runoffChoice: 'pizza',
      },
      {
        nickname: 'Beto',
        votes: [
          { categoryId: 'sushi', value: 'super' },
          { categoryId: 'pizza', value: 'yes' },
        ],
        runoffChoice: 'pizza',
      },
    ]);
    expect(JSON.stringify(out)).not.toContain('id-ana');
  });
});
