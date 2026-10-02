import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '@/lib/server/db';
import { T0, resetDb } from './helpers';

async function seed() {
  await sql`insert into rooms (id, created_at, expires_at, phase, config, current_round)
            values ('room0001', ${T0}, ${T0}, 'voting', '{}'::jsonb, 1)`;
  const [p] = await sql<{ id: string }[]>`
    insert into participants (room_id, nickname, nickname_key, avatar_id, token_hash, joined_at, last_seen_at)
    values ('room0001', 'Ana', 'ana', '1f600', 'hash-1', ${T0}, ${T0}) returning id`;
  await sql`insert into rounds (room_id, number, started_at, deadline) values ('room0001', 1, ${T0}, ${T0})`;
  await sql`insert into votes (room_id, round_number, participant_id, category_id, value)
            values ('room0001', 1, ${p.id}, 'pizza', 'super')`;
  await sql`insert into room_public (room_id, snapshot, version) values ('room0001', '{}'::jsonb, 1)`;
  await sql`insert into events (type, room_id) values ('room_created', 'room0001')`;
  return p.id;
}

async function anonCount(table: string): Promise<number> {
  try {
    return await sql.begin(async (tx) => {
      await tx`set local role anon`;
      const [row] = await tx.unsafe<{ n: number }[]>(`select count(*)::int as n from ${table}`);
      return row.n;
    });
  } catch (error) {
    if ((error as { code?: string }).code === '42501') return 0; // permission denied también es "no puede leer"
    throw error;
  }
}

describe('schema', () => {
  beforeEach(resetDb);

  it('anon can only read room_public', async () => {
    await seed();
    for (const table of ['rooms', 'participants', 'rounds', 'votes', 'runoff_votes', 'events']) {
      expect(await anonCount(table), table).toBe(0);
    }
    expect(await anonCount('room_public')).toBe(1);
  });

  it('allows only one super per participant and round', async () => {
    const participantId = await seed();
    await expect(
      sql`insert into votes (room_id, round_number, participant_id, category_id, value)
          values ('room0001', 1, ${participantId}, 'sushi', 'super')`,
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('deleting a room cascades to everything except events', async () => {
    await seed();
    await sql`delete from rooms where id = 'room0001'`;
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from votes`;
    expect(n).toBe(0);
    const [{ e }] = await sql<{ e: number }[]>`select count(*)::int as e from events`;
    expect(e).toBe(1);
  });
});
