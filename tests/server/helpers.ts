import { sql } from '@/lib/server/db';

export const T0 = new Date('2026-10-01T20:00:00.000Z');
export const at = (ms: number) => new Date(T0.getTime() + ms);

export async function resetDb() {
  await sql`truncate rooms, events cascade`;
}
