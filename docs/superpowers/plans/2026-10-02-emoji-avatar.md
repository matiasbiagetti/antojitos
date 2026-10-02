# Avatar emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al elegir el apodo (crear sala o unirse), cada persona elige un avatar emoji (arte de Apple) de una lista propia, que se muestra en la sala de espera y en "Quién votó qué".

**Architecture:** Un script genera una vez el catálogo (`lib/domain/avatars.json`, `avatar-defaults.json`) y los PNG (`public/avatars/`) desde `emoji-datasource-apple`. El servidor valida y guarda `avatar_id` por participante y lo publica en la foto pública. El cliente elige un default al azar y abre un selector por pestañas cargado con `import()` dinámico.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind 4, Postgres (Supabase) vía `postgres`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-emoji-avatar-design.md` (producto: `docs/product-spec.md` §8 "Avatar").

## Global Constraints

- Identificadores de código en inglés; textos de interfaz en español rioplatense.
- Next.js de este repo tiene cambios incompatibles con versiones anteriores: antes de usar una API de Next (`next/dynamic`, `next/image`) leer la guía correspondiente en `node_modules/next/dist/docs/`.
- Catálogo: emojis con `has_img_apple`, sin categoría `Component`, sin `obsoleted_by`, sin variantes de género (`unified` contiene `200D-2640` o `200D-2642`), sin variantes de tono.
- Id del avatar = nombre del archivo `image` del paquete sin `.png` (p. ej. `1f355`).
- Default al azar entre `['smileys-emotion', 'animals-nature', 'food-drink']`.
- Los avatares se pueden repetir; no hay chequeo de unicidad.
- Error de avatar inválido o ausente: código `INVALID_AVATAR`, HTTP 400, mensaje `'Ese avatar no está disponible. Elegí otro.'`.
- La pantalla inicial no importa `lib/domain/avatars.ts` ni `avatars.json` (solo `avatar-defaults`).
- Sin cambios en votación, ballotage, ruleta ni en el aviso de "Tomar el control".
- Fuera de alcance: buscador, tonos de piel, avatares únicos, cambiar avatar después de entrar, fotos propias.

## Comandos

- Tests de dominio y cliente: `npm test` (Vitest, `tests/domain`, `tests/client`).
- Tests de servidor: `npm run test:server` — necesitan Supabase local (`npm run db:start`, luego `npm run db:reset` para aplicar migraciones) y `DATABASE_URL` en `.env.local` apuntando a localhost (ver `README.md`).
- `npm run typecheck`, `npm run lint`.
- E2E: `npm run test:e2e` (levanta la app según `playwright.config.ts`; necesita la base local).

## Review Focus

1. **Cliente viejo o request sin `avatarId`** (pestaña abierta durante un deploy): crear/unirse responde 400 `INVALID_AVATAR` y no crea sala ni participante. → Task 2.
2. **Hidratación:** el avatar al azar no puede generarse en el render del servidor; el formulario muestra un placeholder hasta montar y no hay errores de hidratación en consola. → Task 3 (e2e).
3. **Id del catálogo sin PNG** (o PNG de más): cada id de `avatars.json` tiene su archivo y el `avatar-defaults.json` es subconjunto del catálogo. → Task 1.
4. **Cerrar el selector sin elegir** (✕, Escape o tocar afuera) deja el avatar que estaba. → Task 3 (e2e).
5. **Recargar la página** conserva el avatar (sale de la foto pública, no del estado local). → Task 4 (e2e).

---

### Task 1: Catálogo de avatares generado + módulos de dominio

**Files:**
- Modify: `package.json` (devDependency `emoji-datasource-apple`)
- Create: `scripts/build-avatars.mjs`
- Create (generados, se commitean): `public/avatars/*.png`, `lib/domain/avatars.json`, `lib/domain/avatar-defaults.json`
- Create: `lib/domain/avatars.ts`, `lib/domain/avatar-defaults.ts`
- Create: `docs/avatars.md`
- Test: `tests/domain/avatars.test.ts`

**Interfaces:**
- Produces:
  - `lib/domain/avatars.ts`: `type AvatarCategory = { id: string; label: string; icon: string; avatars: string[] }`; `AVATAR_CATEGORIES: AvatarCategory[]`; `isAvatarId(value: unknown): value is string`; `avatarCategoryOf(id: string): string | undefined`.
  - `lib/domain/avatar-defaults.ts`: `DEFAULT_AVATAR_CATEGORIES: readonly string[]`; `randomDefaultAvatar(random?: () => number): string`; `avatarSrc(id: string): string`; `avatarChar(id: string): string`.
  - El id `'1f600'` (😀) existe en el catálogo y en los defaults; las tareas siguientes lo usan en tests.

- [ ] **Step 1: Instalar el paquete**

Run: `npm install --save-dev emoji-datasource-apple@16.0.0`
Expected: `package.json` y `package-lock.json` actualizados.

- [ ] **Step 2: Escribir el script**

`scripts/build-avatars.mjs`:

```js
// Genera el catálogo de avatares desde emoji-datasource-apple. Se corre a mano: node scripts/build-avatars.mjs
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve('emoji-datasource-apple/package.json'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// [categoría del paquete, id, label]; el orden es el de las pestañas.
const CATEGORIES = [
  ['Smileys & Emotion', 'smileys-emotion', 'Caritas'],
  ['People & Body', 'people-body', 'Personas'],
  ['Animals & Nature', 'animals-nature', 'Animales'],
  ['Food & Drink', 'food-drink', 'Comida'],
  ['Travel & Places', 'travel-places', 'Viajes'],
  ['Activities', 'activities', 'Actividades'],
  ['Objects', 'objects', 'Objetos'],
  ['Symbols', 'symbols', 'Símbolos'],
  ['Flags', 'flags', 'Banderas'],
];
const DEFAULT_CATEGORIES = ['smileys-emotion', 'animals-nature', 'food-drink'];
const GENDERED = /-200D-264[02]/;

const emojis = JSON.parse(await readFile(path.join(pkgDir, 'emoji.json'), 'utf8'));
const byName = new Map(CATEGORIES.map(([name]) => [name, []]));
for (const e of [...emojis].sort((a, b) => a.sort_order - b.sort_order)) {
  if (!e.has_img_apple || e.obsoleted_by || GENDERED.test(e.unified)) continue;
  byName.get(e.category)?.push(e.image); // Component y cualquier otra categoría quedan afuera
}

const outDir = path.join(root, 'public', 'avatars');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const categories = [];
for (const [name, id, label] of CATEGORIES) {
  const images = byName.get(name);
  for (const image of images) {
    await copyFile(path.join(pkgDir, 'img', 'apple', '64', image), path.join(outDir, image));
  }
  const avatars = images.map((image) => image.replace(/\.png$/, ''));
  categories.push({ id, label, icon: avatars[0], avatars });
}

await writeFile(path.join(root, 'lib', 'domain', 'avatars.json'), JSON.stringify({ categories }) + '\n');
const defaults = categories.filter((c) => DEFAULT_CATEGORIES.includes(c.id)).flatMap((c) => c.avatars);
await writeFile(path.join(root, 'lib', 'domain', 'avatar-defaults.json'), JSON.stringify(defaults) + '\n');
console.log(categories.map((c) => `${c.id}: ${c.avatars.length}`).join('\n'));
```

- [ ] **Step 3: Correr el script**

Run: `node scripts/build-avatars.mjs`
Expected: 9 líneas `id: N` con N > 0 (en total ~1.400–1.900), `public/avatars/` con los PNG, y los dos JSON creados.

- [ ] **Step 4: Escribir los tests que fallan**

`tests/domain/avatars.test.ts`:

```ts
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import defaults from '@/lib/domain/avatar-defaults.json';
import { avatarChar, avatarSrc, DEFAULT_AVATAR_CATEGORIES, randomDefaultAvatar } from '@/lib/domain/avatar-defaults';
import { AVATAR_CATEGORIES, avatarCategoryOf, isAvatarId } from '@/lib/domain/avatars';

const allIds = AVATAR_CATEGORIES.flatMap((c) => c.avatars);
const avatarsDir = path.join(process.cwd(), 'public', 'avatars');

describe('avatar catalog', () => {
  it('has the nine tabs in order, none empty, with an icon from its own list', () => {
    expect(AVATAR_CATEGORIES.map((c) => c.id)).toEqual([
      'smileys-emotion', 'people-body', 'animals-nature', 'food-drink', 'travel-places',
      'activities', 'objects', 'symbols', 'flags',
    ]);
    for (const c of AVATAR_CATEGORIES) {
      expect(c.avatars.length, c.id).toBeGreaterThan(0);
      expect(c.avatars).toContain(c.icon);
    }
  });

  it('has no duplicates and no gender variants', () => {
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.filter((id) => /200d-264[02]/.test(id))).toEqual([]);
  });

  it('has exactly one PNG per id (Review Focus 3)', () => {
    for (const id of allIds) expect(existsSync(path.join(avatarsDir, `${id}.png`)), id).toBe(true);
    expect(readdirSync(avatarsDir).length).toBe(allIds.length);
  });

  it('defaults are exactly the default categories', () => {
    const expected = AVATAR_CATEGORIES.filter((c) => DEFAULT_AVATAR_CATEGORIES.includes(c.id)).flatMap((c) => c.avatars);
    expect(defaults).toEqual(expected);
  });
});

describe('isAvatarId', () => {
  it('accepts catalog ids', () => {
    expect(isAvatarId('1f600')).toBe(true);
    expect(isAvatarId('1f355')).toBe(true);
  });

  it.each([[''], ['x'], ['1F600'], ['../1f600'], [1], [null], [undefined]])('rejects %j', (value) => {
    expect(isAvatarId(value)).toBe(false);
  });

  it('knows the category of an id', () => {
    expect(avatarCategoryOf('1f355')).toBe('food-drink');
    expect(avatarCategoryOf('nope')).toBeUndefined();
  });
});

describe('avatar defaults', () => {
  it('randomDefaultAvatar picks from the defaults, at both ends of the range', () => {
    expect(randomDefaultAvatar(() => 0)).toBe(defaults[0]);
    expect(randomDefaultAvatar(() => 0.999999)).toBe(defaults[defaults.length - 1]);
    for (let i = 0; i < 50; i++) {
      const id = randomDefaultAvatar();
      expect(DEFAULT_AVATAR_CATEGORIES).toContain(avatarCategoryOf(id));
    }
  });

  it('avatarSrc and avatarChar', () => {
    expect(avatarSrc('1f355')).toBe('/avatars/1f355.png');
    expect(avatarChar('1f355')).toBe('🍕');
    expect(avatarChar('1f468-200d-1f373')).toBe('👨‍🍳');
  });
});
```

- [ ] **Step 5: Correr y verificar que falla**

Run: `npx vitest run --config vitest.config.ts tests/domain/avatars.test.ts`
Expected: FAIL, no se resuelven `@/lib/domain/avatars` ni `@/lib/domain/avatar-defaults`.

- [ ] **Step 6: Implementar los módulos**

`lib/domain/avatars.ts`:

```ts
import catalog from './avatars.json';

/** Catálogo completo: solo lo importan el servidor y el selector (no la pantalla inicial). */
export type AvatarCategory = { id: string; label: string; icon: string; avatars: string[] };

