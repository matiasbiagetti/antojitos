import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import { createRoom, getMe, joinRoom, recordOpened, updateConfig } from '@/lib/server/commands/rooms';
import { sql } from '@/lib/server/db';
import { T0, TEST_AVATAR, at, countEvents, readSnapshot, resetDb, setupRoom } from './helpers';

describe('room commands', () => {
  beforeEach(resetDb);

  it('creates a room with the creator as host and publishes a snapshot', async () => {
    const s = await createRoom({ nickname: '  Juli  ', avatarId: '1f355' }, T0);
    expect(s.roomId).toMatch(/^[a-z0-9]{8}$/);
    const snap = await readSnapshot(s.roomId);
    expect(snap).toMatchObject({
      phase: 'lobby',
      hostParticipantId: s.participantId,
      config: DEFAULT_CONFIG,
      participants: [{ id: s.participantId, nickname: 'Juli', avatarId: '1f355' }],
      expiresAt: at(3_600_000).toISOString(),
    });
    expect(await countEvents(s.roomId, 'room_created')).toBe(1);
  });

  it('lets guests join and records the event', async () => {
    const { roomId } = await setupRoom(3);
    expect((await readSnapshot(roomId)).participants.map((p) => p.nickname)).toEqual(['Host', 'P1', 'P2']);
    expect(await countEvents(roomId, 'participant_joined')).toBe(2);
  });

  it('rejects the 16th participant', async () => {
    const { roomId } = await setupRoom(15);
    await expect(joinRoom(roomId, { nickname: 'Extra', avatarId: TEST_AVATAR }, T0)).rejects.toMatchObject({ code: 'ROOM_FULL' });
  });

  describe('nicknames (Review Focus 3)', () => {
    it('rejects duplicates ignoring case and surrounding spaces', async () => {
      const s = await createRoom({ nickname: 'Juli', avatarId: TEST_AVATAR }, T0);
      await expect(joinRoom(s.roomId, { nickname: ' juli ', avatarId: TEST_AVATAR }, T0)).rejects.toMatchObject({ code: 'NICKNAME_TAKEN' });
    });

    it.each([[''], ['   '], ['a'.repeat(21)], [42], [null]])('rejects %j', async (nickname) => {
      await expect(createRoom({ nickname }, T0)).rejects.toMatchObject({ code: 'INVALID_NICKNAME' });
    });

    it('accepts 20 emojis (counts code points, not UTF-16 units)', async () => {
      const s = await createRoom({ nickname: '🍕'.repeat(20), avatarId: TEST_AVATAR }, T0);
      expect((await readSnapshot(s.roomId)).participants[0].nickname).toBe('🍕'.repeat(20));
    });

    it('collapses inner whitespace', async () => {
      const s = await createRoom({ nickname: 'Juli    P', avatarId: TEST_AVATAR }, T0);
      expect((await readSnapshot(s.roomId)).participants[0].nickname).toBe('Juli P');
    });
  });

  it('rejects any action on an expired room', async () => {
    const s = await createRoom({ nickname: 'Host', avatarId: TEST_AVATAR }, T0);
    await expect(joinRoom(s.roomId, { nickname: 'Late', avatarId: TEST_AVATAR }, at(3_600_000))).rejects.toMatchObject({ code: 'ROOM_EXPIRED' });
  });

  it('rejects unknown rooms', async () => {
    await expect(joinRoom('nope0000', { nickname: 'A', avatarId: TEST_AVATAR }, T0)).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });

  it('getMe returns identity and role; rejects bad tokens', async () => {
    const { roomId, players } = await setupRoom(2);
    expect(await getMe(roomId, players[0].token, T0)).toEqual({
      participantId: players[0].participantId,
      nickname: 'Host',
      avatarId: TEST_AVATAR,
      isHost: true,
      roundNumber: 0,
      isSpectator: false,
      cardOrder: [],
      myVotes: [],
      myRunoffVote: null,
    });
    expect((await getMe(roomId, players[1].token, T0)).isHost).toBe(false);
    await expect(getMe(roomId, 'bad-token', T0)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    await expect(getMe(roomId, null, T0)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('records link opens even without a valid room', async () => {
    await recordOpened('whatever');
    expect(await countEvents('whatever', 'link_opened')).toBe(1);
  });

  describe('updateConfig', () => {
    const next = {
      visibility: { ...DEFAULT_CONFIG.visibility, showWhoVotedWhat: true },
      roundSeconds: 90,
    };

    it('the host can change it in the lobby and everyone sees it', async () => {
      const { roomId, players } = await setupRoom(2);
      await updateConfig(roomId, players[0].token, next, T0);
      expect((await readSnapshot(roomId)).config).toEqual(next);
    });

    it('guests cannot', async () => {
      const { roomId, players } = await setupRoom(2);
      await expect(updateConfig(roomId, players[1].token, next, T0)).rejects.toMatchObject({ code: 'NOT_HOST' });
    });

    it.each([
      [{ ...next, roundSeconds: 30 }],
      [{ ...next, visibility: { ...next.visibility, showRanking: 'yes' } }],
      [{ roundSeconds: 60 }],
    ])('rejects invalid config %j', async (bad) => {
      const { roomId, players } = await setupRoom(2);
      await expect(updateConfig(roomId, players[0].token, bad, T0)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });

  describe('avatars (Review Focus 1)', () => {
    it('stores the guest avatar and allows repeats', async () => {
      const s = await createRoom({ nickname: 'Ana', avatarId: '1f355' }, T0);
      await joinRoom(s.roomId, { nickname: 'Beto', avatarId: '1f355' }, T0);
      expect((await readSnapshot(s.roomId)).participants.map((p) => p.avatarId)).toEqual(['1f355', '1f355']);
    });

    it.each([[undefined], [''], ['nope'], [42], [null]])('createRoom rejects avatarId %j without creating anything', async (avatarId) => {
      await expect(createRoom({ nickname: 'Ana', avatarId }, T0)).rejects.toMatchObject({ code: 'INVALID_AVATAR' });
      const [row] = await sql<{ n: number }[]>`select count(*)::int as n from rooms`;
      expect(row.n).toBe(0);
    });

    it('joinRoom rejects a missing avatar without adding the participant', async () => {
      const s = await createRoom({ nickname: 'Ana', avatarId: TEST_AVATAR }, T0);
      await expect(joinRoom(s.roomId, { nickname: 'Beto' }, T0)).rejects.toMatchObject({ code: 'INVALID_AVATAR' });
      expect((await readSnapshot(s.roomId)).participants).toHaveLength(1);
    });
  });
});
