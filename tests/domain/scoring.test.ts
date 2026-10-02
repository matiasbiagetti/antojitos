import { describe, expect, it } from 'vitest';
import { computeStats, isWithinMargin, scoreRound } from '@/lib/domain/scoring';
import type { CategoryId, Vote, VoteValue } from '@/lib/domain/types';

const v = (participantId: string, categoryId: CategoryId, value: VoteValue): Vote => ({
  participantId,
  categoryId,
  value,
});
const firstRng = { next: () => 0 };

describe('computeStats', () => {
  it('applies weights 2 / 1 / 0 and counts supers', () => {
    const stats = computeStats([v('a', 'pizza', 'super'), v('b', 'pizza', 'yes'), v('c', 'pizza', 'no')]);
    const pizza = stats.find((s) => s.categoryId === 'pizza');
    expect(pizza).toEqual({ categoryId: 'pizza', score: 3, superCount: 1 });
    expect(stats[0].categoryId).toBe('pizza');
  });

  it('includes all 14 categories, unvoted ones with 0', () => {
    const stats = computeStats([]);
    expect(stats).toHaveLength(14);
    expect(stats.every((s) => s.score === 0 && s.superCount === 0)).toBe(true);
  });
});

describe('isWithinMargin: max(1, 20% of top)', () => {
  it.each([
    [3, 2, true], // 2 personas: ballotage
    [4, 2, false], // 2 personas: victoria directa
    [10, 7, false], // 6 personas: victoria directa
    [10, 8, true], // 6 personas: ballotage
    [20, 17, true], // 12 personas: ballotage
    [20, 15, false],
    [15, 12, true], // borde exacto del 20%
  ])('top %i vs %i -> %s', (top, score, expected) => {
    expect(isWithinMargin(top, score)).toBe(expected);
  });
});

describe('scoreRound', () => {
  it('returns no_cravings when nobody scored', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'no'), v('b', 'sushi', 'no')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome.kind).toBe('no_cravings');
  });

  it('direct win: 2 people, 4 vs 2', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'super'), v('b', 'pizza', 'super'), v('a', 'sushi', 'yes'), v('b', 'sushi', 'yes')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome).toMatchObject({ kind: 'winner', winner: 'pizza' });
  });

  it('a single positive vote wins directly (0-point categories are never finalists)', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'yes')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome).toMatchObject({ kind: 'winner', winner: 'pizza' });
  });

  it('runoff: 2 people, 3 vs 2, someone supports both finalists', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'super'), v('b', 'pizza', 'yes'), v('a', 'sushi', 'yes'), v('b', 'sushi', 'yes')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome.kind).toBe('runoff');
    if (outcome.kind !== 'runoff') return;
    expect([...outcome.finalists].sort()).toEqual(['pizza', 'sushi']);
  });

  it('caps finalists at 3, keeping the strictly higher scores', () => {
    // pizza 5, sushi 4, pasta 4, burgers 4 -> margen 1 -> 4 candidatas -> pizza + 2 de las 3 empatadas
    const votes = [
      v('a', 'pizza', 'super'), v('b', 'pizza', 'super'), v('c', 'pizza', 'yes'),
      v('a', 'sushi', 'yes'), v('b', 'sushi', 'yes'), v('c', 'sushi', 'yes'), v('d', 'sushi', 'yes'),
      v('a', 'pasta', 'yes'), v('b', 'pasta', 'yes'), v('c', 'pasta', 'yes'), v('d', 'pasta', 'yes'),
      v('a', 'burgers', 'yes'), v('b', 'burgers', 'yes'), v('c', 'burgers', 'yes'), v('d', 'burgers', 'yes'),
    ];
    const outcome = scoreRound({ votes, eligibleRunoffVoterIds: ['a', 'b', 'c', 'd'], rng: firstRng });
    expect(outcome.kind).toBe('runoff');
    if (outcome.kind !== 'runoff') return;
    expect(outcome.finalists).toHaveLength(3);
    expect(outcome.finalists).toContain('pizza');
    for (const id of outcome.finalists.filter((f) => f !== 'pizza')) {
      expect(['sushi', 'pasta', 'burgers']).toContain(id);
    }
  });

  it('when the cut falls inside a tie on the top score, all picks come from that tie', () => {
    // pizza 5, sushi 5, pasta 5, burgers 4 -> 4 candidatas -> las tres de 5
    const votes = [
      v('a', 'pizza', 'super'), v('b', 'pizza', 'super'), v('c', 'pizza', 'yes'),
      v('c', 'sushi', 'super'), v('d', 'sushi', 'super'), v('a', 'sushi', 'yes'),
      v('a', 'pasta', 'yes'), v('b', 'pasta', 'yes'), v('c', 'pasta', 'yes'), v('d', 'pasta', 'yes'), v('e', 'pasta', 'yes'),
      v('a', 'burgers', 'yes'), v('b', 'burgers', 'yes'), v('c', 'burgers', 'yes'), v('d', 'burgers', 'yes'),
    ];
    const outcome = scoreRound({ votes, eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e'], rng: firstRng });
    expect(outcome.kind).toBe('runoff');
    if (outcome.kind !== 'runoff') return;
    expect([...outcome.finalists].sort()).toEqual(['pasta', 'pizza', 'sushi']);
  });

  describe('skip-to-roulette rule (§6.3)', () => {
    const split3v3 = [
      v('a', 'pizza', 'yes'), v('b', 'pizza', 'yes'), v('c', 'pizza', 'yes'),
      v('d', 'sushi', 'yes'), v('e', 'sushi', 'yes'), v('f', 'sushi', 'yes'),
      v('a', 'sushi', 'no'), v('d', 'pizza', 'no'),
    ];

    it('goes straight to roulette when everyone supported exactly one finalist', () => {
      const outcome = scoreRound({
        votes: split3v3,
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        rng: firstRng,
      });
      expect(outcome.kind).toBe('roulette');
      if (outcome.kind !== 'roulette') return;
      expect([...outcome.finalists].sort()).toEqual(['pizza', 'sushi']);
      expect(outcome.finalists).toContain(outcome.winner);
    });

    it('holds a runoff if someone supported both finalists', () => {
      const outcome = scoreRound({
        votes: [...split3v3.filter((x) => !(x.participantId === 'a' && x.categoryId === 'sushi')), v('a', 'sushi', 'yes'), v('g', 'pizza', 'no')],
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        rng: firstRng,
      });
      // pizza 3, sushi 4 -> margen 1 -> ambas finalistas; 'a' apoya a las dos
      expect(outcome.kind).toBe('runoff');
    });

    it('holds a runoff if someone supported none (voted no or never reached the cards)', () => {
      const outcome = scoreRound({
        votes: [...split3v3, v('g', 'pizza', 'no')],
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        rng: firstRng,
      });
      expect(outcome.kind).toBe('runoff');
    });

    it('holds a runoff if a spectator is present (they voted nothing)', () => {
      const outcome = scoreRound({
        votes: split3v3,
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f', 'spectator'],
        rng: firstRng,
      });
      expect(outcome.kind).toBe('runoff');
    });
  });
});