export const AVATAR_CATEGORIES: AvatarCategory[] = catalog.categories;

const CATEGORY_BY_ID = new Map(AVATAR_CATEGORIES.flatMap((c) => c.avatars.map((id) => [id, c.id] as const)));

export const isAvatarId = (value: unknown): value is string => typeof value === 'string' && CATEGORY_BY_ID.has(value);

export const avatarCategoryOf = (id: string): string | undefined => CATEGORY_BY_ID.get(id);
```

`lib/domain/avatar-defaults.ts`:

```ts
import defaults from './avatar-defaults.json';

/** Liviano: lo usan el formulario y las pantallas sin cargar el catálogo completo. */
export const DEFAULT_AVATAR_CATEGORIES: readonly string[] = ['smileys-emotion', 'animals-nature', 'food-drink'];

export function randomDefaultAvatar(random: () => number = Math.random): string {
  return defaults[Math.min(defaults.length - 1, Math.floor(random() * defaults.length))];
}

export const avatarSrc = (id: string) => `/avatars/${id}.png`;

export const avatarChar = (id: string) => String.fromCodePoint(...id.split('-').map((hex) => parseInt(hex, 16)));
```

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npx vitest run --config vitest.config.ts tests/domain/avatars.test.ts`
Expected: PASS. Si `1f355` o `1f600` no están (no debería pasar), revisar el filtro del script, no el test.

