import { describe, expect, it } from 'vitest';
import { HOST_ONLY_ACTIONS, canTransition, phaseAfterRound, phaseAfterRunoff } from '@/lib/domain/room-machine';

describe('canTransition', () => {
  it.each([
    ['lobby', 'config', true],
    ['lobby', 'start', true],
    ['lobby', 'vote', false],
    ['voting', 'vote', true],
    ['voting', 'close_voting', true],
    ['voting', 'start', false],
    ['voting', 'config', false],
    ['runoff', 'runoff_vote', true],
    ['runoff', 'close_runoff', true],
    ['runoff', 'vote', false],
    ['roulette', 'finish_roulette', true],
    ['result', 'replay', true],
    ['result', 'vote', false],
    ['result', 'config', false],
  ] as const)('%s + %s -> %s', (phase, action, expected) => {
    expect(canTransition(phase, action)).toBe(expected);
  });
});

describe('next phases', () => {
  it('after the first round', () => {
    expect(phaseAfterRound('winner')).toBe('result');
    expect(phaseAfterRound('no_cravings')).toBe('result');
    expect(phaseAfterRound('runoff')).toBe('runoff');
    expect(phaseAfterRound('roulette')).toBe('roulette');
  });

  it('after the runoff', () => {
    expect(phaseAfterRunoff('winner')).toBe('result');
    expect(phaseAfterRunoff('roulette')).toBe('roulette');
  });

  it('host-only actions', () => {
    expect([...HOST_ONLY_ACTIONS].sort()).toEqual(['config', 'replay', 'start']);
  });
});
