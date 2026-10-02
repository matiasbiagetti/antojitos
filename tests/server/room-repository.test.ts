import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import { sql } from '@/lib/server/db';
import {
  getRoom,
  getRound,
  insertParticipant,
  insertRoom,
  insertRound,
  insertVote,
  listParticipants,
  listVotes,
  nextPublicVersion,
  updateRound,
  upsertPublicSnapshot,
} from '@/lib/server/room-repository';
import { T0, at, resetDb } from './helpers';

async function makeRoom() {
  await insertRoom(sql, {
    id: 'room0001',
    createdAt: T0,
    expiresAt: at(3_600_000),
    phase: 'lobby',
    config: DEFAULT_CONFIG,
    hostParticipantId: null,
    currentRound: 0,
  });
}

describe('room-repository', () => {
  beforeEach(resetDb);

  it('round-trips a room with its jsonb config', async () => {
    await makeRoom();
    const room = await getRoom(sql, 'room0001');
    expect(room).toEqual({
      id: 'room0001',
      createdAt: T0,
      expiresAt: at(3_600_000),
      phase: 'lobby',
      config: DEFAULT_CONFIG,
      hostParticipantId: null,
      currentRound: 0,
    });
    expect(await getRoom(sql, 'missing')).toBeNull();
  });

  it('lists participants by join order', async () => {
    await makeRoom();
    await insertParticipant(sql, { roomId: 'room0001', nickname: 'B', nicknameKey: 'b', avatarId: '1f600', tokenHash: 'h2', now: at(10) });
    await insertParticipant(sql, { roomId: 'room0001', nickname: 'A', nicknameKey: 'a', avatarId: '1f600', tokenHash: 'h1', now: at(5) });
    expect((await listParticipants(sql, 'room0001')).map((p) => p.nickname)).toEqual(['A', 'B']);
  });

  it('stores votes and partial round updates', async () => {
    await makeRoom();
    const p = await insertParticipant(sql, { roomId: 'room0001', nickname: 'A', nicknameKey: 'a', avatarId: '1f600', tokenHash: 'h1', now: T0 });
    await insertRound(sql, { roomId: 'room0001', number: 1, startedAt: T0, deadline: at(60_000) });
    await insertVote(sql, 'room0001', 1, { participantId: p.id, categoryId: 'pizza', value: 'super' });
    expect(await listVotes(sql, 'room0001', 1)).toEqual([{ participantId: p.id, categoryId: 'pizza', value: 'super' }]);

    await updateRound(sql, 'room0001', 1, { runoffDeadline: at(80_000) });
    await updateRound(sql, 'room0001', 1, { roulette: { segments: ['pizza', 'sushi'], winner: 'sushi' } });
    const round = await getRound(sql, 'room0001', 1);
    expect(round?.runoffDeadline).toEqual(at(80_000));
    expect(round?.roulette).toEqual({ segments: ['pizza', 'sushi'], winner: 'sushi' });
    expect(round?.outcome).toBeNull();
  });

  it('increments the public snapshot version', async () => {
    await makeRoom();
    expect(await nextPublicVersion(sql, 'room0001')).toBe(1);
    await upsertPublicSnapshot(sql, 'room0001', 1, { roomId: 'room0001' } as never);
    expect(await nextPublicVersion(sql, 'room0001')).toBe(2);
  });
});