- [ ] **Step 8: Documentar origen y licencia**

`docs/avatars.md`:

```markdown
# Avatares

Imágenes de emojis de Apple (PNG 64 px) tomadas del paquete npm
[`emoji-datasource-apple`](https://github.com/iamcal/emoji-data) 16.0.0.

**Licencia:** el código del paquete es MIT, pero el arte de los emojis es de Apple Inc. y **no
tiene licencia libre**. Usarlo fue una decisión del producto con el riesgo aceptado
(`docs/product-spec.md` §8). Para reemplazarlo por otro set, cambiar la fuente en
`scripts/build-avatars.mjs` y volver a correrlo.

## Regenerar

    node scripts/build-avatars.mjs

Genera `public/avatars/<id>.png`, `lib/domain/avatars.json` (pestañas y orden) y
`lib/domain/avatar-defaults.json` (ids elegibles como default al azar). Filtros: sin categoría
`Component`, sin emojis obsoletos, sin variantes de género ni de tono de piel.
```

- [ ] **Step 9: Typecheck, lint y commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: todo en verde.

```bash
git add package.json package-lock.json scripts/build-avatars.mjs public/avatars lib/domain/avatars.json lib/domain/avatar-defaults.json lib/domain/avatars.ts lib/domain/avatar-defaults.ts docs/avatars.md tests/domain/avatars.test.ts
git commit -m "feat(avatars): generate Apple emoji avatar catalog"
```

---

### Task 2: Guardar, validar y publicar `avatarId`

**Files:**
- Create: `supabase/migrations/20261002000000_participant_avatar.sql`
- Modify: `lib/shared/api-types.ts` (`ErrorCode`, `PublicSnapshot.participants`, `MeResponse`)
- Modify: `lib/server/errors.ts` (`INVALID_AVATAR: 400`)
- Modify: `lib/domain/types.ts` (`IndividualVotes.avatarId`)
- Modify: `lib/domain/visibility.ts` (`toPublicResult` recibe `people`)
- Modify: `lib/server/room-repository.ts` (`Participant`, `ParticipantRow`, `insertParticipant`, `select`s)
- Modify: `lib/server/snapshot-builder.ts`
- Modify: `lib/server/commands/rooms.ts` (`createRoom`, `joinRoom`, `getMe`)
- Modify: `lib/client/messages.ts` (`INVALID_AVATAR`)
- Test: `tests/domain/visibility.test.ts`, `tests/domain/public-snapshot.test.ts`, `tests/server/helpers.ts`, `tests/server/rooms.test.ts`, `tests/server/room-repository.test.ts`, `tests/server/schema.test.ts`, `tests/server/host.test.ts`, `tests/server/round.test.ts`

