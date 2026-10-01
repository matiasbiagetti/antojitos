import { beforeEach, describe, expect, it } from 'vitest';
import { getMe, heartbeat, joinRoom, replay } from '@/lib/server/commands/rooms';
import { startRound } from '@/lib/server/commands/round';
import { at, countEvents, readSnapshot, resetDb, setupRoom, voteAll } from './helpers';

describe('host transfer', () => {
  beforeEach(resetDb);

  it('does not transfer before 30 s without signal', async () => {
    const { roomId, players } = await setupRoom(3);
    await heartbeat(roomId, players[1].token, at(30_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
  });

  it('transfers to the earliest-joined active participant after 30 s in the lobby', async () => {
    const { roomId, players } = await setupRoom(3);
    await heartbeat(roomId, players[2].token, at(20_000));
    await heartbeat(roomId, players[2].token, at(31_000));
    // P1 (players[1]) entró antes que P2 pero no da señal desde T0 -> el rol va a P2
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[2].participantId);
  });

  it('the original host does not get the role back when reconnecting', async () => {
    const { roomId, players } = await setupRoom(2);
    await heartbeat(roomId, players[1].token, at(31_000));
    await heartbeat(roomId, players[0].token, at(32_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[1].participantId);
    expect((await getMe(roomId, players[0].token, at(32_000))).isHost).toBe(false);
  });

  it('never transfers during voting (the round does not depend on the host)', async () => {
    const { roomId, players } = await setupRoom(2);
    await startRound(roomId, players[0].token, at(1_000));
    await heartbeat(roomId, players[1].token, at(45_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
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
