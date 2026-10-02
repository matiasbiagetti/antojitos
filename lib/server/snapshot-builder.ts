import { CATEGORY_IDS } from '@/lib/domain/categories';
import type { Vote } from '@/lib/domain/types';
import { toPublicResult } from '@/lib/domain/visibility';
import type { PublicRound, PublicSnapshot } from '@/lib/shared/api-types';
import type { Participant, Room, Round } from './room-repository';

export function isSpectator(participant: Participant, round: Round): boolean {
  return participant.joinedAt.getTime() > round.startedAt.getTime();
}

export function buildPublicSnapshot(input: {
  room: Room;
  participants: Participant[];
  round: Round | null;
  votes: Vote[];
  runoffVoteCount: number;
  version: number;
}): PublicSnapshot {
  const { room, participants, round, votes } = input;
  const snapshot: PublicSnapshot = {
    roomId: room.id,
    version: input.version,
    phase: room.phase,
    expiresAt: room.expiresAt.toISOString(),
    hostParticipantId: room.hostParticipantId,
    config: room.config,
    participants: participants.map((p) => ({ id: p.id, nickname: p.nickname })),
  };
  if (!round || room.phase === 'lobby') return snapshot;

  const voters = participants.filter((p) => !isSpectator(p, round));
  const votesPerParticipant = new Map<string, number>();
  for (const v of votes) votesPerParticipant.set(v.participantId, (votesPerParticipant.get(v.participantId) ?? 0) + 1);

  const publicRound: PublicRound = {
    number: round.number,
    deadline: round.deadline.toISOString(),
    finishedCount: voters.filter((p) => (votesPerParticipant.get(p.id) ?? 0) >= CATEGORY_IDS.length).length,
    voterCount: voters.length,
    spectatorIds: participants.filter((p) => isSpectator(p, round)).map((p) => p.id),
  };

  if (round.outcome && (round.outcome.kind === 'runoff' || round.outcome.kind === 'roulette')) {
    publicRound.finalists = round.outcome.finalists;
  }
  if (room.phase === 'runoff' && round.runoffDeadline) {
    publicRound.runoffDeadline = round.runoffDeadline.toISOString();
    publicRound.runoffVotedCount = input.runoffVoteCount;
  }
  if (room.phase === 'roulette' && round.roulette && round.rouletteEndsAt) {
    publicRound.roulette = { ...round.roulette, endsAt: round.rouletteEndsAt.toISOString() };
  }
  if (room.phase === 'result' && round.fullResult) {
    // Solo quienes votaron en la ronda (más cualquiera que haya votado en el ballotage), no los espectadores.
    const included = new Set(voters.map((p) => p.id));
    for (const v of round.fullResult.runoffVotes) included.add(v.participantId);
    const nicknames = Object.fromEntries(participants.filter((p) => included.has(p.id)).map((p) => [p.id, p.nickname]));
    publicRound.result = toPublicResult(round.fullResult, room.config.visibility, nicknames);
  }
  snapshot.round = publicRound;
  return snapshot;
}