**Interfaces:**
- Consumes: `isAvatarId` de `lib/domain/avatars.ts` (Task 1). Id de prueba `'1f600'`.
- Produces:
  - Body de `POST /api/rooms` y `POST /api/rooms/[roomId]/join`: `{ nickname: string; avatarId: string }` (los route handlers ya pasan el body completo a `createRoom`/`joinRoom`; verificar en `app/api/rooms/route.ts` y `app/api/rooms/[roomId]/join/route.ts`).
  - `PublicSnapshot.participants: { id: string; nickname: string; avatarId: string }[]`.
  - `MeResponse.avatarId: string`.
  - `IndividualVotes = { nickname: string; avatarId: string; votes: …; runoffChoice: … }`.
  - `toPublicResult(full, visibility, people: Record<string, { nickname: string; avatarId: string }>)`.
  - `Participant = { id; roomId; nickname; avatarId: string; joinedAt; lastSeenAt }`.
  - `insertParticipant(db, { roomId, nickname, nicknameKey, avatarId, tokenHash, now })`.

- [ ] **Step 1: Migración**

`supabase/migrations/20261002000000_participant_avatar.sql`:

```sql
-- Avatar emoji por participante. El default solo rellena a participantes de salas ya abiertas.
alter table participants add column avatar_id text not null default '1f600';
alter table participants alter column avatar_id drop default;
```

Run: `npm run db:reset`
Expected: aplica ambas migraciones sin error.

- [ ] **Step 2: Actualizar tests de dominio (fallan)**

En `tests/domain/visibility.test.ts` reemplazar `const nicknames = …` por:

```ts
const people = {
  'id-ana': { nickname: 'Ana', avatarId: '1f355' },
  'id-beto': { nickname: 'Beto', avatarId: '1f600' },
};
```

reemplazar cada `nicknames` pasado a `toPublicResult` por `people`, y en el test `showWhoVotedWhat adds individual votes…` agregar `avatarId: '1f355'` al objeto de Ana y `avatarId: '1f600'` al de Beto en el `toEqual`. Cambiar el nombre del test a `'showWhoVotedWhat adds individual votes by nickname and avatar, including the runoff choice'`.

En `tests/domain/public-snapshot.test.ts` agregar `avatarId` a los participantes:

```ts
const participants: Participant[] = [
  { id: 'p1', roomId: 'room0001', nickname: 'Ana', avatarId: '1f355', joinedAt: T0, lastSeenAt: T0 },
  { id: 'p2', roomId: 'room0001', nickname: 'Beto', avatarId: '1f600', joinedAt: T0, lastSeenAt: T0 },
  { id: 'p3', roomId: 'room0001', nickname: 'Caro', avatarId: '1f600', joinedAt: at(5_000), lastSeenAt: at(5_000) },
];
```

y en el `toEqual` del snapshot de lobby:

```ts
      participants: [
        { id: 'p1', nickname: 'Ana', avatarId: '1f355' },
        { id: 'p2', nickname: 'Beto', avatarId: '1f600' },
        { id: 'p3', nickname: 'Caro', avatarId: '1f600' },
      ],
```

Agregar al final del `describe('buildPublicSnapshot')`:

```ts
  it('who-voted-what carries each voter avatar', () => {
    const votes = [...allVotesOf('p1'), ...allVotesOf('p2')];
    const fullResult = resultFromRound({ kind: 'winner', winner: 'pizza', stats: computeStats(votes) }, votes);
    const config = { ...DEFAULT_CONFIG, visibility: { ...DEFAULT_CONFIG.visibility, showWhoVotedWhat: true } };
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'result', config },
      participants,
      round: { ...round, fullResult },
      votes,
      runoffVoteCount: 0,
      version: 9,
    });
    expect(snap.round?.result?.individualVotes?.map((v) => [v.nickname, v.avatarId])).toEqual([
      ['Ana', '1f355'],
      ['Beto', '1f600'],
    ]);
  });
```

Run: `npm test`
Expected: FAIL (tipos/valores sin `avatarId`).

- [ ] **Step 3: Implementar dominio y builder**

`lib/domain/types.ts`, en `IndividualVotes`, agregar `avatarId: string;` debajo de `nickname: string;`.

`lib/domain/visibility.ts`:

```ts
type Person = { nickname: string; avatarId: string };

function individualVotes(full: FullResult, people: Record<string, Person>): IndividualVotes[] {
  return Object.entries(people)
    .map(([participantId, { nickname, avatarId }]) => ({
      nickname,
      avatarId,
      votes: full.votes
        .filter((v) => v.participantId === participantId)
        .map(({ categoryId, value }) => ({ categoryId, value })),
      runoffChoice: full.runoffVotes.find((v) => v.participantId === participantId)?.categoryId ?? null,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'es'));
}
```

