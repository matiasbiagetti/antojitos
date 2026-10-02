import { beforeEach, describe, expect, it } from 'vitest';
import { getMe, joinRoom } from '@/lib/server/commands/rooms';
import { castRunoffVote, castVote, closeIfDue, startRound } from '@/lib/server/commands/round';
import { sql } from '@/lib/server/db';
import { T0, at, countEvents, readSnapshot, resetDb, setupRoom, voteAll, TEST_AVATAR } from './helpers';

const START = at(1_000);
const VOTE = at(2_000);

async function startedRoom(players: number) {
  const room = await setupRoom(players);
  await startRound(room.roomId, room.players[0].token, START);
  return room;
}

describe('startRound', () => {
  beforeEach(resetDb);

  it('needs at least 2 participants', async () => {
    const { roomId, players } = await setupRoom(1);
    await expect(startRound(roomId, players[0].token, START)).rejects.toMatchObject({ code: 'NOT_ENOUGH_PLAYERS' });
  });

  it('only the host can start', async () => {
    const { roomId, players } = await setupRoom(2);
    await expect(startRound(roomId, players[1].token, START)).rejects.toMatchObject({ code: 'NOT_HOST' });
  });

  it('opens voting with a server deadline of roundSeconds', async () => {
    const { roomId } = await startedRoom(2);
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('voting');
    expect(snap.round).toMatchObject({ number: 1, deadline: at(61_000).toISOString(), voterCount: 2, finishedCount: 0 });
    expect(await countEvents(roomId, 'round_started')).toBe(1);
  });
});

