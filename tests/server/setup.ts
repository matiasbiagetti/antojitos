import { afterAll } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const dbHost = new URL(process.env.DATABASE_URL).hostname;
if (dbHost !== 'localhost' && dbHost !== '127.0.0.1') {
  throw new Error(`Los tests de servidor truncan tablas: DATABASE_URL apunta a "${dbHost}", no a localhost/127.0.0.1`);
}

afterAll(async () => {
  const { sql } = await import('@/lib/server/db');
  await sql.end();
});
