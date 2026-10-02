import { CATEGORY_IDS, isCategoryId } from '@/lib/domain/categories';
import { canTransition } from '@/lib/domain/room-machine';
import type { CategoryId, Vote, VoteValue } from '@/lib/domain/types';
import type { ErrorCode } from '@/lib/shared/api-types';
import { AppError } from '../errors';
import { isSpectator } from '../public-snapshot';
import { requireHost, requireParticipant, requireRound, withRoomTx } from '../room-context';
import {
  insertEvent,
  insertRound,
  insertRunoffVote,
  insertVote,
  listParticipants,
  listRunoffVotes,
  listVotes,
  setRoomPhase,
  startRoomRound,
  type Participant,
  type Round,
} from '../room-repository';
import { MIN_PARTICIPANTS } from './rooms';
import { resolveRunoff, resolveVoting } from './resolve';

const VOTE_VALUES: VoteValue[] = ['super', 'yes', 'no'];

/** Algunas validaciones deben confirmar la transacción (p. ej. cerrar la ronda) y recién después rechazar. */
type Outcome = { rejected: ErrorCode | null };

function rejectIf(outcome: Outcome): { ok: true } {
  if (outcome.rejected) throw new AppError(outcome.rejected);
  return { ok: true };
}

function parseCategory(body: unknown): CategoryId {
  const categoryId = (body as { categoryId?: unknown } | null)?.categoryId;
  if (!isCategoryId(categoryId)) throw new AppError('INVALID_INPUT');
  return categoryId;
}

function parseVoteValue(body: unknown): VoteValue {
  const value = (body as { value?: unknown } | null)?.value;
  if (!VOTE_VALUES.includes(value as VoteValue)) throw new AppError('INVALID_INPUT');
  return value as VoteValue;
}

function allVotersFinished(participants: Participant[], round: Round, votes: Vote[]): boolean {
  const voters = participants.filter((p) => !isSpectator(p, round));
  return voters.every((p) => votes.filter((v) => v.participantId === p.id).length >= CATEGORY_IDS.length);
}

export async function startRound(roomId: string, token: string | null, now: Date): Promise<{ roundNumber: number }> {
  return withRoomTx(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    requireHost(room, me);
    if (!canTransition(room.phase, 'start')) throw new AppError('WRONG_PHASE');
    const participants = await listParticipants(tx, roomId);
    if (participants.length < MIN_PARTICIPANTS) throw new AppError('NOT_ENOUGH_PLAYERS');
    const number = room.currentRound + 1;
    await insertRound(tx, {
      roomId,
      number,
      startedAt: now,
      deadline: new Date(now.getTime() + room.config.roundSeconds * 1000),
    });
    await startRoomRound(tx, roomId, number);
    await insertEvent(tx, 'round_started', roomId, { round: number });
    return { roundNumber: number };
  });
}

export async function castVote(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }> {
  const categoryId = parseCategory(body);
  const value = parseVoteValue(body);
  const outcome = await withRoomTx<Outcome>(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    if (!canTransition(room.phase, 'vote')) return { rejected: 'WRONG_PHASE' };
    const round = await requireRound(tx, room);
    if (now.getTime() >= round.deadline.getTime()) {
      await resolveVoting(tx, room, round, now);
      return { rejected: 'WRONG_PHASE' };
    }
    if (isSpectator(me, round)) return { rejected: 'SPECTATOR' };

    const votes = await listVotes(tx, roomId, round.number);
    const mine = votes.filter((v) => v.participantId === me.id);
    if (mine.some((v) => v.categoryId === categoryId)) return { rejected: 'ALREADY_VOTED' };
    if (value === 'super' && mine.some((v) => v.value === 'super')) return { rejected: 'SUPER_ALREADY_USED' };

    const vote: Vote = { participantId: me.id, categoryId, value };
    await insertVote(tx, roomId, round.number, vote);
    const participants = await listParticipants(tx, roomId);
    if (allVotersFinished(participants, round, [...votes, vote])) await resolveVoting(tx, room, round, now);
    return { rejected: null };
  });
  return rejectIf(outcome);
}

export async function closeIfDue(roomId: string, now: Date): Promise<{ ok: true }> {
  await withRoomTx(roomId, now, async (tx, room) => {
    if (room.currentRound === 0) return;
    const round = await requireRound(tx, room);
    const t = now.getTime();
    if (canTransition(room.phase, 'close_voting') && t >= round.deadline.getTime()) {
      await resolveVoting(tx, room, round, now);
    } else if (canTransition(room.phase, 'close_runoff') && round.runoffDeadline && t >= round.runoffDeadline.getTime()) {
      await resolveRunoff(tx, room, round, now);
    } else if (canTransition(room.phase, 'finish_roulette') && round.rouletteEndsAt && t >= round.rouletteEndsAt.getTime()) {
      await setRoomPhase(tx, roomId, 'result');
    }
  });
  return { ok: true };
}

export async function castRunoffVote(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }> {
  const categoryId = parseCategory(body);
  const outcome = await withRoomTx<Outcome>(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    if (!canTransition(room.phase, 'runoff_vote')) return { rejected: 'WRONG_PHASE' };
    const round = await requireRound(tx, room);
    if (round.runoffDeadline && now.getTime() >= round.runoffDeadline.getTime()) {
      await resolveRunoff(tx, room, round, now);
      return { rejected: 'WRONG_PHASE' };
    }
    if (round.outcome?.kind !== 'runoff' || !round.outcome.finalists.includes(categoryId)) {
      return { rejected: 'INVALID_INPUT' };
    }
    const existing = await listRunoffVotes(tx, roomId, round.number);
    if (existing.some((v) => v.participantId === me.id)) return { rejected: 'ALREADY_VOTED' };

    await insertRunoffVote(tx, roomId, round.number, { participantId: me.id, categoryId });
    const participants = await listParticipants(tx, roomId);
    if (existing.length + 1 >= participants.length) await resolveRunoff(tx, room, round, now);
    return { rejected: null };
  });
  return rejectIf(outcome);
}
