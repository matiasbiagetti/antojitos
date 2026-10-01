import { describe, expect, it } from 'vitest';
import { scoreRunoff } from '@/lib/domain/runoff';

const firstRng = { next: () => 0 };

describe('scoreRunoff', () => {
  it('the most voted finalist wins', () => {
    const outcome = scoreRunoff({
      finalists: ['pizza', 'sushi'],
      runoffVotes: [
        { participantId: 'a', categoryId: 'pizza' },
        { participantId: 'b', categoryId: 'pizza' },
        { participantId: 'c', categoryId: 'sushi' },
      ],
      rng: firstRng,
    });
    expect(outcome).toEqual({
      kind: 'winner',
      winner: 'pizza',
      counts: [
        { categoryId: 'pizza', votes: 2 },
        { categoryId: 'sushi', votes: 1 },
      ],
    });
  });

  it('a tie at the top goes to roulette among the tied finalists only', () => {
    const outcome = scoreRunoff({
      finalists: ['pizza', 'sushi', 'pasta'],
      runoffVotes: [
        { participantId: 'a', categoryId: 'pizza' },
        { participantId: 'b', categoryId: 'sushi' },
      ],
      rng: firstRng,
    });
    expect(outcome.kind).toBe('roulette');
    if (outcome.kind !== 'roulette') return;
    expect(outcome.finalists).toEqual(['pizza', 'sushi']);
    expect(outcome.finalists).toContain(outcome.winner);
  });

  it('nobody voted: roulette among all finalists', () => {
    const outcome = scoreRunoff({ finalists: ['pizza', 'sushi'], runoffVotes: [], rng: firstRng });
    expect(outcome).toMatchObject({ kind: 'roulette', finalists: ['pizza', 'sushi'] });
  });

  it('ignores votes for non-finalists', () => {
    const outcome = scoreRunoff({
      finalists: ['pizza', 'sushi'],
      runoffVotes: [
        { participantId: 'a', categoryId: 'pasta' },
        { participantId: 'b', categoryId: 'sushi' },
      ],
      rng: firstRng,
    });
    expect(outcome).toMatchObject({ kind: 'winner', winner: 'sushi' });
  });
});