describe('castVote', () => {
  beforeEach(resetDb);

  it('allows a single super per round', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'super' }, VOTE);
    await expect(
      castVote(roomId, players[0].token, { categoryId: 'sushi', value: 'super' }, VOTE),
    ).rejects.toMatchObject({ code: 'SUPER_ALREADY_USED' });
  });

  it('a retried vote is rejected as ALREADY_VOTED and not duplicated (Review Focus 2)', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'yes' }, VOTE);
    await expect(
      castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'yes' }, VOTE),
    ).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from votes where room_id = ${roomId}`;
    expect(n).toBe(1);
  });

  it('a vote after the deadline is rejected, not counted, and closes the round (Review Focus 1)', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'super' }, VOTE);
    await expect(
      castVote(roomId, players[1].token, { categoryId: 'pizza', value: 'super' }, at(61_000)),
    ).rejects.toMatchObject({ code: 'WRONG_PHASE' });
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('result');
    expect(snap.round?.result?.scores?.find((s) => s.categoryId === 'pizza')?.score).toBe(2);
  });

  it('rejects invalid input', async () => {
    const { roomId, players } = await startedRoom(2);
    await expect(castVote(roomId, players[0].token, { categoryId: 'tacos', value: 'yes' }, VOTE)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'maybe' }, VOTE)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('late joiners are spectators and cannot vote in the first round', async () => {
    const { roomId } = await startedRoom(2);
    const late = await joinRoom(roomId, { nickname: 'Late', avatarId: TEST_AVATAR }, at(5_000));
    expect((await getMe(roomId, late.token, at(5_000))).isSpectator).toBe(true);
    await expect(castVote(roomId, late.token, { categoryId: 'pizza', value: 'yes' }, VOTE)).rejects.toMatchObject({ code: 'SPECTATOR' });
    expect((await readSnapshot(roomId)).round?.spectatorIds).toEqual([late.participantId]);
  });

  it('closes immediately when every voter finished: direct win', async () => {
    const { roomId, players } = await startedRoom(2);
    await voteAll(roomId, players[0].token, { pizza: 'super', sushi: 'yes' }, VOTE);
    expect((await readSnapshot(roomId)).round?.finishedCount).toBe(1);
    await voteAll(roomId, players[1].token, { pizza: 'super', sushi: 'yes' }, VOTE);
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('result');
    expect(snap.round?.result).toMatchObject({ winner: 'pizza', tiebreak: { path: 'direct' } });
    expect(snap.round?.result?.individualVotes).toBeUndefined();
    expect(JSON.stringify(snap)).not.toContain('"value"');
    expect(await countEvents(roomId, 'round_resolved')).toBe(1);
  });

  it('no cravings when everybody said no', async () => {
    const { roomId, players } = await startedRoom(2);
    await voteAll(roomId, players[0].token, {}, VOTE);
    await voteAll(roomId, players[1].token, {}, VOTE);
    expect((await readSnapshot(roomId)).round?.result).toMatchObject({ winner: null, tiebreak: { path: 'no_cravings' } });
  });
});

describe('runoff and roulette', () => {
  beforeEach(resetDb);

  // 3 vs 2 con alguien que apoya a ambas -> ballotage pizza vs sushi
  async function roomInRunoff() {
    const room = await startedRoom(2);
    await voteAll(room.roomId, room.players[0].token, { pizza: 'super', sushi: 'yes' }, VOTE);
    await voteAll(room.roomId, room.players[1].token, { pizza: 'yes', sushi: 'yes' }, VOTE);
    return room;
  }

  it('goes to runoff with a 20 s deadline', async () => {
    const { roomId } = await roomInRunoff();
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('runoff');
    expect([...(snap.round?.finalists ?? [])].sort()).toEqual(['pizza', 'sushi']);
    expect(snap.round?.runoffDeadline).toBe(at(22_000).toISOString());
  });

  it('runoff winner when everyone voted', async () => {
    const { roomId, players } = await roomInRunoff();
    await castRunoffVote(roomId, players[0].token, { categoryId: 'sushi' }, at(3_000));
    await expect(castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(3_000))).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
    await expect(castRunoffVote(roomId, players[1].token, { categoryId: 'pasta' }, at(3_000))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await castRunoffVote(roomId, players[1].token, { categoryId: 'sushi' }, at(3_000));
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('result');
    expect(snap.round?.result).toMatchObject({ winner: 'sushi', tiebreak: { path: 'runoff' } });
  });

  it('a spectator who joins during the runoff can vote and counts toward "everyone voted" (Review Focus 5)', async () => {
    const { roomId, players } = await roomInRunoff();
    const late = await joinRoom(roomId, { nickname: 'Late', avatarId: TEST_AVATAR }, at(3_000));
    await castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(4_000));
    await castRunoffVote(roomId, players[1].token, { categoryId: 'sushi' }, at(4_000));
    expect((await readSnapshot(roomId)).phase).toBe('runoff');
    await castRunoffVote(roomId, late.token, { categoryId: 'pizza' }, at(4_000));
    expect((await readSnapshot(roomId)).round?.result?.winner).toBe('pizza');
  });

  it('runoff tie -> roulette -> result after the animation', async () => {
    const { roomId, players } = await roomInRunoff();
    await castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(3_000));
    await castRunoffVote(roomId, players[1].token, { categoryId: 'sushi' }, at(3_000));
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('roulette');
    expect(snap.round?.roulette?.endsAt).toBe(at(9_000).toISOString());
    expect(['pizza', 'sushi']).toContain(snap.round?.roulette?.winner);

    await closeIfDue(roomId, at(8_000));
    expect((await readSnapshot(roomId)).phase).toBe('roulette');
    await closeIfDue(roomId, at(9_000));
    const done = await readSnapshot(roomId);
    expect(done.phase).toBe('result');
    expect(done.round?.result).toMatchObject({ winner: snap.round?.roulette?.winner, tiebreak: { path: 'roulette_after_runoff' } });
  });

  it('runoff timer expiry closes it with the votes so far', async () => {
    const { roomId, players } = await roomInRunoff();
    await castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(3_000));
    await closeIfDue(roomId, at(22_000));
    expect((await readSnapshot(roomId)).round?.result?.winner).toBe('pizza');
  });

  it('skips the runoff when everyone supported exactly one finalist', async () => {
    const { roomId, players } = await startedRoom(2);
    await voteAll(roomId, players[0].token, { pizza: 'yes' }, VOTE);
    await voteAll(roomId, players[1].token, { sushi: 'yes' }, VOTE);
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('roulette');
    expect([...(snap.round?.roulette?.segments ?? [])].sort()).toEqual(['pizza', 'sushi']);
  });
});

describe('closeIfDue', () => {
  beforeEach(resetDb);

  it('does nothing before the deadline', async () => {
    const { roomId } = await startedRoom(2);
    await closeIfDue(roomId, at(60_999));
    expect((await readSnapshot(roomId)).phase).toBe('voting');
  });

  it('is idempotent under concurrent calls', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'super' }, VOTE);
    await Promise.all([closeIfDue(roomId, at(61_000)), closeIfDue(roomId, at(61_000)), closeIfDue(roomId, at(61_001))]);
    expect((await readSnapshot(roomId)).phase).toBe('result');
    expect(await countEvents(roomId, 'round_resolved')).toBe(1);
  });

  it('is a no-op in the lobby', async () => {
    const { roomId } = await setupRoom(2, T0);
    await closeIfDue(roomId, at(1_000));
    expect((await readSnapshot(roomId)).phase).toBe('lobby');
  });
});
