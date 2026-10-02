import { phaseAfterRound, phaseAfterRunoff } from '@/lib/domain/room-machine';
import { cryptoRng } from '@/lib/domain/random';
import { resultFromRound, resultFromRunoff } from '@/lib/domain/result';
import { scoreRunoff } from '@/lib/domain/runoff';
import { scoreRound } from '@/lib/domain/scoring';
import type { FullResult } from '@/lib/domain/types';
import type { Db } from '../db';
import {
  insertEvent,
  listParticipants,
  listRunoffVotes,
  listVotes,
  setRoomPhase,
  updateRound,
  type Room,
  type Round,
} from '../room-repository';

export const RUNOFF_MS = 20_000;
export const ROULETTE_MS = 6_000;

const after = (now: Date, ms: number) => new Date(now.getTime() + ms);

async function logResolved(tx: Db, room: Room, round: Round, full: FullResult, now: Date) {
  await insertEvent(tx, 'round_resolved', room.id, {
    round: round.number,
    path: full.path,
    durationMs: now.getTime() - round.startedAt.getTime(),
  });
}

/** Cierra la primera vuelta. Llamar solo con la sala bloqueada y en fase `voting`. */
export async function resolveVoting(tx: Db, room: Room, round: Round, now: Date): Promise<void> {
  const participants = await listParticipants(tx, room.id);
  const votes = await listVotes(tx, room.id, round.number);
  // Todos los presentes pueden votar el ballotage: votantes de la ronda + espectadores.
  const outcome = scoreRound({ votes, eligibleRunoffVoterIds: participants.map((p) => p.id), rng: cryptoRng });

  if (outcome.kind === 'runoff') {
    await updateRound(tx, room.id, round.number, { outcome, runoffDeadline: after(now, RUNOFF_MS) });
  } else {
    const fullResult = resultFromRound(outcome, votes);
    if (outcome.kind === 'roulette') {
      await updateRound(tx, room.id, round.number, {
        outcome,
        fullResult,
        roulette: { segments: outcome.finalists, winner: outcome.winner },
        rouletteEndsAt: after(now, ROULETTE_MS),
      });
    } else {
      await updateRound(tx, room.id, round.number, { outcome, fullResult });
    }
    await logResolved(tx, room, round, fullResult, now);
  }
  await setRoomPhase(tx, room.id, phaseAfterRound(outcome.kind));
}

/** Cierra el ballotage. Llamar solo con la sala bloqueada y en fase `runoff`. */
export async function resolveRunoff(tx: Db, room: Room, round: Round, now: Date): Promise<void> {
  if (round.outcome?.kind !== 'runoff') throw new Error(`Round ${round.number} of ${room.id} has no runoff`);
  const votes = await listVotes(tx, room.id, round.number);
  const runoffVotes = await listRunoffVotes(tx, room.id, round.number);
  const runoff = scoreRunoff({ finalists: round.outcome.finalists, runoffVotes, rng: cryptoRng });
  const fullResult = resultFromRunoff(round.outcome, runoff, votes, runoffVotes);

  if (runoff.kind === 'roulette') {
    await updateRound(tx, room.id, round.number, {
      fullResult,
      roulette: { segments: runoff.finalists, winner: runoff.winner },
      rouletteEndsAt: after(now, ROULETTE_MS),
    });
  } else {
    await updateRound(tx, room.id, round.number, { fullResult });
  }
  await logResolved(tx, room, round, fullResult, now);
  await setRoomPhase(tx, room.id, phaseAfterRunoff(runoff.kind));
}
