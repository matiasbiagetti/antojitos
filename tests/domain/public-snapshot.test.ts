import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '@/lib/domain/categories';
import { resultFromRound } from '@/lib/domain/result';
import { computeStats } from '@/lib/domain/scoring';
import { DEFAULT_CONFIG, type Vote } from '@/lib/domain/types';
import { buildPublicSnapshot } from '@/lib/server/snapshot-builder';
import type { Participant, Room, Round } from '@/lib/server/room-repository';

const T0 = new Date('2026-10-01T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const room: Room = {
  id: 'room0001',
  createdAt: T0,
  expiresAt: at(3_600_000),
  phase: 'voting',
  config: DEFAULT_CONFIG,
  hostParticipantId: 'p1',
  currentRound: 1,
};
const participants: Participant[] = [
  { id: 'p1', roomId: 'room0001', nickname: 'Ana', joinedAt: T0, lastSeenAt: T0 },
  { id: 'p2', roomId: 'room0001', nickname: 'Beto', joinedAt: T0, lastSeenAt: T0 },
  { id: 'p3', roomId: 'room0001', nickname: 'Caro', joinedAt: at(5_000), lastSeenAt: at(5_000) },
];
const round: Round = {
  roomId: 'room0001',
  number: 1,
  startedAt: at(1_000),
  deadline: at(61_000),
  outcome: null,
  runoffDeadline: null,
  roulette: null,
  rouletteEndsAt: null,
  fullResult: null,
};
const allVotesOf = (participantId: string): Vote[] =>
  CATEGORY_IDS.map((categoryId) => ({ participantId, categoryId, value: categoryId === 'pizza' ? 'super' : 'no' }));

describe('buildPublicSnapshot', () => {
  it('in lobby has no round', () => {
    const snap = buildPublicSnapshot({ room: { ...room, phase: 'lobby', currentRound: 0 }, participants, round: null, votes: [], runoffVoteCount: 0, version: 3 });
    expect(snap).toEqual({
      roomId: 'room0001',
      version: 3,
      phase: 'lobby',
      expiresAt: at(3_600_000).toISOString(),
      hostParticipantId: 'p1',
      config: DEFAULT_CONFIG,
      participants: [
        { id: 'p1', nickname: 'Ana' },
        { id: 'p2', nickname: 'Beto' },
        { id: 'p3', nickname: 'Caro' },
      ],
    });
  });

  it('during voting reports progress and spectators but no votes', () => {
    const votes = [...allVotesOf('p1'), { participantId: 'p2', categoryId: 'pizza' as const, value: 'yes' as const }];
    const snap = buildPublicSnapshot({ room, participants, round, votes, runoffVoteCount: 0, version: 1 });
    expect(snap.round).toEqual({
      number: 1,
      deadline: at(61_000).toISOString(),
      finishedCount: 1,
      voterCount: 2,
      spectatorIds: ['p3'],
    });
    expect(JSON.stringify(snap)).not.toContain('"value"');
  });

  it('in result includes the filtered result and never individual votes by default', () => {
    const votes = [...allVotesOf('p1'), ...allVotesOf('p2')];
    const fullResult = resultFromRound({ kind: 'winner', winner: 'pizza', stats: computeStats(votes) }, votes);
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'result' },
      participants,
      round: { ...round, fullResult },
      votes,
      runoffVoteCount: 0,
      version: 9,
    });
    expect(snap.round?.result?.winner).toBe('pizza');
    expect(snap.round?.result?.individualVotes).toBeUndefined();
    expect(JSON.stringify(snap)).not.toContain('"value"');
  });

  it('who-voted-what lists voters and runoff voters but not spectators who did not vote', () => {
    const votes = [...allVotesOf('p1'), ...allVotesOf('p2')];
    const fullResult = resultFromRound({ kind: 'winner', winner: 'pizza', stats: computeStats(votes) }, votes);
    const config = { ...DEFAULT_CONFIG, visibility: { ...DEFAULT_CONFIG.visibility, showWhoVotedWhat: true } };
    const build = (runoffVotes: { participantId: string; categoryId: 'pizza' }[]) =>
      buildPublicSnapshot({
        room: { ...room, phase: 'result', config },
        participants,
        round: { ...round, fullResult: { ...fullResult, runoffVotes } },
        votes,
        runoffVoteCount: 0,
        version: 9,
      }).round?.result?.individualVotes?.map((v) => v.nickname);
    expect(build([])).toEqual(['Ana', 'Beto']);
    expect(build([{ participantId: 'p3', categoryId: 'pizza' }])).toEqual(['Ana', 'Beto', 'Caro']);
  });

  it('in runoff includes finalists, runoff deadline and how many voted', () => {
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'runoff' },
      participants,
      round: { ...round, outcome: { kind: 'runoff', finalists: ['pizza', 'sushi'], stats: computeStats([]) }, runoffDeadline: at(80_000) },
      votes: [],
      runoffVoteCount: 2,
      version: 4,
    });
    expect(snap.round).toMatchObject({ finalists: ['pizza', 'sushi'], runoffDeadline: at(80_000).toISOString(), runoffVotedCount: 2 });
  });

  it('in roulette includes segments, winner and end time', () => {
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'roulette' },
      participants,
      round: { ...round, roulette: { segments: ['pizza', 'sushi'], winner: 'sushi' }, rouletteEndsAt: at(70_000) },
      votes: [],
      runoffVoteCount: 0,
      version: 5,
    });
    expect(snap.round?.roulette).toEqual({ segments: ['pizza', 'sushi'], winner: 'sushi', endsAt: at(70_000).toISOString() });
  });
});
