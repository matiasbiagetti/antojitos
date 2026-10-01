import { createRoom, joinRoom } from '@/lib/server/commands/rooms';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { sql } from '@/lib/server/db';

export const T0 = new Date('2026-10-01T20:00:00.000Z');
export const at = (ms: number) => new Date(T0.getTime() + ms);

export async function resetDb() {
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
