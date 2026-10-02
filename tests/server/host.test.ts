import { beforeEach, describe, expect, it } from 'vitest';
import { getMe, heartbeat, joinRoom, replay, takeHost } from '@/lib/server/commands/rooms';
import { startRound } from '@/lib/server/commands/round';
import { sql } from '@/lib/server/db';
import { at, countEvents, readSnapshot, resetDb, setupRoom, voteAll } from './helpers';

const version = async (roomId: string) => {
  const [row] = await sql<{ v: number }[]>`select version as v from room_public where room_id = ${roomId}`;
  return row.v;
};

describe('heartbeat', () => {
  beforeEach(resetDb);

  it('never changes the host and offers takeover to guests after 30 s of host silence', async () => {
    const { roomId, players } = await setupRoom(3);
    const res = await heartbeat(roomId, players[1].token, at(31_000));
    expect(res).toEqual({ hostParticipantId: players[0].participantId, canTakeHost: true });
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
  });

  it('canTakeHost is false for the host itself', async () => {
    const { roomId, players } = await setupRoom(2);
    expect((await heartbeat(roomId, players[0].token, at(31_000))).canTakeHost).toBe(false);
  });

  it('canTakeHost is false up to exactly 30 s', async () => {
    const { roomId, players } = await setupRoom(2);
    expect((await heartbeat(roomId, players[1].token, at(30_000))).canTakeHost).toBe(false);
  });

  it('canTakeHost is false during voting', async () => {
    const { roomId, players } = await setupRoom(2);
    await startRound(roomId, players[0].token, at(1_000));
    const res = await heartbeat(roomId, players[1].token, at(45_000));
    expect(res.canTakeHost).toBe(false);
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
  });

  it('does not bump the snapshot version', async () => {
    const { roomId, players } = await setupRoom(2);
    const before = await version(roomId);
    await heartbeat(roomId, players[1].token, at(31_000));
    expect(await version(roomId)).toBe(before);
  });
});

describe('takeHost', () => {
  beforeEach(resetDb);

  it('is rejected while the host is still active', async () => {
    const { roomId, players } = await setupRoom(2);
    await expect(takeHost(roomId, players[1].token, at(30_000))).rejects.toMatchObject({ code: 'HOST_STILL_ACTIVE' });
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
  });

  it('makes the caller host after 30 s of silence and bumps the snapshot', async () => {
    const { roomId, players } = await setupRoom(3);
    const before = await version(roomId);
    expect(await takeHost(roomId, players[2].token, at(31_000))).toEqual({ ok: true });
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[2].participantId);
    expect(await version(roomId)).toBeGreaterThan(before);
  });

  it('is rejected outside lobby/result', async () => {
    const { roomId, players } = await setupRoom(2);
    await startRound(roomId, players[0].token, at(1_000));
    await expect(takeHost(roomId, players[1].token, at(45_000))).rejects.toMatchObject({ code: 'WRONG_PHASE' });
  });

  it('is a no-op for the host itself', async () => {
    const { roomId, players } = await setupRoom(2);
    const before = await version(roomId);
    expect(await takeHost(roomId, players[0].token, at(31_000))).toEqual({ ok: true });
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
    expect(await version(roomId)).toBe(before);
  });

  it('lets exactly one of two concurrent takers win', async () => {
    const { roomId, players } = await setupRoom(3);
    const results = await Promise.allSettled([
      takeHost(roomId, players[1].token, at(31_000)),
      takeHost(roomId, players[2].token, at(31_000)),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'HOST_STILL_ACTIVE' });
    const winner = results[0].status === 'fulfilled' ? players[1] : players[2];
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(winner.participantId);
  });

  it('the original host stays host if nobody takes control', async () => {
    const { roomId, players } = await setupRoom(2);
    await heartbeat(roomId, players[1].token, at(31_000));
    await heartbeat(roomId, players[0].token, at(32_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
    expect((await getMe(roomId, players[0].token, at(32_000))).isHost).toBe(true);
  });

  it('the original host does not get the role back once someone took control', async () => {
    const { roomId, players } = await setupRoom(2);
    await takeHost(roomId, players[1].token, at(31_000));
    await heartbeat(roomId, players[0].token, at(32_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[1].participantId);
    expect((await getMe(roomId, players[0].token, at(32_000))).isHost).toBe(false);
  });
});

describe('replay', () => {
  beforeEach(resetDb);

  async function finishedRoom() {
    const room = await setupRoom(2);
    await startRound(room.roomId, room.players[0].token, at(1_000));
    await voteAll(room.roomId, room.players[0].token, { pizza: 'super' }, at(2_000));
    await voteAll(room.roomId, room.players[1].token, { pizza: 'super' }, at(2_000));
    return room;
  }

  it('only the host, only from result', async () => {
    const { roomId, players } = await finishedRoom();
    await expect(replay(roomId, players[1].token, at(3_000))).rejects.toMatchObject({ code: 'NOT_HOST' });
    await replay(roomId, players[0].token, at(3_000));
    expect((await readSnapshot(roomId)).phase).toBe('lobby');
    expect((await readSnapshot(roomId)).round).toBeUndefined();
    await expect(replay(roomId, players[0].token, at(3_000))).rejects.toMatchObject({ code: 'WRONG_PHASE' });
    expect(await countEvents(roomId, 'replay')).toBe(1);
  });

  it('someone who joined during the previous round votes normally in the next one', async () => {
    const { roomId, players } = await finishedRoom();
    const late = await joinRoom(roomId, { nickname: 'Late' }, at(2_500));
    await replay(roomId, players[0].token, at(3_000));
    await startRound(roomId, players[0].token, at(4_000));
    const me = await getMe(roomId, late.token, at(5_000));
    expect(me).toMatchObject({ roundNumber: 2, isSpectator: false });
    expect(me.cardOrder).toHaveLength(14);
  });
});
