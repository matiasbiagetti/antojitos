import { transaction, type Db } from './db';
import { AppError } from './errors';
import { writePublicSnapshot } from './public-snapshot';
import { findParticipantByTokenHash, getRoom, getRound, type Participant, type Room, type Round } from './room-repository';
import { hashToken } from './tokens';

/**
 * Transacción con la fila de la sala bloqueada: serializa todos los comandos de una sala.
 * Si `fn` lanza, se hace rollback de todo.
 */
export async function withRoomTx<T>(
  roomId: string,
  now: Date,
  fn: (tx: Db, room: Room) => Promise<T>,
  opts: { snapshot?: boolean; lock?: boolean } = {},
): Promise<T> {
  return transaction(async (tx) => {
    const room = await getRoom(tx, roomId, { forUpdate: opts.lock !== false });
    if (!room) throw new AppError('ROOM_NOT_FOUND');
    if (room.expiresAt.getTime() <= now.getTime()) throw new AppError('ROOM_EXPIRED');
    const value = await fn(tx, room);
    if (opts.snapshot !== false) await writePublicSnapshot(tx, roomId);
    return value;
  });
}

export async function requireParticipant(db: Db, room: Room, token: string | null): Promise<Participant> {
  if (!token) throw new AppError('INVALID_TOKEN');
  const participant = await findParticipantByTokenHash(db, room.id, hashToken(token));
  if (!participant) throw new AppError('INVALID_TOKEN');
  return participant;
}

export function requireHost(room: Room, participant: Participant): void {
  if (room.hostParticipantId !== participant.id) throw new AppError('NOT_HOST');
}

export async function requireRound(db: Db, room: Room): Promise<Round> {
  const round = room.currentRound > 0 ? await getRound(db, room.id, room.currentRound) : null;
  if (!round) throw new Error(`Room ${room.id} has no round ${room.currentRound}`);
  return round;
}
