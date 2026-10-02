import postgres from 'postgres';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- postgres.js default type parameter
export type Db = postgres.Sql<{}>;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

const globalForDb = globalThis as unknown as { __antojitosSql?: Db };

let instance: Db | undefined;

/** Crea el pool en el primer uso: así el build no exige DATABASE_URL. */
function getSql(): Db {
  if (!instance) {
    /** prepare: false es necesario con el pooler de Supabase en modo transacción. */
    instance = globalForDb.__antojitosSql ?? postgres(databaseUrl(), { prepare: false, max: 5 });
    // Evita abrir un pool nuevo en cada hot reload de `next dev`.
    if (process.env.NODE_ENV === 'development') globalForDb.__antojitosSql = instance;
  }
  return instance;
}

/** Proxy perezoso con la misma API que el cliente de postgres.js (tagged template y métodos). */
export const sql: Db = new Proxy(function () {} as unknown as Db, {
  apply: (_target, _thisArg, args: unknown[]) => (getSql() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_target, prop) => {
    const value = Reflect.get(getSql() as object, prop);
    return typeof value === 'function' ? value.bind(getSql()) : value;
  },
});

export function asJson(value: unknown): postgres.JSONValue {
  return value as postgres.JSONValue;
}

/** Transacción tipada como Db: el tx de postgres.js expone la misma API de queries. */
export async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return (await sql.begin((tx) => fn(tx as unknown as Db))) as T;
}
