import { CATEGORY_IDS } from '@/lib/domain/categories';
import type { CategoryId, VoteValue } from '@/lib/domain/types';
import { createRoom, joinRoom } from '@/lib/server/commands/rooms';
import { castVote } from '@/lib/server/commands/round';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { sql } from '@/lib/server/db';

export const T0 = new Date('2026-10-01T20:00:00.000Z');
export const at = (ms: number) => new Date(T0.getTime() + ms);

export async function resetDb() {
  // Nunca truncar una base que no sea la local.
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`resetDb() se niega a truncar: DATABASE_URL apunta a "${host}", no a localhost/127.0.0.1`);
  }
  await sql`truncate rooms, events cascade`;
}

export type Player = { participantId: string; token: string };

/**
 * Crea una sala con el anfitrión ("Host") en `now` y `playerCount - 1` invitados ("P1", "P2", ...)
 * que entran 1 ms después cada uno, para que el orden de ingreso sea determinístico.
 */
export async function setupRoom(playerCount: number, now = T0): Promise<{ roomId: string; players: Player[] }> {
  const host = await createRoom({ nickname: 'Host' }, now);
  const players: Player[] = [{ participantId: host.participantId, token: host.token }];
  for (let i = 1; i < playerCount; i++) {
    const p = await joinRoom(host.roomId, { nickname: `P${i}` }, new Date(now.getTime() + i));
    players.push({ participantId: p.participantId, token: p.token });
  }
  return { roomId: host.roomId, players };
}

export async function readSnapshot(roomId: string): Promise<PublicSnapshot> {
  const [row] = await sql<{ snapshot: PublicSnapshot }[]>`select snapshot from room_public where room_id = ${roomId}`;
  return row.snapshot;
}

export async function countEvents(roomId: string, type: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from events where room_id = ${roomId} and type = ${type}`;
  return row.n;
}

/** Vota las 14 categorías: las de `choices` con su valor, el resto 'no'. */
export async function voteAll(
  roomId: string,
  token: string,
  choices: Partial<Record<CategoryId, VoteValue>>,
  now: Date,
): Promise<void> {
  for (const categoryId of CATEGORY_IDS) {
    await castVote(roomId, token, { categoryId, value: choices[categoryId] ?? 'no' }, now);
  }
}
