import postgres from 'postgres';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- postgres.js default type parameter
export type Db = postgres.Sql<{}>;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

const globalForDb = globalThis as unknown as { __antojitosSql?: Db };

/** prepare: false es necesario con el pooler de Supabase en modo transacción. */
export const sql: Db = globalForDb.__antojitosSql ?? postgres(databaseUrl(), { prepare: false, max: 5 });

// Evita abrir un pool nuevo en cada hot reload de `next dev`.
if (process.env.NODE_ENV === 'development') globalForDb.__antojitosSql = sql;

export function asJson(value: unknown): postgres.JSONValue {
  return value as postgres.JSONValue;
}

/** Transacción tipada como Db: el tx de postgres.js expone la misma API de queries. */
export async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return (await sql.begin((tx) => fn(tx as unknown as Db))) as T;
}