y en `toPublicResult` renombrar el parámetro `nicknames: Record<string, string>` a `people: Record<string, Person>` y la llamada final a `individualVotes(full, people)`.

`lib/server/room-repository.ts`:

```ts
export type Participant = { id: string; roomId: string; nickname: string; avatarId: string; joinedAt: Date; lastSeenAt: Date };
type ParticipantRow = { id: string; room_id: string; nickname: string; avatar_id: string; joined_at: Date; last_seen_at: Date };
```

`toParticipant` agrega `avatarId: r.avatar_id,`. `insertParticipant`:

```ts
export async function insertParticipant(
  db: Db,
  p: { roomId: string; nickname: string; nicknameKey: string; avatarId: string; tokenHash: string; now: Date },
): Promise<Participant> {
  const [row] = await db<ParticipantRow[]>`
    insert into participants (room_id, nickname, nickname_key, avatar_id, token_hash, joined_at, last_seen_at)
    values (${p.roomId}, ${p.nickname}, ${p.nicknameKey}, ${p.avatarId}, ${p.tokenHash}, ${p.now}, ${p.now})
    returning id, room_id, nickname, avatar_id, joined_at, last_seen_at`;
  return toParticipant(row);
}
```

En `listParticipants` y `findParticipantByTokenHash` cambiar `select id, room_id, nickname, joined_at, last_seen_at` por `select id, room_id, nickname, avatar_id, joined_at, last_seen_at`. Buscar con `grep -n "nickname, joined_at" lib/server` que no quede ningún otro `select` de participantes sin `avatar_id`.

`lib/shared/api-types.ts`: agregar `| 'INVALID_AVATAR'` debajo de `'INVALID_NICKNAME'`; `participants: { id: string; nickname: string; avatarId: string }[];`; en `MeResponse` agregar `avatarId: string;` debajo de `nickname`.

`lib/server/snapshot-builder.ts`:

```ts
    participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, avatarId: p.avatarId })),
```

y en el bloque del resultado:

```ts
    const people = Object.fromEntries(
      participants.filter((p) => included.has(p.id)).map((p) => [p.id, { nickname: p.nickname, avatarId: p.avatarId }]),
    );
    publicRound.result = toPublicResult(round.fullResult, room.config.visibility, people);
```

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Actualizar tests de servidor (fallan)**

`tests/server/helpers.ts`: exportar `export const TEST_AVATAR = '1f600';` y en `setupRoom` pasar `{ nickname: 'Host', avatarId: TEST_AVATAR }` y `{ nickname: \`P${i}\`, avatarId: TEST_AVATAR }`.

Agregar `avatarId: TEST_AVATAR` (importado de `./helpers`) a **cada** llamada directa a `createRoom({ … })` / `joinRoom(…, { … })` en `tests/server/rooms.test.ts`, `host.test.ts` y `round.test.ts` (`grep -n "nickname:" tests/server`), salvo los tests nuevos de abajo que prueban la ausencia. En `room-repository.test.ts` agregar `avatarId: '1f600'` a cada `insertParticipant`. En `schema.test.ts`, el `insert into participants` del `seed` pasa a:

```ts
    insert into participants (room_id, nickname, nickname_key, avatar_id, token_hash, joined_at, last_seen_at)
    values ('room0001', 'Ana', 'ana', '1f600', 'hash-1', ${T0}, ${T0}) returning id`;
```

En `tests/server/rooms.test.ts`:
- El primer test (`creates a room…`) usa `createRoom({ nickname: '  Juli  ', avatarId: '1f355' }, T0)` y espera `participants: [{ id: s.participantId, nickname: 'Juli', avatarId: '1f355' }]`.
- El `toEqual` de `getMe` agrega `avatarId: TEST_AVATAR,` debajo de `nickname: 'Host',`.
- Agregar:

```ts
  describe('avatars (Review Focus 1)', () => {
    it('stores the guest avatar and allows repeats', async () => {
      const s = await createRoom({ nickname: 'Ana', avatarId: '1f355' }, T0);
      await joinRoom(s.roomId, { nickname: 'Beto', avatarId: '1f355' }, T0);
      expect((await readSnapshot(s.roomId)).participants.map((p) => p.avatarId)).toEqual(['1f355', '1f355']);
    });

    it.each([[undefined], [''], ['nope'], [42], [null]])('createRoom rejects avatarId %j without creating anything', async (avatarId) => {
      await expect(createRoom({ nickname: 'Ana', avatarId }, T0)).rejects.toMatchObject({ code: 'INVALID_AVATAR' });
      const [row] = await sql<{ n: number }[]>`select count(*)::int as n from rooms`;
      expect(row.n).toBe(0);
    });

    it('joinRoom rejects a missing avatar without adding the participant', async () => {
      const s = await createRoom({ nickname: 'Ana', avatarId: TEST_AVATAR }, T0);
      await expect(joinRoom(s.roomId, { nickname: 'Beto' }, T0)).rejects.toMatchObject({ code: 'INVALID_AVATAR' });
      expect((await readSnapshot(s.roomId)).participants).toHaveLength(1);
    });
  });
