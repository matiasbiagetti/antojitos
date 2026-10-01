import { describe, expect, it } from 'vitest';
import { dueAt } from '@/lib/client/use-room-timers';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import type { PublicSnapshot } from '@/lib/shared/api-types';

const base: PublicSnapshot = {
  roomId: 'room0001',
  version: 1,
  phase: 'lobby',
  expiresAt: '2026-10-01T21:00:00.000Z',
  hostParticipantId: 'p1',
  config: DEFAULT_CONFIG,
  participants: [],
};
const round = { number: 1, deadline: 'D', finishedCount: 0, voterCount: 2, spectatorIds: [] };

describe('dueAt', () => {
  it('lobby and result have nothing to close', () => {
    expect(dueAt(base)).toBeNull();
    expect(dueAt({ ...base, phase: 'result', round })).toBeNull();
  });

  it('picks the deadline of the current phase', () => {
    expect(dueAt({ ...base, phase: 'voting', round })).toBe('D');
    expect(dueAt({ ...base, phase: 'runoff', round: { ...round, runoffDeadline: 'R' } })).toBe('R');
    expect(dueAt({ ...base, phase: 'roulette', round: { ...round, roulette: { segments: [], winner: 'pizza', endsAt: 'E' } } })).toBe('E');
  });
});
