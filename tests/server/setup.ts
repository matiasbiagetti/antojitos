import { afterAll } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

afterAll(async () => {
  const { sql } = await import('@/lib/server/db');
  await sql.end();
});