```

(importar `sql` de `@/lib/server/db` y `TEST_AVATAR` de `./helpers`).

Run: `npm run test:server`
Expected: FAIL (`INVALID_AVATAR` no existe, avatar no se guarda).

- [ ] **Step 5: Implementar validación y persistencia**

`lib/server/errors.ts`: `INVALID_AVATAR: 400,` debajo de `INVALID_NICKNAME`.

`lib/client/messages.ts`: `INVALID_AVATAR: 'Ese avatar no está disponible. Elegí otro.',` debajo de `INVALID_NICKNAME`.

`lib/server/commands/rooms.ts`:

```ts
import { isAvatarId } from '@/lib/domain/avatars';
```

reemplazar `nicknameFrom` por:

```ts
/** Valida apodo y avatar antes de abrir cualquier transacción. */
function identityFrom(body: unknown): { nickname: string; key: string; avatarId: string } {
  const value = body as { nickname?: unknown; avatarId?: unknown } | null;
  const { nickname, key } = normalizeNickname(value?.nickname);
  if (!isAvatarId(value?.avatarId)) throw new AppError('INVALID_AVATAR');
  return { nickname, key, avatarId: value.avatarId };
}
```

En `createRoom` y `joinRoom`: `const { nickname, key, avatarId } = identityFrom(body);` y pasar `avatarId` a `insertParticipant(tx, { roomId, nickname, nicknameKey: key, avatarId, tokenHash: hashToken(token), now })`. En `getMe` agregar `avatarId: me.avatarId,` debajo de `nickname: me.nickname,`.

- [ ] **Step 6: Verificar**

Run: `npm run test:server && npm test && npm run typecheck && npm run lint`
Expected: todo PASS. `typecheck` puede fallar en `components/` o `lib/client/api.ts` solo si algo depende de las firmas cambiadas; en ese caso corregir sin cambiar UI (la UI es Task 3/4).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations lib tests
git commit -m "feat(server): store, validate and publish participant avatar"
```

---

### Task 3: Selector de avatar en el formulario de apodo

**Files:**
- Create: `components/Avatar.tsx`
- Create: `components/AvatarPicker.tsx`
- Modify: `components/NicknameForm.tsx`
- Modify: `lib/client/api.ts` (`createRoom`, `joinRoom`)
- Modify: `app/page.tsx`, `components/RoomScreen.tsx` (pasan `avatarId`)
- Modify: `tests/e2e/helpers.ts`
- Test: `tests/e2e/avatar.spec.ts`

**Interfaces:**
- Consumes: `randomDefaultAvatar`, `avatarSrc`, `avatarChar` (`lib/domain/avatar-defaults.ts`); `AVATAR_CATEGORIES`, `avatarCategoryOf` (`lib/domain/avatars.ts`, **solo desde `AvatarPicker`**); body `{ nickname, avatarId }` (Task 2).
- Produces:
  - `<Avatar id: string; size: number; className?: string />`.
  - `<AvatarPicker selected: string; onSelect(id: string): void; onClose(): void />`.
  - `NicknameForm` prop `onSubmit: (nickname: string, avatarId: string) => Promise<void>`.
  - `createRoom(nickname: string, avatarId: string)`, `joinRoom(roomId: string, nickname: string, avatarId: string)`.

- [ ] **Step 1: Leer la documentación de Next**

Leer en `node_modules/next/dist/docs/` las guías de `next/dynamic` (lazy loading) y `next/image` (`unoptimized`). Usar las APIs tal como las describen.

- [ ] **Step 2: Escribir el e2e que falla**

`tests/e2e/avatar.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createRoomAs, joinAs, newPlayer } from './helpers';

test('picking an avatar shows it to the other players', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const hydrationErrors: string[] = [];
  host.on('console', (m) => {
    if (m.type() === 'error' && /hydrat/i.test(m.text())) hydrationErrors.push(m.text());
  });

  await host.goto('/');
  const avatarButton = host.getByRole('button', { name: 'Elegir avatar' });
  await expect(avatarButton.locator('img')).toHaveAttribute('src', /^\/avatars\/[0-9a-f-]+\.png$/);

  // Review Focus 4: cerrar sin elegir no cambia nada
  const before = await avatarButton.locator('img').getAttribute('src');
  await avatarButton.click();
  await expect(host.getByRole('dialog', { name: 'Elegí tu avatar' })).toBeVisible();
  await host.keyboard.press('Escape');
  await expect(host.getByRole('dialog')).toHaveCount(0);
  await expect(avatarButton.locator('img')).toHaveAttribute('src', before!);

  await avatarButton.click();
  await host.getByRole('tab', { name: 'Comida' }).click();
  await host.getByRole('button', { name: '🍕', exact: true }).click();
  await expect(host.getByRole('dialog')).toHaveCount(0);
  await expect(avatarButton.locator('img')).toHaveAttribute('src', '/avatars/1f355.png');

  await host.getByLabel('Tu apodo').fill('Ana');
  await host.getByRole('button', { name: 'Crear sala' }).click();
  await host.waitForURL(/\/j\/[a-z0-9]{8}$/);
  await joinAs(guest, host.url(), 'Beto');
  await expect(guest.getByText('Participantes (2/15)')).toBeVisible();
  expect(hydrationErrors).toEqual([]); // Review Focus 2
});
```

