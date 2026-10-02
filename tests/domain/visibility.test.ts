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

describe('toPublicResult ordering without super counts', () => {
  it('orders tied scores by catalog order when showSuperCounts is off', async () => {
    const { CATEGORY_IDS } = await import('@/lib/domain/categories');
    const early = CATEGORY_IDS[0];
    const late = CATEGORY_IDS[1];
    // `late` tiene 1 súper (2 pts), `early` tiene 2 "me va" (2 pts): mismo puntaje, distinto súper.
    const tiedVotes: Vote[] = [
      { participantId: 'a', categoryId: late, value: 'super' },
      { participantId: 'a', categoryId: early, value: 'yes' },
      { participantId: 'b', categoryId: early, value: 'yes' },
    ];
    const tied = resultFromRunoff(
      { kind: 'runoff', finalists: [early, late], stats: computeStats(tiedVotes) },
      { kind: 'winner', winner: early, counts: [] },
      tiedVotes,
      [],
    );
    const off = toPublicResult(tied, { ...allOff, showRanking: true, showScores: true }, {});
    expect(off.ranking?.slice(0, 2)).toEqual([early, late]);
    expect(off.scores?.slice(0, 2).map((s) => s.categoryId)).toEqual([early, late]);
    const on = toPublicResult(tied, { ...allOff, showRanking: true, showSuperCounts: true }, {});
    expect(on.ranking?.slice(0, 2)).toEqual([late, early]);
  });
});