(Que el invitado vea el 🍕 de Ana en el lobby lo agrega Task 4. `createRoomAs` no se usa en este test; si el lint marca el import sin usar, quitarlo hasta Task 4.)

Run: `npm run test:e2e -- avatar.spec.ts`
Expected: FAIL (no existe el botón "Elegir avatar").

- [ ] **Step 3: `components/Avatar.tsx`**

```tsx
import Image from 'next/image';
import { avatarSrc } from '@/lib/domain/avatar-defaults';

/** Avatar emoji (PNG de Apple, ya comprimido): se sirve tal cual, sin optimización de Next. */
export function Avatar({ id, size, className = '' }: { id: string; size: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-secondary/20 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={avatarSrc(id)}
        alt=""
        width={Math.round(size * 0.75)}
        height={Math.round(size * 0.75)}
        unoptimized
        draggable={false}
      />
    </span>
  );
}
```

- [ ] **Step 4: `components/AvatarPicker.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { avatarChar, avatarSrc } from '@/lib/domain/avatar-defaults';
import { AVATAR_CATEGORIES, avatarCategoryOf } from '@/lib/domain/avatars';

/** Hoja inferior con todos los avatares por pestaña. Se carga con import() dinámico al abrirla. */
export function AvatarPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(() => avatarCategoryOf(selected) ?? AVATAR_CATEGORIES[0].id);
  const category = AVATAR_CATEGORIES.find((c) => c.id === tab) ?? AVATAR_CATEGORIES[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegí tu avatar"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-xl"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="font-extrabold">Elegí tu avatar</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="px-2 text-2xl leading-none">
            ✕
          </button>
        </div>
        <div role="tablist" className="flex gap-1 overflow-x-auto px-2 py-2">
          {AVATAR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === tab}
              aria-label={c.label}
              onClick={() => setTab(c.id)}
              className={`shrink-0 rounded-xl p-2 ${c.id === tab ? 'bg-secondary/30' : ''}`}
            >
              <Image src={avatarSrc(c.icon)} alt="" width={28} height={28} unoptimized />
            </button>
          ))}
        </div>
        <div key={tab} role="tabpanel" aria-label={category.label} className="grid flex-1 grid-cols-7 content-start gap-1 overflow-y-auto px-2 pb-4">
          {category.avatars.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={avatarChar(id)}
              aria-pressed={id === selected}
              onClick={() => onSelect(id)}
              className={`flex aspect-square items-center justify-center rounded-xl ${id === selected ? 'bg-primary/20 ring-2 ring-primary' : ''}`}
            >
              <Image src={avatarSrc(id)} alt="" width={40} height={40} loading="lazy" unoptimized />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

(`key={tab}` hace que la grilla vuelva arriba al cambiar de pestaña.)

- [ ] **Step 5: `components/NicknameForm.tsx`**

Cambios (mantener el resto igual):

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { randomDefaultAvatar } from '@/lib/domain/avatar-defaults';
import { messageFor } from '@/lib/client/messages';
import { Avatar } from './Avatar';

// El catálogo completo solo se descarga al abrir el selector.
const AvatarPicker = dynamic(() => import('./AvatarPicker').then((m) => m.AvatarPicker), { ssr: false });

export function NicknameForm({
  submitLabel,
  onSubmit,
}: {
  submitLabel: string;
  onSubmit: (nickname: string, avatarId: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el azar solo en el cliente, para no romper la hidratación
    setAvatarId(randomDefaultAvatar());
  }, []);

  const closePicker = useCallback(() => setPicking(false), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!avatarId) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(nickname, avatarId);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }
```

En el JSX, como primer hijo del `<form>`:

```tsx
      <button
        type="button"
        aria-label="Elegir avatar"
        onClick={() => setPicking(true)}
        disabled={busy || !avatarId}
        className="mx-auto flex flex-col items-center gap-1 disabled:opacity-50"
      >
        {avatarId ? <Avatar id={avatarId} size={80} /> : <span className="block size-20 rounded-full bg-ink/10" />}
        <span className="text-sm font-bold text-primary">Cambiar</span>
      </button>
```

el botón de submit pasa a `disabled={busy || !avatarId || nickname.trim() === ''}`, y al final del `<form>`:

```tsx
      {picking && avatarId && (
        <AvatarPicker
          selected={avatarId}
          onSelect={(id) => {
            setAvatarId(id);
            setPicking(false);
          }}
          onClose={closePicker}
        />
      )}
```

- [ ] **Step 6: Cablear API y pantallas**

`lib/client/api.ts`:

```ts
export const createRoom = (nickname: string, avatarId: string) =>
  call<SessionResponse>('POST', '/api/rooms', { body: { nickname, avatarId } });

export const joinRoom = (roomId: string, nickname: string, avatarId: string) =>
  call<SessionResponse>('POST', room(roomId, 'join'), { body: { nickname, avatarId } });
```

`app/page.tsx`: `onSubmit={async (nickname, avatarId) => { const session = await createRoom(nickname, avatarId); …`.

`components/RoomScreen.tsx`: `onSubmit={async (nickname, avatarId) => { const joined = await joinRoom(roomId, nickname, avatarId); …`.

Si `tests/client/api.test.ts` llama a `createRoom`/`joinRoom`, actualizar esas llamadas y el body esperado con `avatarId`.

- [ ] **Step 7: Verificar**

Run: `npm test && npm run typecheck && npm run lint && npm run test:e2e`
Expected: todo PASS, incluidos los flujos existentes (los helpers usan el avatar al azar sin tocarlo).

- [ ] **Step 8: Verificar que la pantalla inicial no carga el catálogo**

Run: `npm run build`, luego `grep -l "smileys-emotion" .next/static/chunks/*.js` (o la ruta de chunks que use esta versión).
Expected: el string aparece solo en el chunk del selector, no en el de la página `/`. Si no se puede distinguir por nombre de archivo, abrir `/` en el navegador con DevTools → Network y confirmar que el chunk con el catálogo solo se pide al tocar "Elegir avatar". Anotar el resultado en el reporte de la tarea.

- [ ] **Step 9: Commit**

```bash
git add components lib/client/api.ts app/page.tsx tests
git commit -m "feat(ui): pick an emoji avatar when choosing the nickname"
```

---

### Task 4: Mostrar el avatar en la sala de espera y en "Quién votó qué"

**Files:**
- Modify: `components/LobbyScreen.tsx` (chip de participante)
- Modify: `components/ResultScreen.tsx` (sección "Quién votó qué")
- Test: `tests/e2e/avatar.spec.ts`

**Interfaces:**
- Consumes: `<Avatar id size />` (Task 3); `snapshot.participants[].avatarId`, `result.individualVotes[].avatarId` (Task 2).

- [ ] **Step 1: Escribir el e2e que falla**

En el test `picking an avatar shows it to the other players`, justo antes de `expect(hydrationErrors)…`, agregar:

```ts
  await expect(guest.locator('li', { hasText: 'Ana' }).locator('img[src="/avatars/1f355.png"]')).toBeVisible();
```

Y agregar a `tests/e2e/avatar.spec.ts` (importar `createRoomAs` y `voteCards` de `./helpers`):

```ts
test('avatars survive a reload and show up in who-voted-what', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest, url, 'Beto');

  const anaChip = host.locator('li', { hasText: 'Ana' }).locator('img');
  await expect(anaChip).toHaveAttribute('src', /^\/avatars\//);
  const anaSrc = await anaChip.getAttribute('src');

  await host.reload(); // Review Focus 5
  await expect(host.locator('li', { hasText: 'Ana' }).locator('img')).toHaveAttribute('src', anaSrc!);

  await host.getByLabel('Quién votó qué').click();
  await host.getByRole('button', { name: 'Empezar' }).click();
  await Promise.all([voteCards(host, { pizza: 'super' }), voteCards(guest, { pizza: 'yes' })]);

  const whoVoted = guest.locator('section', { hasText: 'Quién votó qué' });
  await expect(whoVoted.locator('li', { hasText: 'Ana' }).locator(`img[src="${anaSrc}"]`)).toBeVisible();
});
```

Run: `npm run test:e2e -- avatar.spec.ts`
Expected: FAIL (el chip no tiene imagen).

- [ ] **Step 2: Lobby**

En `components/LobbyScreen.tsx` importar `import { Avatar } from './Avatar';` y reemplazar el `<li>` de participantes por:

```tsx
            <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-secondary/20 py-1 pl-1 pr-3 font-semibold">
              <Avatar id={p.avatarId} size={24} />
              {p.nickname}
              {p.id === snapshot.hostParticipantId && ' 👑'}
              {p.id === session.participantId && ' (vos)'}
            </li>
```

- [ ] **Step 3: Resultado**

En `components/ResultScreen.tsx` importar `Avatar` y reemplazar `<p className="font-bold">{person.nickname}</p>` por:

```tsx
                <p className="flex items-center gap-2 font-bold">
                  <Avatar id={person.avatarId} size={32} />
                  {person.nickname}
                </p>
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm run lint && npm test && npm run test:e2e`
Expected: todo PASS.

- [ ] **Step 5: Commit**

```bash
git add components/LobbyScreen.tsx components/ResultScreen.tsx tests/e2e/avatar.spec.ts
git commit -m "feat(ui): show participant avatars in lobby and who-voted-what"
```
