# Antojitos POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la POC de Antojitos: salas efímeras donde un grupo swipea categorías de comida en privado y la app calcula qué se come (victoria directa, ballotage o ruleta).

**Architecture:** Next.js (App Router) con un núcleo de dominio puro en `lib/domain/` (functional core), Route Handlers que son la única autoridad y escriben en Postgres con transacciones que bloquean la fila de la sala (server-authoritative), y una "foto pública" sanitizada por sala (`room_public`) a la que los clientes se suscriben por Supabase Realtime (CQRS liviano). Las fases de la sala son una máquina de estados explícita.

**Tech Stack:** Next.js + TypeScript + React, Tailwind CSS v4, Motion (`motion/react`, ex Framer Motion), Supabase (Postgres + Realtime + pg_cron), `postgres` (postgres.js) en el servidor, `@supabase/supabase-js` en el cliente, Vitest, Playwright, sharp (solo script de fotos).

**Spec:** `docs/product-spec.md` (fuente de verdad de producto) y `docs/superpowers/specs/2026-10-01-antojitos-poc-design.md` (diseño técnico). Leer ambos antes de empezar cualquier tarea.

## Global Constraints

- Todo identificador de código (tablas, columnas, archivos, funciones, tipos, fases, ids) en **inglés**. Todo texto visible al usuario en **español rioplatense** ("Me va", "Paso", "¿Qué se come?").
- Fuera de alcance, no implementar: filtros dietéticos, modalidades, platos/restaurantes, votación de postre, cuentas, historial, monetización.
- Pesos: Súper antojo = 2, Sí = 1, No = 0. Lo no votado = 0. Un solo Súper antojo por participante y ronda; no se reasigna ni se aplica hacia atrás.
- 14 categorías fijas: `pizza, burgers, sushi, pasta, empanadas, grill, milanesa, middle_eastern, mexican, chinese, peruvian, chicken, sandwiches, veggie`.
- Margen de empate: `max(1, 20% del puntaje de la primera)`; una categoría con 0 puntos nunca es finalista; máximo 3 finalistas (corte por puntaje, empate en el último lugar → sorteo en el servidor).
- Timer de ronda: 45 / 60 / 90 s, default 60. Ballotage: 20 s fijos. Ruleta: 6 s de animación.
- Grupo: mínimo 2, máximo 15, anfitrión incluido. Sala: dura 1 h desde su creación.
- Heartbeat cada 10 s; traspaso de anfitrión tras 30 s sin señal, solo en `lobby` o `result`, al participante con señal en los últimos 30 s que entró primero; no vuelve al original.
- Los votos individuales nunca salen del servidor salvo `showWhoVotedWhat = true` y fase `result`. Los clientes solo leen `room_public`.
- Toda decisión de tiempo la toma el servidor con su propia hora; los comandos reciben `now: Date` como parámetro (nunca se usa `now()` de SQL salvo en la purga).
- Paleta: primary `#FF5722`, secondary `#FFB300`, accent `#E91E63`, background `#FFFDF9`, ink `#1E1B18`. Mobile first.
- Node.js ≥ 20. Docker Desktop corriendo para Supabase local (tests de servidor y e2e).

## Review Focus

1. **Voto que llega después del deadline** (red lenta): se rechaza con `WRONG_PHASE`, no cuenta, y la ronda queda cerrada. → test en Task 10.
2. **Voto reintentado** (la respuesta se perdió pero el servidor lo guardó): no se duplica; el servidor responde `ALREADY_VOTED` y el cliente lo trata como éxito. → tests en Task 10 (servidor) y Task 12 (cliente).
3. **Apodos raros**: solo espacios, 21+ caracteres, emojis, mismo apodo con otras mayúsculas/espacios. Se rechaza vacío o > 20 code points, se aceptan 20 emojis, "Juli" y " juli " chocan. → tests en Task 9.
4. **Celular con el reloj desfasado**: la cuenta regresiva y el pedido de cierre usan la hora del servidor, no la del dispositivo. → test en Task 12.
5. **Espectador que entra durante el ballotage**: puede votar y cuenta para "votaron todos" (el ballotage no se cierra antes de que vote o venza el timer). → test en Task 10.

---

## File Structure

```
app/
  layout.tsx, globals.css, page.tsx               # Task 2 / Task 13
  j/[roomId]/page.tsx                             # Task 13
  api/rooms/route.ts                              # Task 9
  api/rooms/[roomId]/{join,config,opened}/route.ts, me/route.ts   # Task 9
  api/rooms/[roomId]/{start,vote,close,runoff-vote}/route.ts      # Task 10
  api/rooms/[roomId]/{heartbeat,replay}/route.ts                  # Task 11
components/
  Logo.tsx, NicknameForm.tsx, StatusScreen.tsx, RoomScreen.tsx,
  LobbyScreen.tsx, VisibilitySummary.tsx, HostControls.tsx       # Task 13
  Countdown.tsx, SwipeDeck.tsx, VotingScreen.tsx                 # Task 14
  RunoffScreen.tsx, RouletteScreen.tsx, ResultScreen.tsx         # Task 15
lib/domain/
  types.ts, categories.ts, random.ts, card-order.ts             # Task 2
  scoring.ts                                                     # Task 3
  runoff.ts, result.ts, room-machine.ts                          # Task 4
  visibility.ts                                                  # Task 5
lib/shared/api-types.ts                                          # Task 7
lib/server/
  db.ts                                                          # Task 6
  errors.ts, tokens.ts, http.ts, room-repository.ts              # Task 7
  snapshot-builder.ts, public-snapshot.ts, room-context.ts      # Task 8
  commands/rooms.ts                                              # Task 9 (+ Task 11)
  commands/resolve.ts, commands/round.ts                         # Task 10
lib/client/
  clock.ts, session-token.ts, api.ts, supabase-browser.ts,
  use-room.ts, use-room-timers.ts, messages.ts, swipe.ts         # Task 12
supabase/config.toml, supabase/migrations/20261001000000_init.sql   # Task 6
scripts/category-photos.json                                     # Task 1
scripts/convert-photos.mjs, public/categories/*.webp             # Task 14
docs/category-photos.md                                          # Task 1
docs/metrics.sql, README.md                                      # Task 16
tests/domain/*.test.ts, tests/client/*.test.ts                   # Vitest (sin DB)
tests/server/*.test.ts, tests/server/setup.ts, tests/server/helpers.ts   # Vitest (Supabase local)
tests/e2e/*.spec.ts, tests/e2e/helpers.ts, playwright.config.ts  # Playwright
vitest.config.ts, vitest.server.config.ts                        # Task 2 / Task 6
```

---

### Task 1: Propuesta de fotos por categoría (gate humano)

No hay código. El objetivo es que el usuario apruebe una foto por categoría antes de incorporarlas (spec §5.2, diseño §11).

**Files:**
- Create: `docs/category-photos.md`
- Create: `scripts/category-photos.json`

**Interfaces:**
- Produces: `scripts/category-photos.json` con forma `Record<CategoryId, { imageUrl: string; pageUrl: string; author: string; source: 'unsplash' | 'pexels' }>`, consumido por `scripts/convert-photos.mjs` en Task 14.

- [ ] **Step 1: Buscar una foto por categoría**

Para cada una de las 14 categorías buscar en Unsplash (`https://unsplash.com/s/photos/<término>`) o Pexels (`https://www.pexels.com/search/<término>/`) una foto que:
- muestre el plato de forma apetitosa, sin texto ni marcas visibles;
- funcione recortada en vertical 3:4 (el plato centrado);
- tenga licencia Unsplash License o Pexels License (uso libre, sin atribución obligatoria).

Términos sugeridos: pizza → "pizza", burgers → "burger", sushi → "sushi", pasta → "pasta", empanadas → "empanadas", grill → "asado parrilla", milanesa → "milanesa" / "schnitzel", middle_eastern → "shawarma falafel", mexican → "tacos", chinese → "chinese food", peruvian → "ceviche", chicken → "roast chicken", sandwiches → "sandwich", veggie → "salad bowl".

Para `imageUrl` usar la URL directa del archivo con ancho ≈ 1080 (Unsplash: `https://images.unsplash.com/photo-...?w=1080&q=80`; Pexels: `https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?w=1080`).

- [ ] **Step 2: Escribir `scripts/category-photos.json`**

```json
{
  "pizza": { "imageUrl": "<url directa>", "pageUrl": "<url de la página de la foto>", "author": "<autor>", "source": "unsplash" },
  "burgers": { "imageUrl": "...", "pageUrl": "...", "author": "...", "source": "..." }
}
```

Con las 14 claves exactas de la lista de Global Constraints.

- [ ] **Step 3: Escribir `docs/category-photos.md` para revisión**

```markdown
# Fotos propuestas por categoría

| Categoría | id | Vista previa | Autor | Fuente |
|---|---|---|---|---|
| Pizza | `pizza` | ![pizza](<imageUrl>) | <autor> | [Unsplash](<pageUrl>) |
...
```

- [ ] **Step 4: Pedir aprobación al usuario**

Mostrar el link a `docs/category-photos.md` y preguntar si aprueba todas o cuáles cambiar. Reemplazar las rechazadas y repetir hasta tener aprobación explícita de las 14. **No avanzar a Task 14 sin esta aprobación** (las tareas 2 a 13 sí pueden avanzar).

- [ ] **Step 5: Commit**

```bash
git add docs/category-photos.md scripts/category-photos.json
git commit -m "docs: approved category photos"
```

---

### Task 2: Scaffold del proyecto y dominio base (tipos, categorías, azar, orden de tarjetas)

**Files:**
- Create: proyecto Next.js en la raíz (`package.json`, `app/`, `tsconfig.json`, etc.)
- Modify: `app/globals.css`, `app/layout.tsx`, `package.json` (scripts)
- Create: `vitest.config.ts`, `.env.example`
- Create: `lib/domain/types.ts`, `lib/domain/categories.ts`, `lib/domain/random.ts`, `lib/domain/card-order.ts`
- Test: `tests/domain/random.test.ts`, `tests/domain/card-order.test.ts`

**Interfaces:**
- Produces (`lib/domain/types.ts`): `CategoryId`, `VoteValue`, `VOTE_WEIGHTS`, `RoomPhase`, `VisibilityConfig`, `RoundSeconds`, `ROUND_SECONDS_OPTIONS`, `RoomConfig`, `DEFAULT_CONFIG`, `Vote`, `RunoffVote`, `CategoryStat`, `RoundOutcome`, `RunoffCount`, `RunoffOutcome`, `ResultPath`, `FullResult`, `IndividualVotes`, `PublicResult`.
- Produces (`lib/domain/categories.ts`): `CATEGORIES`, `CATEGORY_IDS: readonly CategoryId[]`, `categoryName(id): string`, `categoryImage(id): string`, `isCategoryId(x: unknown): x is CategoryId`.
- Produces (`lib/domain/random.ts`): `interface Rng { next(): number }`, `seededRng(seed: number): Rng`, `hashSeed(text: string): number`, `cryptoRng: Rng`, `shuffle<T>(items: readonly T[], rng: Rng): T[]`, `pickOne<T>(items: readonly T[], rng: Rng): T`.
- Produces (`lib/domain/card-order.ts`): `cardOrder(participantId: string, roundNumber: number): CategoryId[]`.

- [ ] **Step 1: Crear la app Next.js en una carpeta temporal y moverla a la raíz**

`create-next-app` no acepta un directorio con archivos, así que se crea aparte y se mueve:

```bash
npx create-next-app@latest .tmp-app --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
rm -rf .tmp-app/.git
cp -r .tmp-app/. .
rm -rf .tmp-app
```

`README.md` queda sobrescrito; se reescribe en Task 16. Verificar que `.gitignore` incluya `.env*` (create-next-app lo incluye; si no, agregar `.env*` y `!.env.example`).

- [ ] **Step 2: Instalar dependencias**

```bash
npm install postgres @supabase/supabase-js motion
npm install -D vitest @playwright/test sharp supabase
```

- [ ] **Step 3: Agregar scripts en `package.json`**

Dentro de `"scripts"` agregar (sin borrar `dev`, `build`, `start`, `lint`):

```json
"test": "vitest run --config vitest.config.ts",
"test:server": "vitest run --config vitest.server.config.ts",
"test:e2e": "playwright test",
"typecheck": "tsc --noEmit",
"db:start": "supabase start",
"db:reset": "supabase db reset"
```

- [ ] **Step 4: Crear `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['tests/domain/**/*.test.ts', 'tests/client/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Paleta y tipografía**

Reemplazar `app/globals.css` completo por (Tailwind v4; si create-next-app generó un `tailwind.config.*` porque instaló v3, poner los mismos colores en `theme.extend.colors` y dejar solo las directivas `@tailwind` en el CSS):

```css
@import "tailwindcss";

@theme {
  --color-primary: #ff5722;
  --color-secondary: #ffb300;
  --color-accent: #e91e63;
  --color-background: #fffdf9;
  --color-ink: #1e1b18;
  --font-sans: var(--font-nunito), system-ui, sans-serif;
}

html,
body {
  background: var(--color-background);
  color: var(--color-ink);
}

body {
  overscroll-behavior: none;
}
```

Reemplazar `app/layout.tsx` completo por:

```tsx
import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: 'Antojitos',
  description: 'Menos vueltas, más sabor',
};

export const viewport: Viewport = {
  themeColor: '#FF5722',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
```

Borrar los SVG de ejemplo de `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) si existen. `app/page.tsx` se reescribe en Task 13; por ahora reemplazarlo por:

```tsx
export default function HomePage() {
  return <main className="p-4 text-primary">Antojitos</main>;
}
```

- [ ] **Step 6: Crear `.env.example`**

```bash
# Servidor: conexión directa a Postgres (local: valor de `npx supabase status`, DB URL)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Cliente: Supabase (local: API URL y anon key de `npx supabase status`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 7: Crear `lib/domain/types.ts`**

```ts
export type CategoryId =
  | 'pizza'
  | 'burgers'
  | 'sushi'
  | 'pasta'
  | 'empanadas'
  | 'grill'
  | 'milanesa'
  | 'middle_eastern'
  | 'mexican'
  | 'chinese'
  | 'peruvian'
  | 'chicken'
  | 'sandwiches'
  | 'veggie';

export type VoteValue = 'super' | 'yes' | 'no';

export const VOTE_WEIGHTS: Readonly<Record<VoteValue, number>> = { super: 2, yes: 1, no: 0 };

export type RoomPhase = 'lobby' | 'voting' | 'runoff' | 'roulette' | 'result';

export type VisibilityConfig = {
  showRanking: boolean;
  showScores: boolean;
  showSuperCounts: boolean;
  showTiebreakPath: boolean;
  showWhoVotedWhat: boolean;
};

export type RoundSeconds = 45 | 60 | 90;

export const ROUND_SECONDS_OPTIONS: readonly RoundSeconds[] = [45, 60, 90];

export type RoomConfig = { visibility: VisibilityConfig; roundSeconds: RoundSeconds };

export const DEFAULT_CONFIG: RoomConfig = {
  visibility: {
    showRanking: true,
    showScores: true,
    showSuperCounts: true,
    showTiebreakPath: true,
    showWhoVotedWhat: false,
  },
  roundSeconds: 60,
};

export type Vote = { participantId: string; categoryId: CategoryId; value: VoteValue };

export type RunoffVote = { participantId: string; categoryId: CategoryId };

export type CategoryStat = { categoryId: CategoryId; score: number; superCount: number };

export type RoundOutcome =
  | { kind: 'no_cravings'; stats: CategoryStat[] }
  | { kind: 'winner'; winner: CategoryId; stats: CategoryStat[] }
  | { kind: 'runoff'; finalists: CategoryId[]; stats: CategoryStat[] }
  | { kind: 'roulette'; finalists: CategoryId[]; winner: CategoryId; stats: CategoryStat[] };

export type RunoffCount = { categoryId: CategoryId; votes: number };

export type RunoffOutcome =
  | { kind: 'winner'; winner: CategoryId; counts: RunoffCount[] }
  | { kind: 'roulette'; finalists: CategoryId[]; winner: CategoryId; counts: RunoffCount[] };

export type ResultPath =
  | 'no_cravings'
  | 'direct'
  | 'runoff'
  | 'roulette_after_skip'
  | 'roulette_after_runoff';

/** Resultado completo y privado: nunca sale del servidor tal cual. */
export type FullResult = {
  path: ResultPath;
  winner: CategoryId | null;
  stats: CategoryStat[];
  finalists: CategoryId[];
  runoffCounts: RunoffCount[] | null;
  votes: Vote[];
  runoffVotes: RunoffVote[];
};

export type IndividualVotes = {
  nickname: string;
  votes: { categoryId: CategoryId; value: VoteValue }[];
  runoffChoice: CategoryId | null;
};

/** Resultado filtrado por la configuración de visibilidad. `winner: null` = no hubo antojos. */
export type PublicResult = {
  winner: CategoryId | null;
  ranking?: CategoryId[];
  scores?: { categoryId: CategoryId; score: number }[];
  superCounts?: { categoryId: CategoryId; superCount: number }[];
  tiebreak?: { path: ResultPath; finalists: CategoryId[]; runoffCounts: RunoffCount[] | null };
  individualVotes?: IndividualVotes[];
};
```

- [ ] **Step 8: Crear `lib/domain/categories.ts`**

```ts
import type { CategoryId } from './types';

export const CATEGORIES: readonly { id: CategoryId; name: string }[] = [
  { id: 'pizza', name: 'Pizza' },
  { id: 'burgers', name: 'Hamburguesas' },
  { id: 'sushi', name: 'Sushi' },
  { id: 'pasta', name: 'Pastas' },
  { id: 'empanadas', name: 'Empanadas' },
  { id: 'grill', name: 'Parrilla' },
  { id: 'milanesa', name: 'Milanesas' },
  { id: 'middle_eastern', name: 'Comida árabe' },
  { id: 'mexican', name: 'Mexicana' },
  { id: 'chinese', name: 'China' },
  { id: 'peruvian', name: 'Peruana' },
  { id: 'chicken', name: 'Pollo' },
  { id: 'sandwiches', name: 'Sándwiches' },
  { id: 'veggie', name: 'Veggie / Saludable' },
];

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));

export function categoryName(id: CategoryId): string {
  return NAMES.get(id) ?? id;
}

export function categoryImage(id: CategoryId): string {
  return `/categories/${id}.webp`;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && NAMES.has(value as CategoryId);
}
```

- [ ] **Step 9: Escribir los tests de `random` y `card-order` (fallan)**

`tests/domain/random.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cryptoRng, hashSeed, pickOne, seededRng, shuffle } from '@/lib/domain/random';

describe('seededRng', () => {
  it('is deterministic for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('returns numbers in [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('is stable and differs for different inputs', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });
});

describe('shuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRng(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('pickOne', () => {
  it('picks by rng position', () => {
    expect(pickOne(['a', 'b', 'c'], { next: () => 0 })).toBe('a');
    expect(pickOne(['a', 'b', 'c'], { next: () => 0.999 })).toBe('c');
  });

  it('throws on empty input', () => {
    expect(() => pickOne([], { next: () => 0 })).toThrow();
  });
});

describe('cryptoRng', () => {
  it('returns numbers in [0, 1)', () => {
    const n = cryptoRng.next();
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(1);
  });
});
```

`tests/domain/card-order.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cardOrder } from '@/lib/domain/card-order';
import { CATEGORY_IDS } from '@/lib/domain/categories';

describe('cardOrder', () => {
  it('is a permutation of the 14 categories', () => {
    const order = cardOrder('participant-1', 1);
    expect(order).toHaveLength(14);
    expect([...order].sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it('is deterministic for the same participant and round (survives reloads)', () => {
    expect(cardOrder('participant-1', 1)).toEqual(cardOrder('participant-1', 1));
  });

  it('changes between participants and between rounds', () => {
    expect(cardOrder('participant-1', 1)).not.toEqual(cardOrder('participant-2', 1));
    expect(cardOrder('participant-1', 1)).not.toEqual(cardOrder('participant-1', 2));
  });
});
```

- [ ] **Step 10: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL, "Failed to resolve import '@/lib/domain/random'" (y card-order).

- [ ] **Step 11: Implementar `lib/domain/random.ts`**

```ts
export interface Rng {
  /** Número en [0, 1). */
  next(): number;
}

/** mulberry32: rápido y determinístico. Solo para orden de tarjetas y tests. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** FNV-1a de 32 bits. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Azar real para sorteos (corte de finalistas, ruleta). */
export const cryptoRng: Rng = {
  next: () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
};

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pickOne: empty list');
  return items[Math.floor(rng.next() * items.length)];
}
```

- [ ] **Step 12: Implementar `lib/domain/card-order.ts`**

```ts
import { CATEGORY_IDS } from './categories';
import { hashSeed, seededRng, shuffle } from './random';
import type { CategoryId } from './types';

/** Orden de tarjetas por participante y ronda. Determinístico: recargar la página da el mismo orden. */
export function cardOrder(participantId: string, roundNumber: number): CategoryId[] {
  return shuffle(CATEGORY_IDS, seededRng(hashSeed(`${participantId}:${roundNumber}`)));
}
```

- [ ] **Step 13: Correr tests, typecheck, lint y build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: todos los tests PASS; typecheck, lint y build sin errores.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with domain types, categories and seeded randomness"
```

---

### Task 3: Cálculo de la primera vuelta (`scoring.ts`)

Implementa spec §6.1–§6.3: pesos, margen, finalistas (máx. 3) y regla de salto a ruleta.

**Files:**
- Create: `lib/domain/scoring.ts`
- Test: `tests/domain/scoring.test.ts`

**Interfaces:**
- Consumes: `Vote`, `CategoryStat`, `RoundOutcome`, `VOTE_WEIGHTS` (types.ts); `CATEGORY_IDS` (categories.ts); `Rng`, `shuffle`, `pickOne` (random.ts).
- Produces: `computeStats(votes: Vote[]): CategoryStat[]` (ordenado por puntaje desc, luego súper antojos desc, luego orden de `CATEGORY_IDS`); `isWithinMargin(topScore: number, score: number): boolean`; `scoreRound(input: { votes: Vote[]; eligibleRunoffVoterIds: string[]; rng: Rng }): RoundOutcome`.

- [ ] **Step 1: Escribir los tests (fallan)**

`tests/domain/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeStats, isWithinMargin, scoreRound } from '@/lib/domain/scoring';
import type { CategoryId, Vote, VoteValue } from '@/lib/domain/types';

const v = (participantId: string, categoryId: CategoryId, value: VoteValue): Vote => ({
  participantId,
  categoryId,
  value,
});
const firstRng = { next: () => 0 };

describe('computeStats', () => {
  it('applies weights 2 / 1 / 0 and counts supers', () => {
    const stats = computeStats([v('a', 'pizza', 'super'), v('b', 'pizza', 'yes'), v('c', 'pizza', 'no')]);
    const pizza = stats.find((s) => s.categoryId === 'pizza');
    expect(pizza).toEqual({ categoryId: 'pizza', score: 3, superCount: 1 });
    expect(stats[0].categoryId).toBe('pizza');
  });

  it('includes all 14 categories, unvoted ones with 0', () => {
    const stats = computeStats([]);
    expect(stats).toHaveLength(14);
    expect(stats.every((s) => s.score === 0 && s.superCount === 0)).toBe(true);
  });
});

describe('isWithinMargin: max(1, 20% of top)', () => {
  it.each([
    [3, 2, true], // 2 personas: ballotage
    [4, 2, false], // 2 personas: victoria directa
    [10, 7, false], // 6 personas: victoria directa
    [10, 8, true], // 6 personas: ballotage
    [20, 17, true], // 12 personas: ballotage
    [20, 15, false],
    [15, 12, true], // borde exacto del 20%
  ])('top %i vs %i -> %s', (top, score, expected) => {
    expect(isWithinMargin(top, score)).toBe(expected);
  });
});

describe('scoreRound', () => {
  it('returns no_cravings when nobody scored', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'no'), v('b', 'sushi', 'no')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome.kind).toBe('no_cravings');
  });

  it('direct win: 2 people, 4 vs 2', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'super'), v('b', 'pizza', 'super'), v('a', 'sushi', 'yes'), v('b', 'sushi', 'yes')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome).toMatchObject({ kind: 'winner', winner: 'pizza' });
  });

  it('a single positive vote wins directly (0-point categories are never finalists)', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'yes')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome).toMatchObject({ kind: 'winner', winner: 'pizza' });
  });

  it('runoff: 2 people, 3 vs 2, someone supports both finalists', () => {
    const outcome = scoreRound({
      votes: [v('a', 'pizza', 'super'), v('b', 'pizza', 'yes'), v('a', 'sushi', 'yes'), v('b', 'sushi', 'yes')],
      eligibleRunoffVoterIds: ['a', 'b'],
      rng: firstRng,
    });
    expect(outcome.kind).toBe('runoff');
    if (outcome.kind !== 'runoff') return;
    expect([...outcome.finalists].sort()).toEqual(['pizza', 'sushi']);
  });

  it('caps finalists at 3, keeping the strictly higher scores', () => {
    // pizza 5, sushi 4, pasta 4, burgers 4 -> margen 1 -> 4 candidatas -> pizza + 2 de las 3 empatadas
    const votes = [
      v('a', 'pizza', 'super'), v('b', 'pizza', 'super'), v('c', 'pizza', 'yes'),
      v('a', 'sushi', 'yes'), v('b', 'sushi', 'yes'), v('c', 'sushi', 'yes'), v('d', 'sushi', 'yes'),
      v('a', 'pasta', 'yes'), v('b', 'pasta', 'yes'), v('c', 'pasta', 'yes'), v('d', 'pasta', 'yes'),
      v('a', 'burgers', 'yes'), v('b', 'burgers', 'yes'), v('c', 'burgers', 'yes'), v('d', 'burgers', 'yes'),
    ];
    const outcome = scoreRound({ votes, eligibleRunoffVoterIds: ['a', 'b', 'c', 'd'], rng: firstRng });
    expect(outcome.kind).toBe('runoff');
    if (outcome.kind !== 'runoff') return;
    expect(outcome.finalists).toHaveLength(3);
    expect(outcome.finalists).toContain('pizza');
    for (const id of outcome.finalists.filter((f) => f !== 'pizza')) {
      expect(['sushi', 'pasta', 'burgers']).toContain(id);
    }
  });

  it('when the cut falls inside a tie on the top score, all picks come from that tie', () => {
    // pizza 5, sushi 5, pasta 5, burgers 4 -> 4 candidatas -> las tres de 5
    const votes = [
      v('a', 'pizza', 'super'), v('b', 'pizza', 'super'), v('c', 'pizza', 'yes'),
      v('c', 'sushi', 'super'), v('d', 'sushi', 'super'), v('a', 'sushi', 'yes'),
      v('a', 'pasta', 'yes'), v('b', 'pasta', 'yes'), v('c', 'pasta', 'yes'), v('d', 'pasta', 'yes'), v('e', 'pasta', 'yes'),
      v('a', 'burgers', 'yes'), v('b', 'burgers', 'yes'), v('c', 'burgers', 'yes'), v('d', 'burgers', 'yes'),
    ];
    const outcome = scoreRound({ votes, eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e'], rng: firstRng });
    expect(outcome.kind).toBe('runoff');
    if (outcome.kind !== 'runoff') return;
    expect([...outcome.finalists].sort()).toEqual(['pasta', 'pizza', 'sushi']);
  });

  describe('skip-to-roulette rule (§6.3)', () => {
    const split3v3 = [
      v('a', 'pizza', 'yes'), v('b', 'pizza', 'yes'), v('c', 'pizza', 'yes'),
      v('d', 'sushi', 'yes'), v('e', 'sushi', 'yes'), v('f', 'sushi', 'yes'),
      v('a', 'sushi', 'no'), v('d', 'pizza', 'no'),
    ];

    it('goes straight to roulette when everyone supported exactly one finalist', () => {
      const outcome = scoreRound({
        votes: split3v3,
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        rng: firstRng,
      });
      expect(outcome.kind).toBe('roulette');
      if (outcome.kind !== 'roulette') return;
      expect([...outcome.finalists].sort()).toEqual(['pizza', 'sushi']);
      expect(outcome.finalists).toContain(outcome.winner);
    });

    it('holds a runoff if someone supported both finalists', () => {
      const outcome = scoreRound({
        votes: [...split3v3.filter((x) => !(x.participantId === 'a' && x.categoryId === 'sushi')), v('a', 'sushi', 'yes'), v('g', 'pizza', 'no')],
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        rng: firstRng,
      });
      // pizza 3, sushi 4 -> margen 1 -> ambas finalistas; 'a' apoya a las dos
      expect(outcome.kind).toBe('runoff');
    });

    it('holds a runoff if someone supported none (voted no or never reached the cards)', () => {
      const outcome = scoreRound({
        votes: [...split3v3, v('g', 'pizza', 'no')],
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        rng: firstRng,
      });
      expect(outcome.kind).toBe('runoff');
    });

    it('holds a runoff if a spectator is present (they voted nothing)', () => {
      const outcome = scoreRound({
        votes: split3v3,
        eligibleRunoffVoterIds: ['a', 'b', 'c', 'd', 'e', 'f', 'spectator'],
        rng: firstRng,
      });
      expect(outcome.kind).toBe('runoff');
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/domain/scoring.test.ts`
Expected: FAIL, "Failed to resolve import '@/lib/domain/scoring'".

- [ ] **Step 3: Implementar `lib/domain/scoring.ts`**

```ts
import { CATEGORY_IDS } from './categories';
import { pickOne, shuffle, type Rng } from './random';
import { VOTE_WEIGHTS, type CategoryId, type CategoryStat, type RoundOutcome, type Vote } from './types';

const MAX_FINALISTS = 3;

export function computeStats(votes: Vote[]): CategoryStat[] {
  const byId = new Map<CategoryId, CategoryStat>(
    CATEGORY_IDS.map((id) => [id, { categoryId: id, score: 0, superCount: 0 }]),
  );
  for (const vote of votes) {
    const stat = byId.get(vote.categoryId);
    if (!stat) continue;
    stat.score += VOTE_WEIGHTS[vote.value];
    if (vote.value === 'super') stat.superCount += 1;
  }
  const order = (id: CategoryId) => CATEGORY_IDS.indexOf(id);
  return [...byId.values()].sort(
    (a, b) => b.score - a.score || b.superCount - a.superCount || order(a.categoryId) - order(b.categoryId),
  );
}

/** Dentro del margen de empate: diferencia ≤ max(1, 20% del puntaje de la primera). Aritmética entera. */
export function isWithinMargin(topScore: number, score: number): boolean {
  const diff = topScore - score;
  return diff <= 1 || diff * 5 <= topScore;
}

/** Corte a 3 por puntaje; si el empate cae en el último lugar, sorteo. */
function pickFinalists(candidates: CategoryStat[], rng: Rng): CategoryId[] {
  if (candidates.length <= MAX_FINALISTS) return candidates.map((c) => c.categoryId);
  const cutoffScore = candidates[MAX_FINALISTS - 1].score;
  const sure = candidates.filter((c) => c.score > cutoffScore).map((c) => c.categoryId);
  const tied = candidates.filter((c) => c.score === cutoffScore).map((c) => c.categoryId);
  return [...sure, ...shuffle(tied, rng).slice(0, MAX_FINALISTS - sure.length)];
}

/** §6.3: el ballotage no aporta información si cada participante apoyó exactamente a una finalista. */
function runoffIsRedundant(finalists: CategoryId[], votes: Vote[], eligibleVoterIds: string[]): boolean {
  if (eligibleVoterIds.length === 0) return false;
  return eligibleVoterIds.every((participantId) => {
    const supported = finalists.filter((categoryId) =>
      votes.some(
        (v) => v.participantId === participantId && v.categoryId === categoryId && v.value !== 'no',
      ),
    );
    return supported.length === 1;
  });
}

export function scoreRound(input: {
  votes: Vote[];
  /** Participantes de la ronda + espectadores presentes al cierre. */
  eligibleRunoffVoterIds: string[];
  rng: Rng;
}): RoundOutcome {
  const stats = computeStats(input.votes);
  const topScore = stats[0].score;
  if (topScore === 0) return { kind: 'no_cravings', stats };

  const candidates = stats.filter((s) => s.score > 0 && isWithinMargin(topScore, s.score));
  if (candidates.length === 1) return { kind: 'winner', winner: candidates[0].categoryId, stats };

  const finalists = pickFinalists(candidates, input.rng);
  if (runoffIsRedundant(finalists, input.votes, input.eligibleRunoffVoterIds)) {
    return { kind: 'roulette', finalists, winner: pickOne(finalists, input.rng), stats };
  }
  return { kind: 'runoff', finalists, stats };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/domain/scoring.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/scoring.ts tests/domain/scoring.test.ts
git commit -m "feat(domain): first-round scoring with tie margin, finalist cap and skip-to-roulette rule"
```

---

### Task 4: Ballotage, resultado completo y máquina de fases

**Files:**
- Create: `lib/domain/runoff.ts`, `lib/domain/result.ts`, `lib/domain/room-machine.ts`
- Test: `tests/domain/runoff.test.ts`, `tests/domain/result.test.ts`, `tests/domain/room-machine.test.ts`

**Interfaces:**
- Consumes: tipos de Task 2; `pickOne`, `Rng`.
- Produces:
  - `scoreRunoff(input: { finalists: CategoryId[]; runoffVotes: RunoffVote[]; rng: Rng }): RunoffOutcome`
  - `resultFromRound(outcome: Exclude<RoundOutcome, { kind: 'runoff' }>, votes: Vote[]): FullResult`
  - `resultFromRunoff(first: Extract<RoundOutcome, { kind: 'runoff' }>, runoff: RunoffOutcome, votes: Vote[], runoffVotes: RunoffVote[]): FullResult`
  - `type RoomAction = 'config' | 'start' | 'vote' | 'close_voting' | 'runoff_vote' | 'close_runoff' | 'finish_roulette' | 'replay'`
  - `canTransition(phase: RoomPhase, action: RoomAction): boolean`
  - `HOST_ONLY_ACTIONS: readonly RoomAction[]`
  - `phaseAfterRound(kind: RoundOutcome['kind']): RoomPhase`
  - `phaseAfterRunoff(kind: RunoffOutcome['kind']): RoomPhase`

- [ ] **Step 1: Escribir los tests (fallan)**

`tests/domain/runoff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scoreRunoff } from '@/lib/domain/runoff';

const firstRng = { next: () => 0 };

describe('scoreRunoff', () => {
  it('the most voted finalist wins', () => {
    const outcome = scoreRunoff({
      finalists: ['pizza', 'sushi'],
      runoffVotes: [
        { participantId: 'a', categoryId: 'pizza' },
        { participantId: 'b', categoryId: 'pizza' },
        { participantId: 'c', categoryId: 'sushi' },
      ],
      rng: firstRng,
    });
    expect(outcome).toEqual({
      kind: 'winner',
      winner: 'pizza',
      counts: [
        { categoryId: 'pizza', votes: 2 },
        { categoryId: 'sushi', votes: 1 },
      ],
    });
  });

  it('a tie at the top goes to roulette among the tied finalists only', () => {
    const outcome = scoreRunoff({
      finalists: ['pizza', 'sushi', 'pasta'],
      runoffVotes: [
        { participantId: 'a', categoryId: 'pizza' },
        { participantId: 'b', categoryId: 'sushi' },
      ],
      rng: firstRng,
    });
    expect(outcome.kind).toBe('roulette');
    if (outcome.kind !== 'roulette') return;
    expect(outcome.finalists).toEqual(['pizza', 'sushi']);
    expect(outcome.finalists).toContain(outcome.winner);
  });

  it('nobody voted: roulette among all finalists', () => {
    const outcome = scoreRunoff({ finalists: ['pizza', 'sushi'], runoffVotes: [], rng: firstRng });
    expect(outcome).toMatchObject({ kind: 'roulette', finalists: ['pizza', 'sushi'] });
  });

  it('ignores votes for non-finalists', () => {
    const outcome = scoreRunoff({
      finalists: ['pizza', 'sushi'],
      runoffVotes: [
        { participantId: 'a', categoryId: 'pasta' },
        { participantId: 'b', categoryId: 'sushi' },
      ],
      rng: firstRng,
    });
    expect(outcome).toMatchObject({ kind: 'winner', winner: 'sushi' });
  });
});
```

`tests/domain/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resultFromRound, resultFromRunoff } from '@/lib/domain/result';
import { computeStats } from '@/lib/domain/scoring';
import type { Vote } from '@/lib/domain/types';

const votes: Vote[] = [{ participantId: 'a', categoryId: 'pizza', value: 'yes' }];
const stats = computeStats(votes);

describe('resultFromRound', () => {
  it('maps no_cravings', () => {
    expect(resultFromRound({ kind: 'no_cravings', stats }, votes)).toMatchObject({
      path: 'no_cravings',
      winner: null,
      finalists: [],
      runoffCounts: null,
    });
  });

  it('maps a direct winner', () => {
    expect(resultFromRound({ kind: 'winner', winner: 'pizza', stats }, votes)).toMatchObject({
      path: 'direct',
      winner: 'pizza',
      votes,
    });
  });

  it('maps a roulette after skipping the runoff', () => {
    expect(
      resultFromRound({ kind: 'roulette', finalists: ['pizza', 'sushi'], winner: 'sushi', stats }, votes),
    ).toMatchObject({ path: 'roulette_after_skip', winner: 'sushi', finalists: ['pizza', 'sushi'] });
  });
});

describe('resultFromRunoff', () => {
  const first = { kind: 'runoff' as const, finalists: ['pizza' as const, 'sushi' as const], stats };
  const runoffVotes = [{ participantId: 'a', categoryId: 'pizza' as const }];

  it('maps a runoff winner', () => {
    const counts = [
      { categoryId: 'pizza' as const, votes: 1 },
      { categoryId: 'sushi' as const, votes: 0 },
    ];
    expect(resultFromRunoff(first, { kind: 'winner', winner: 'pizza', counts }, votes, runoffVotes)).toEqual({
      path: 'runoff',
      winner: 'pizza',
      stats,
      finalists: ['pizza', 'sushi'],
      runoffCounts: counts,
      votes,
      runoffVotes,
    });
  });

  it('maps a roulette after a tied runoff', () => {
    const counts = [
      { categoryId: 'pizza' as const, votes: 0 },
      { categoryId: 'sushi' as const, votes: 0 },
    ];
    expect(
      resultFromRunoff(first, { kind: 'roulette', finalists: ['pizza', 'sushi'], winner: 'pizza', counts }, votes, []),
    ).toMatchObject({ path: 'roulette_after_runoff', winner: 'pizza' });
  });
});
```

`tests/domain/room-machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HOST_ONLY_ACTIONS, canTransition, phaseAfterRound, phaseAfterRunoff } from '@/lib/domain/room-machine';

describe('canTransition', () => {
  it.each([
    ['lobby', 'config', true],
    ['lobby', 'start', true],
    ['lobby', 'vote', false],
    ['voting', 'vote', true],
    ['voting', 'close_voting', true],
    ['voting', 'start', false],
    ['voting', 'config', false],
    ['runoff', 'runoff_vote', true],
    ['runoff', 'close_runoff', true],
    ['runoff', 'vote', false],
    ['roulette', 'finish_roulette', true],
    ['result', 'replay', true],
    ['result', 'vote', false],
    ['result', 'config', false],
  ] as const)('%s + %s -> %s', (phase, action, expected) => {
    expect(canTransition(phase, action)).toBe(expected);
  });
});

describe('next phases', () => {
  it('after the first round', () => {
    expect(phaseAfterRound('winner')).toBe('result');
    expect(phaseAfterRound('no_cravings')).toBe('result');
    expect(phaseAfterRound('runoff')).toBe('runoff');
    expect(phaseAfterRound('roulette')).toBe('roulette');
  });

  it('after the runoff', () => {
    expect(phaseAfterRunoff('winner')).toBe('result');
    expect(phaseAfterRunoff('roulette')).toBe('roulette');
  });

  it('host-only actions', () => {
    expect([...HOST_ONLY_ACTIONS].sort()).toEqual(['config', 'replay', 'start']);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test`
Expected: FAIL en los 3 archivos nuevos por imports inexistentes.

- [ ] **Step 3: Implementar `lib/domain/runoff.ts`**

```ts
import { pickOne, type Rng } from './random';
import type { CategoryId, RunoffOutcome, RunoffVote } from './types';

export function scoreRunoff(input: {
  finalists: CategoryId[];
  runoffVotes: RunoffVote[];
  rng: Rng;
}): RunoffOutcome {
  const counts = input.finalists.map((categoryId) => ({
    categoryId,
    votes: input.runoffVotes.filter((v) => v.categoryId === categoryId).length,
  }));
  const max = Math.max(...counts.map((c) => c.votes));
  const top = counts.filter((c) => c.votes === max).map((c) => c.categoryId);
  if (top.length === 1) return { kind: 'winner', winner: top[0], counts };
  return { kind: 'roulette', finalists: top, winner: pickOne(top, input.rng), counts };
}
```

- [ ] **Step 4: Implementar `lib/domain/result.ts`**

```ts
import type { FullResult, RoundOutcome, RunoffOutcome, RunoffVote, Vote } from './types';

export function resultFromRound(
  outcome: Exclude<RoundOutcome, { kind: 'runoff' }>,
  votes: Vote[],
): FullResult {
  switch (outcome.kind) {
    case 'no_cravings':
      return { path: 'no_cravings', winner: null, stats: outcome.stats, finalists: [], runoffCounts: null, votes, runoffVotes: [] };
    case 'winner':
      return { path: 'direct', winner: outcome.winner, stats: outcome.stats, finalists: [], runoffCounts: null, votes, runoffVotes: [] };
    case 'roulette':
      return {
        path: 'roulette_after_skip',
        winner: outcome.winner,
        stats: outcome.stats,
        finalists: outcome.finalists,
        runoffCounts: null,
        votes,
        runoffVotes: [],
      };
  }
}

export function resultFromRunoff(
  first: Extract<RoundOutcome, { kind: 'runoff' }>,
  runoff: RunoffOutcome,
  votes: Vote[],
  runoffVotes: RunoffVote[],
): FullResult {
  return {
    path: runoff.kind === 'winner' ? 'runoff' : 'roulette_after_runoff',
    winner: runoff.winner,
    stats: first.stats,
    finalists: first.finalists,
    runoffCounts: runoff.counts,
    votes,
    runoffVotes,
  };
}
```

- [ ] **Step 5: Implementar `lib/domain/room-machine.ts`**

```ts
import type { RoomPhase, RoundOutcome, RunoffOutcome } from './types';

export type RoomAction =
  | 'config'
  | 'start'
  | 'vote'
  | 'close_voting'
  | 'runoff_vote'
  | 'close_runoff'
  | 'finish_roulette'
  | 'replay';

const ALLOWED_PHASE: Record<RoomAction, RoomPhase> = {
  config: 'lobby',
  start: 'lobby',
  vote: 'voting',
  close_voting: 'voting',
  runoff_vote: 'runoff',
  close_runoff: 'runoff',
  finish_roulette: 'roulette',
  replay: 'result',
};

export const HOST_ONLY_ACTIONS: readonly RoomAction[] = ['config', 'start', 'replay'];

export function canTransition(phase: RoomPhase, action: RoomAction): boolean {
  return ALLOWED_PHASE[action] === phase;
}

export function phaseAfterRound(kind: RoundOutcome['kind']): RoomPhase {
  if (kind === 'runoff') return 'runoff';
  if (kind === 'roulette') return 'roulette';
  return 'result';
}

export function phaseAfterRunoff(kind: RunoffOutcome['kind']): RoomPhase {
  return kind === 'roulette' ? 'roulette' : 'result';
}
```

- [ ] **Step 6: Correr y verificar que pasan**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add lib/domain tests/domain
git commit -m "feat(domain): runoff scoring, full result builders and room phase machine"
```

---

### Task 5: Visibilidad de resultados (`visibility.ts`)

Es el filtro de privacidad: lo único que convierte un `FullResult` en algo que puede salir del servidor (spec §7).

**Files:**
- Create: `lib/domain/visibility.ts`
- Test: `tests/domain/visibility.test.ts`

**Interfaces:**
- Consumes: `FullResult`, `PublicResult`, `VisibilityConfig`, `IndividualVotes`.
- Produces: `toPublicResult(full: FullResult, visibility: VisibilityConfig, nicknames: Record<string, string>): PublicResult`. `nicknames` mapea `participantId → apodo` de todos los participantes de la sala.

- [ ] **Step 1: Escribir los tests (fallan)**

`tests/domain/visibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resultFromRunoff } from '@/lib/domain/result';
import { computeStats } from '@/lib/domain/scoring';
import type { FullResult, Vote, VisibilityConfig } from '@/lib/domain/types';
import { toPublicResult } from '@/lib/domain/visibility';

const votes: Vote[] = [
  { participantId: 'id-ana', categoryId: 'pizza', value: 'super' },
  { participantId: 'id-ana', categoryId: 'sushi', value: 'yes' },
  { participantId: 'id-beto', categoryId: 'sushi', value: 'super' },
  { participantId: 'id-beto', categoryId: 'pizza', value: 'yes' },
];
const stats = computeStats(votes);
const full: FullResult = resultFromRunoff(
  { kind: 'runoff', finalists: ['pizza', 'sushi'], stats },
  {
    kind: 'winner',
    winner: 'pizza',
    counts: [
      { categoryId: 'pizza', votes: 2 },
      { categoryId: 'sushi', votes: 0 },
    ],
  },
  votes,
  [
    { participantId: 'id-ana', categoryId: 'pizza' },
    { participantId: 'id-beto', categoryId: 'pizza' },
  ],
);
const nicknames = { 'id-ana': 'Ana', 'id-beto': 'Beto' };
const allOff: VisibilityConfig = {
  showRanking: false,
  showScores: false,
  showSuperCounts: false,
  showTiebreakPath: false,
  showWhoVotedWhat: false,
};

describe('toPublicResult', () => {
  it('with everything off only the winner is visible', () => {
    expect(toPublicResult(full, allOff, nicknames)).toEqual({ winner: 'pizza' });
  });

  it('never leaks participant ids or nicknames unless showWhoVotedWhat is on', () => {
    const everythingButWho = { ...allOff, showRanking: true, showScores: true, showSuperCounts: true, showTiebreakPath: true };
    const json = JSON.stringify(toPublicResult(full, everythingButWho, nicknames));
    expect(json).not.toContain('id-ana');
    expect(json).not.toContain('id-beto');
    expect(json).not.toContain('Ana');
    expect(json).not.toContain('Beto');
  });

  it('showRanking adds all 14 categories in ranking order', () => {
    const out = toPublicResult(full, { ...allOff, showRanking: true }, nicknames);
    expect(out.ranking).toHaveLength(14);
    expect(out.ranking?.slice(0, 2).sort()).toEqual(['pizza', 'sushi']);
    expect(out.scores).toBeUndefined();
  });

  it('showScores adds scores, showSuperCounts adds super counts', () => {
    const out = toPublicResult(full, { ...allOff, showScores: true, showSuperCounts: true }, nicknames);
    expect(out.scores).toContainEqual({ categoryId: 'pizza', score: 3 });
    expect(out.superCounts).toContainEqual({ categoryId: 'sushi', superCount: 1 });
  });

  it('showTiebreakPath adds the path, finalists and runoff counts', () => {
    const out = toPublicResult(full, { ...allOff, showTiebreakPath: true }, nicknames);
    expect(out.tiebreak).toEqual({
      path: 'runoff',
      finalists: ['pizza', 'sushi'],
      runoffCounts: [
        { categoryId: 'pizza', votes: 2 },
        { categoryId: 'sushi', votes: 0 },
      ],
    });
  });

  it('showWhoVotedWhat adds individual votes by nickname, including the runoff choice', () => {
    const out = toPublicResult(full, { ...allOff, showWhoVotedWhat: true }, nicknames);
    expect(out.individualVotes).toEqual([
      {
        nickname: 'Ana',
        votes: [
          { categoryId: 'pizza', value: 'super' },
          { categoryId: 'sushi', value: 'yes' },
        ],
        runoffChoice: 'pizza',
      },
      {
        nickname: 'Beto',
        votes: [
          { categoryId: 'sushi', value: 'super' },
          { categoryId: 'pizza', value: 'yes' },
        ],
        runoffChoice: 'pizza',
      },
    ]);
    expect(JSON.stringify(out)).not.toContain('id-ana');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/domain/visibility.test.ts`
Expected: FAIL por import inexistente.

- [ ] **Step 3: Implementar `lib/domain/visibility.ts`**

```ts
import type { FullResult, IndividualVotes, PublicResult, VisibilityConfig } from './types';

function individualVotes(full: FullResult, nicknames: Record<string, string>): IndividualVotes[] {
  return Object.entries(nicknames)
    .map(([participantId, nickname]) => ({
      nickname,
      votes: full.votes
        .filter((v) => v.participantId === participantId)
        .map(({ categoryId, value }) => ({ categoryId, value })),
      runoffChoice: full.runoffVotes.find((v) => v.participantId === participantId)?.categoryId ?? null,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'es'));
}

/** Único camino por el que un resultado puede llegar a un cliente. */
export function toPublicResult(
  full: FullResult,
  visibility: VisibilityConfig,
  nicknames: Record<string, string>,
): PublicResult {
  const out: PublicResult = { winner: full.winner };
  if (visibility.showRanking) out.ranking = full.stats.map((s) => s.categoryId);
  if (visibility.showScores) out.scores = full.stats.map(({ categoryId, score }) => ({ categoryId, score }));
  if (visibility.showSuperCounts) {
    out.superCounts = full.stats.map(({ categoryId, superCount }) => ({ categoryId, superCount }));
  }
  if (visibility.showTiebreakPath) {
    out.tiebreak = {
      path: full.path,
      finalists: [...full.finalists],
      runoffCounts: full.runoffCounts ? full.runoffCounts.map((c) => ({ ...c })) : null,
    };
  }
  if (visibility.showWhoVotedWhat) out.individualVotes = individualVotes(full, nicknames);
  return out;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/domain/visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/visibility.ts tests/domain/visibility.test.ts
git commit -m "feat(domain): visibility filter for public results"
```

---

### Task 6: Supabase local, esquema, RLS y purga

**Files:**
- Create: `supabase/config.toml` (vía CLI), `supabase/migrations/20261001000000_init.sql`
- Create: `lib/server/db.ts`
- Create: `vitest.server.config.ts`, `tests/server/setup.ts`, `tests/server/helpers.ts`
- Create: `.env.local` (no se commitea)
- Test: `tests/server/schema.test.ts`

**Interfaces:**
- Produces: `sql` (cliente postgres.js), `type Db = postgres.Sql<{}>`, `asJson(value: unknown): postgres.JSONValue`, `transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>` (usar siempre esto en vez de `sql.begin` en código de app). Tablas `rooms`, `participants`, `rounds`, `votes`, `runoff_votes`, `room_public`, `events`. Helpers de test `resetDb()`, `T0`, `at(ms)`.

- [ ] **Step 1: Inicializar Supabase local**

Requiere Docker Desktop corriendo.

```bash
npx supabase init
npx supabase start
npx supabase status
```

Copiar `.env.example` a `.env.local` y completar con los valores de `status`: `DB URL` → `DATABASE_URL`, `API URL` → `NEXT_PUBLIC_SUPABASE_URL`, `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 2: Escribir el test de esquema (falla)**

`vitest.server.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['tests/server/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/server/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
```

`tests/server/setup.ts`:

```ts
import { afterAll } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

afterAll(async () => {
  const { sql } = await import('@/lib/server/db');
  await sql.end();
});
```

`tests/server/helpers.ts`:

```ts
import { sql } from '@/lib/server/db';

export const T0 = new Date('2026-10-01T20:00:00.000Z');
export const at = (ms: number) => new Date(T0.getTime() + ms);

export async function resetDb() {
  await sql`truncate rooms, events cascade`;
}
```

`tests/server/schema.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '@/lib/server/db';
import { T0, resetDb } from './helpers';

async function seed() {
  await sql`insert into rooms (id, created_at, expires_at, phase, config, current_round)
            values ('room0001', ${T0}, ${T0}, 'voting', '{}'::jsonb, 1)`;
  const [p] = await sql<{ id: string }[]>`
    insert into participants (room_id, nickname, nickname_key, token_hash, joined_at, last_seen_at)
    values ('room0001', 'Ana', 'ana', 'hash-1', ${T0}, ${T0}) returning id`;
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
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm run test:server`
Expected: FAIL, "Failed to resolve import '@/lib/server/db'".

- [ ] **Step 4: Implementar `lib/server/db.ts`**

```ts
import postgres from 'postgres';

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
```

- [ ] **Step 5: Escribir la migración `supabase/migrations/20261001000000_init.sql`**

```sql
-- Antojitos POC: esquema inicial

create table rooms (
  id text primary key,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  phase text not null check (phase in ('lobby', 'voting', 'runoff', 'roulette', 'result')),
  config jsonb not null,
  host_participant_id uuid,
  current_round int not null default 0
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms (id) on delete cascade,
  nickname text not null,
  nickname_key text not null,
  token_hash text not null unique,
  joined_at timestamptz not null,
  last_seen_at timestamptz not null,
  unique (room_id, nickname_key)
);

create index participants_room_idx on participants (room_id, joined_at);

alter table rooms
  add constraint rooms_host_fk foreign key (host_participant_id)
  references participants (id) on delete set null deferrable initially deferred;

create table rounds (
  room_id text not null references rooms (id) on delete cascade,
  number int not null,
  started_at timestamptz not null,
  deadline timestamptz not null,
  outcome jsonb,
  runoff_deadline timestamptz,
  roulette jsonb,
  roulette_ends_at timestamptz,
  full_result jsonb,
  primary key (room_id, number)
);

create table votes (
  room_id text not null,
  round_number int not null,
  participant_id uuid not null references participants (id) on delete cascade,
  category_id text not null,
  value text not null check (value in ('super', 'yes', 'no')),
  created_at timestamptz not null default now(),
  primary key (room_id, round_number, participant_id, category_id),
  foreign key (room_id, round_number) references rounds (room_id, number) on delete cascade
);

-- Un solo Súper antojo por participante y ronda.
create unique index votes_one_super_per_round
  on votes (room_id, round_number, participant_id)
  where value = 'super';

create table runoff_votes (
  room_id text not null,
  round_number int not null,
  participant_id uuid not null references participants (id) on delete cascade,
  category_id text not null,
  primary key (room_id, round_number, participant_id),
  foreign key (room_id, round_number) references rounds (room_id, number) on delete cascade
);

create table room_public (
  room_id text primary key references rooms (id) on delete cascade,
  snapshot jsonb not null,
  version int not null
);

-- Métricas: anónimas, sin FK, no se purgan.
create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  room_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS: sin políticas = sin acceso para anon/authenticated. Solo room_public es legible.
alter table rooms enable row level security;
alter table participants enable row level security;
alter table rounds enable row level security;
alter table votes enable row level security;
alter table runoff_votes enable row level security;
alter table events enable row level security;
alter table room_public enable row level security;

create policy "room snapshots are public" on room_public
  for select to anon, authenticated using (true);

alter publication supabase_realtime add table room_public;

-- Purga de salas vencidas cada 5 minutos.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-rooms',
  '*/5 * * * *',
  $$delete from public.rooms where expires_at < now()$$
);
```

- [ ] **Step 6: Aplicar la migración**

Run: `npm run db:reset`
Expected: "Finished supabase db reset" sin errores.

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npm run test:server`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add supabase vitest.server.config.ts lib/server/db.ts tests/server
git commit -m "feat(db): schema with RLS, one-super index, realtime snapshot table and purge job"
```

---

### Task 7: Base del servidor (errores, tokens, HTTP, tipos compartidos, repositorio)

**Files:**
- Create: `lib/shared/api-types.ts`, `lib/server/errors.ts`, `lib/server/tokens.ts`, `lib/server/http.ts`, `lib/server/room-repository.ts`
- Test: `tests/domain/tokens.test.ts` (sin DB), `tests/server/room-repository.test.ts`

**Interfaces:**
- Produces (`lib/shared/api-types.ts`): `ErrorCode`, `PublicSnapshot`, `PublicRound`, `SessionResponse`, `MeResponse`, `ApiErrorBody`.
- Produces (`lib/server/errors.ts`): `class AppError extends Error { code: ErrorCode; status: number }`.
- Produces (`lib/server/tokens.ts`): `generateToken(): string`, `hashToken(token: string): string`, `generateRoomId(): string`.
- Produces (`lib/server/http.ts`): `handle(fn: () => Promise<object>): Promise<Response>`, `readJson(req: Request): Promise<unknown>`, `tokenFrom(req: Request): string | null`, `TOKEN_HEADER = 'x-participant-token'`.
- Produces (`lib/server/room-repository.ts`): tipos `Room`, `Participant`, `Round`, `RouletteInfo`, y funciones:
  - `insertRoom(db, room: Room): Promise<void>`
  - `getRoom(db, id: string, opts?: { forUpdate?: boolean }): Promise<Room | null>`
  - `setRoomPhase(db, id: string, phase: RoomPhase): Promise<void>`
  - `setRoomConfig(db, id: string, config: RoomConfig): Promise<void>`
  - `setRoomHost(db, id: string, participantId: string): Promise<void>`
  - `startRoomRound(db, id: string, roundNumber: number): Promise<void>` (fase `voting` + `current_round`)
  - `insertParticipant(db, p: { roomId; nickname; nicknameKey; tokenHash; now: Date }): Promise<Participant>`
  - `listParticipants(db, roomId): Promise<Participant[]>` (orden `joined_at`, `id`)
  - `findParticipantByTokenHash(db, roomId, tokenHash): Promise<Participant | null>`
  - `touchParticipant(db, participantId, now: Date): Promise<void>`
  - `insertRound(db, r: { roomId; number; startedAt: Date; deadline: Date }): Promise<void>`
  - `getRound(db, roomId, number): Promise<Round | null>`
  - `updateRound(db, roomId, number, fields: RoundUpdate): Promise<void>` (solo pisa los campos presentes)
  - `listVotes(db, roomId, roundNumber): Promise<Vote[]>`, `insertVote(db, roomId, roundNumber, vote: Vote)`
  - `listRunoffVotes(db, roomId, roundNumber): Promise<RunoffVote[]>`, `insertRunoffVote(db, roomId, roundNumber, vote: RunoffVote)`
  - `nextPublicVersion(db, roomId): Promise<number>`, `upsertPublicSnapshot(db, roomId, version: number, snapshot: PublicSnapshot)`
  - `insertEvent(db, type: EventType, roomId: string, data?: Record<string, unknown>)`, `type EventType = 'room_created' | 'link_opened' | 'participant_joined' | 'round_started' | 'round_resolved' | 'replay'`

- [ ] **Step 1: Crear `lib/shared/api-types.ts`** (solo tipos)

```ts
import type { CategoryId, PublicResult, RoomConfig, RoomPhase, VoteValue } from '@/lib/domain/types';

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_EXPIRED'
  | 'ROOM_FULL'
  | 'NICKNAME_TAKEN'
  | 'INVALID_NICKNAME'
  | 'INVALID_TOKEN'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'SUPER_ALREADY_USED'
  | 'ALREADY_VOTED'
  | 'SPECTATOR'
  | 'INVALID_INPUT'
  | 'INTERNAL';

export type ApiErrorBody = { error: { code: ErrorCode; message: string }; serverTime: number };

export type PublicRound = {
  number: number;
  deadline: string;
  finishedCount: number;
  voterCount: number;
  spectatorIds: string[];
  finalists?: CategoryId[];
  runoffDeadline?: string;
  runoffVotedCount?: number;
  roulette?: { segments: CategoryId[]; winner: CategoryId; endsAt: string };
  result?: PublicResult;
};

/** Lo único que los clientes leen de la base. Nunca contiene tokens ni votos individuales (salvo PublicResult.individualVotes). */
export type PublicSnapshot = {
  roomId: string;
  version: number;
  phase: RoomPhase;
  expiresAt: string;
  hostParticipantId: string | null;
  config: RoomConfig;
  participants: { id: string; nickname: string }[];
  round?: PublicRound;
};

export type SessionResponse = { roomId: string; participantId: string; token: string };

export type MeResponse = {
  participantId: string;
  nickname: string;
  isHost: boolean;
  roundNumber: number;
  isSpectator: boolean;
  cardOrder: CategoryId[];
  myVotes: { categoryId: CategoryId; value: VoteValue }[];
  myRunoffVote: CategoryId | null;
};
```

- [ ] **Step 2: Escribir el test de tokens (falla)**

`tests/domain/tokens.test.ts` (corre con `npm test`, sin DB):

```ts
import { describe, expect, it } from 'vitest';
import { generateRoomId, generateToken, hashToken } from '@/lib/server/tokens';

describe('tokens', () => {
  it('generates long random tokens', () => {
    const a = generateToken();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(generateToken());
  });

  it('hashes deterministically to hex sha256', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates 8-char room ids without ambiguous characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRoomId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    }
  });
});
```

Run: `npm test -- tests/domain/tokens.test.ts` → Expected: FAIL (import inexistente).

- [ ] **Step 3: Implementar `lib/server/tokens.ts` y `lib/server/errors.ts`**

`lib/server/tokens.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRoomId(): string {
  return [...randomBytes(8)].map((b) => ROOM_ID_ALPHABET[b % ROOM_ID_ALPHABET.length]).join('');
}
```

`lib/server/errors.ts`:

```ts
import type { ErrorCode } from '@/lib/shared/api-types';

const STATUS: Record<ErrorCode, number> = {
  ROOM_NOT_FOUND: 404,
  ROOM_EXPIRED: 410,
  ROOM_FULL: 409,
  NICKNAME_TAKEN: 409,
  INVALID_NICKNAME: 400,
  INVALID_TOKEN: 401,
  NOT_HOST: 403,
  WRONG_PHASE: 409,
  NOT_ENOUGH_PLAYERS: 409,
  SUPER_ALREADY_USED: 409,
  ALREADY_VOTED: 409,
  SPECTATOR: 403,
  INVALID_INPUT: 400,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }

  get status(): number {
    return STATUS[this.code];
  }
}
```

Run: `npm test -- tests/domain/tokens.test.ts` → Expected: PASS.

- [ ] **Step 4: Implementar `lib/server/http.ts`**

```ts
import { AppError } from './errors';

export const TOKEN_HEADER = 'x-participant-token';

/** Ejecuta el comando y responde JSON con `serverTime` (lo usa el cliente para corregir su reloj). */
export async function handle(fn: () => Promise<object>): Promise<Response> {
  try {
    const data = await fn();
    return Response.json({ ...data, serverTime: Date.now() });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: { code: error.code, message: error.message }, serverTime: Date.now() },
        { status: error.status },
      );
    }
    console.error(error);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Internal error' }, serverTime: Date.now() },
      { status: 500 },
    );
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function tokenFrom(req: Request): string | null {
  return req.headers.get(TOKEN_HEADER);
}
```

- [ ] **Step 5: Escribir el test del repositorio (falla)**

`tests/server/room-repository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import { sql } from '@/lib/server/db';
import {
  getRoom,
  getRound,
  insertParticipant,
  insertRoom,
  insertRound,
  insertVote,
  listParticipants,
  listVotes,
  nextPublicVersion,
  updateRound,
  upsertPublicSnapshot,
} from '@/lib/server/room-repository';
import { T0, at, resetDb } from './helpers';

async function makeRoom() {
  await insertRoom(sql, {
    id: 'room0001',
    createdAt: T0,
    expiresAt: at(3_600_000),
    phase: 'lobby',
    config: DEFAULT_CONFIG,
    hostParticipantId: null,
    currentRound: 0,
  });
}

describe('room-repository', () => {
  beforeEach(resetDb);

  it('round-trips a room with its jsonb config', async () => {
    await makeRoom();
    const room = await getRoom(sql, 'room0001');
    expect(room).toEqual({
      id: 'room0001',
      createdAt: T0,
      expiresAt: at(3_600_000),
      phase: 'lobby',
      config: DEFAULT_CONFIG,
      hostParticipantId: null,
      currentRound: 0,
    });
    expect(await getRoom(sql, 'missing')).toBeNull();
  });

  it('lists participants by join order', async () => {
    await makeRoom();
    await insertParticipant(sql, { roomId: 'room0001', nickname: 'B', nicknameKey: 'b', tokenHash: 'h2', now: at(10) });
    await insertParticipant(sql, { roomId: 'room0001', nickname: 'A', nicknameKey: 'a', tokenHash: 'h1', now: at(5) });
    expect((await listParticipants(sql, 'room0001')).map((p) => p.nickname)).toEqual(['A', 'B']);
  });

  it('stores votes and partial round updates', async () => {
    await makeRoom();
    const p = await insertParticipant(sql, { roomId: 'room0001', nickname: 'A', nicknameKey: 'a', tokenHash: 'h1', now: T0 });
    await insertRound(sql, { roomId: 'room0001', number: 1, startedAt: T0, deadline: at(60_000) });
    await insertVote(sql, 'room0001', 1, { participantId: p.id, categoryId: 'pizza', value: 'super' });
    expect(await listVotes(sql, 'room0001', 1)).toEqual([{ participantId: p.id, categoryId: 'pizza', value: 'super' }]);

    await updateRound(sql, 'room0001', 1, { runoffDeadline: at(80_000) });
    await updateRound(sql, 'room0001', 1, { roulette: { segments: ['pizza', 'sushi'], winner: 'sushi' } });
    const round = await getRound(sql, 'room0001', 1);
    expect(round?.runoffDeadline).toEqual(at(80_000));
    expect(round?.roulette).toEqual({ segments: ['pizza', 'sushi'], winner: 'sushi' });
    expect(round?.outcome).toBeNull();
  });

  it('increments the public snapshot version', async () => {
    await makeRoom();
    expect(await nextPublicVersion(sql, 'room0001')).toBe(1);
    await upsertPublicSnapshot(sql, 'room0001', 1, { roomId: 'room0001' } as never);
    expect(await nextPublicVersion(sql, 'room0001')).toBe(2);
  });
});
```

Run: `npm run test:server` → Expected: FAIL (import inexistente).

- [ ] **Step 6: Implementar `lib/server/room-repository.ts`**

```ts
import type {
  CategoryId,
  FullResult,
  RoomConfig,
  RoomPhase,
  RoundOutcome,
  RunoffVote,
  Vote,
  VoteValue,
} from '@/lib/domain/types';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { asJson, type Db } from './db';

export type Room = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  phase: RoomPhase;
  config: RoomConfig;
  hostParticipantId: string | null;
  currentRound: number;
};

export type Participant = { id: string; roomId: string; nickname: string; joinedAt: Date; lastSeenAt: Date };

export type RouletteInfo = { segments: CategoryId[]; winner: CategoryId };

export type Round = {
  roomId: string;
  number: number;
  startedAt: Date;
  deadline: Date;
  outcome: RoundOutcome | null;
  runoffDeadline: Date | null;
  roulette: RouletteInfo | null;
  rouletteEndsAt: Date | null;
  fullResult: FullResult | null;
};

export type RoundUpdate = Partial<
  Pick<Round, 'outcome' | 'runoffDeadline' | 'roulette' | 'rouletteEndsAt' | 'fullResult'>
>;

export type EventType =
  | 'room_created'
  | 'link_opened'
  | 'participant_joined'
  | 'round_started'
  | 'round_resolved'
  | 'replay';

type RoomRow = {
  id: string;
  created_at: Date;
  expires_at: Date;
  phase: RoomPhase;
  config: RoomConfig;
  host_participant_id: string | null;
  current_round: number;
};

type ParticipantRow = { id: string; room_id: string; nickname: string; joined_at: Date; last_seen_at: Date };

type RoundRow = {
  room_id: string;
  number: number;
  started_at: Date;
  deadline: Date;
  outcome: RoundOutcome | null;
  runoff_deadline: Date | null;
  roulette: RouletteInfo | null;
  roulette_ends_at: Date | null;
  full_result: FullResult | null;
};

const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  phase: r.phase,
  config: r.config,
  hostParticipantId: r.host_participant_id,
  currentRound: r.current_round,
});

const toParticipant = (r: ParticipantRow): Participant => ({
  id: r.id,
  roomId: r.room_id,
  nickname: r.nickname,
  joinedAt: r.joined_at,
  lastSeenAt: r.last_seen_at,
});

const toRound = (r: RoundRow): Round => ({
  roomId: r.room_id,
  number: r.number,
  startedAt: r.started_at,
  deadline: r.deadline,
  outcome: r.outcome,
  runoffDeadline: r.runoff_deadline,
  roulette: r.roulette,
  rouletteEndsAt: r.roulette_ends_at,
  fullResult: r.full_result,
});

// --- rooms ---

export async function insertRoom(db: Db, room: Room): Promise<void> {
  await db`
    insert into rooms (id, created_at, expires_at, phase, config, host_participant_id, current_round)
    values (${room.id}, ${room.createdAt}, ${room.expiresAt}, ${room.phase}, ${db.json(asJson(room.config))},
            ${room.hostParticipantId}, ${room.currentRound})`;
}

export async function getRoom(db: Db, id: string, opts: { forUpdate?: boolean } = {}): Promise<Room | null> {
  const rows = opts.forUpdate
    ? await db<RoomRow[]>`select * from rooms where id = ${id} for update`
    : await db<RoomRow[]>`select * from rooms where id = ${id}`;
  return rows[0] ? toRoom(rows[0]) : null;
}

export async function setRoomPhase(db: Db, id: string, phase: RoomPhase): Promise<void> {
  await db`update rooms set phase = ${phase} where id = ${id}`;
}

export async function setRoomConfig(db: Db, id: string, config: RoomConfig): Promise<void> {
  await db`update rooms set config = ${db.json(asJson(config))} where id = ${id}`;
}

export async function setRoomHost(db: Db, id: string, participantId: string): Promise<void> {
  await db`update rooms set host_participant_id = ${participantId} where id = ${id}`;
}

export async function startRoomRound(db: Db, id: string, roundNumber: number): Promise<void> {
  await db`update rooms set phase = 'voting', current_round = ${roundNumber} where id = ${id}`;
}

// --- participants ---

export async function insertParticipant(
  db: Db,
  p: { roomId: string; nickname: string; nicknameKey: string; tokenHash: string; now: Date },
): Promise<Participant> {
  const [row] = await db<ParticipantRow[]>`
    insert into participants (room_id, nickname, nickname_key, token_hash, joined_at, last_seen_at)
    values (${p.roomId}, ${p.nickname}, ${p.nicknameKey}, ${p.tokenHash}, ${p.now}, ${p.now})
    returning id, room_id, nickname, joined_at, last_seen_at`;
  return toParticipant(row);
}

export async function listParticipants(db: Db, roomId: string): Promise<Participant[]> {
  const rows = await db<ParticipantRow[]>`
    select id, room_id, nickname, joined_at, last_seen_at from participants
    where room_id = ${roomId} order by joined_at, id`;
  return rows.map(toParticipant);
}

export async function nicknameTaken(db: Db, roomId: string, nicknameKey: string): Promise<boolean> {
  const rows = await db`select 1 from participants where room_id = ${roomId} and nickname_key = ${nicknameKey}`;
  return rows.length > 0;
}

export async function findParticipantByTokenHash(
  db: Db,
  roomId: string,
  tokenHash: string,
): Promise<Participant | null> {
  const rows = await db<ParticipantRow[]>`
    select id, room_id, nickname, joined_at, last_seen_at from participants
    where room_id = ${roomId} and token_hash = ${tokenHash}`;
  return rows[0] ? toParticipant(rows[0]) : null;
}

export async function touchParticipant(db: Db, participantId: string, now: Date): Promise<void> {
  await db`update participants set last_seen_at = ${now} where id = ${participantId}`;
}

// --- rounds ---

export async function insertRound(
  db: Db,
  r: { roomId: string; number: number; startedAt: Date; deadline: Date },
): Promise<void> {
  await db`
    insert into rounds (room_id, number, started_at, deadline)
    values (${r.roomId}, ${r.number}, ${r.startedAt}, ${r.deadline})`;
}

export async function getRound(db: Db, roomId: string, number: number): Promise<Round | null> {
  const rows = await db<RoundRow[]>`select * from rounds where room_id = ${roomId} and number = ${number}`;
  return rows[0] ? toRound(rows[0]) : null;
}

const jsonOrNull = (db: Db, value: unknown) => (value === undefined ? null : db.json(asJson(value)));

/** Pisa solo los campos presentes en `fields`. */
export async function updateRound(db: Db, roomId: string, number: number, fields: RoundUpdate): Promise<void> {
  await db`
    update rounds set
      outcome = coalesce(${jsonOrNull(db, fields.outcome)}::jsonb, outcome),
      runoff_deadline = coalesce(${fields.runoffDeadline ?? null}::timestamptz, runoff_deadline),
      roulette = coalesce(${jsonOrNull(db, fields.roulette)}::jsonb, roulette),
      roulette_ends_at = coalesce(${fields.rouletteEndsAt ?? null}::timestamptz, roulette_ends_at),
      full_result = coalesce(${jsonOrNull(db, fields.fullResult)}::jsonb, full_result)
    where room_id = ${roomId} and number = ${number}`;
}

// --- votes ---

export async function listVotes(db: Db, roomId: string, roundNumber: number): Promise<Vote[]> {
  const rows = await db<{ participant_id: string; category_id: CategoryId; value: VoteValue }[]>`
    select participant_id, category_id, value from votes
    where room_id = ${roomId} and round_number = ${roundNumber} order by created_at`;
  return rows.map((r) => ({ participantId: r.participant_id, categoryId: r.category_id, value: r.value }));
}

export async function insertVote(db: Db, roomId: string, roundNumber: number, vote: Vote): Promise<void> {
  await db`
    insert into votes (room_id, round_number, participant_id, category_id, value)
    values (${roomId}, ${roundNumber}, ${vote.participantId}, ${vote.categoryId}, ${vote.value})`;
}

export async function listRunoffVotes(db: Db, roomId: string, roundNumber: number): Promise<RunoffVote[]> {
  const rows = await db<{ participant_id: string; category_id: CategoryId }[]>`
    select participant_id, category_id from runoff_votes
    where room_id = ${roomId} and round_number = ${roundNumber}`;
  return rows.map((r) => ({ participantId: r.participant_id, categoryId: r.category_id }));
}

export async function insertRunoffVote(db: Db, roomId: string, roundNumber: number, vote: RunoffVote): Promise<void> {
  await db`
    insert into runoff_votes (room_id, round_number, participant_id, category_id)
    values (${roomId}, ${roundNumber}, ${vote.participantId}, ${vote.categoryId})`;
}

// --- public snapshot ---

export async function nextPublicVersion(db: Db, roomId: string): Promise<number> {
  const [row] = await db<{ v: number }[]>`
    select coalesce(max(version), 0) + 1 as v from room_public where room_id = ${roomId}`;
  return row.v;
}

export async function upsertPublicSnapshot(
  db: Db,
  roomId: string,
  version: number,
  snapshot: PublicSnapshot,
): Promise<void> {
  await db`
    insert into room_public (room_id, snapshot, version)
    values (${roomId}, ${db.json(asJson(snapshot))}, ${version})
    on conflict (room_id) do update set snapshot = excluded.snapshot, version = excluded.version`;
}

// --- events ---

export async function insertEvent(
  db: Db,
  type: EventType,
  roomId: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await db`insert into events (type, room_id, data) values (${type}, ${roomId}, ${db.json(asJson(data))})`;
}
```

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npm run test:server && npm test && npm run typecheck`
Expected: PASS y typecheck sin errores.

- [ ] **Step 8: Commit**

```bash
git add lib/shared lib/server tests
git commit -m "feat(server): error codes, tokens, http helpers, shared api types and room repository"
```

---

### Task 8: Foto pública y contexto transaccional de sala

**Files:**
- Create: `lib/server/snapshot-builder.ts` (puro, sin imports de DB), `lib/server/public-snapshot.ts`, `lib/server/room-context.ts`
- Test: `tests/domain/public-snapshot.test.ts` (builder puro, sin DB)

`snapshot-builder.ts` no puede importar valores de `db.ts`: `db.ts` exige `DATABASE_URL` al cargarse y los tests de `npm test` corren sin base. Solo `import type` desde `room-repository`.

**Interfaces:**
- Consumes: repositorio (Task 7), `toPublicResult` (Task 5), `CATEGORY_IDS`.
- Produces:
  - `snapshot-builder.ts`: `buildPublicSnapshot(input: { room: Room; participants: Participant[]; round: Round | null; votes: Vote[]; runoffVoteCount: number; version: number }): PublicSnapshot` e `isSpectator(participant: Participant, round: Round): boolean` (`joinedAt > startedAt`)
  - `public-snapshot.ts`: `writePublicSnapshot(db: Db, roomId: string): Promise<void>`; re-exporta `buildPublicSnapshot` e `isSpectator`
  - `withRoomTx<T>(roomId: string, now: Date, fn: (tx: Db, room: Room) => Promise<T>, opts?: { snapshot?: boolean }): Promise<T>`: abre transacción, bloquea la sala, valida existencia (`ROOM_NOT_FOUND`) y vencimiento (`ROOM_EXPIRED`), ejecuta `fn` y, salvo `snapshot: false`, reescribe la foto pública.
  - `requireParticipant(db: Db, room: Room, token: string | null): Promise<Participant>` (`INVALID_TOKEN`)
  - `requireHost(room: Room, participant: Participant): void` (`NOT_HOST`)
  - `requireRound(db: Db, room: Room): Promise<Round>`

- [ ] **Step 1: Escribir el test del builder (falla)**

`tests/domain/public-snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '@/lib/domain/categories';
import { resultFromRound } from '@/lib/domain/result';
import { computeStats } from '@/lib/domain/scoring';
import { DEFAULT_CONFIG, type Vote } from '@/lib/domain/types';
import { buildPublicSnapshot } from '@/lib/server/snapshot-builder';
import type { Participant, Room, Round } from '@/lib/server/room-repository';

const T0 = new Date('2026-10-01T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const room: Room = {
  id: 'room0001',
  createdAt: T0,
  expiresAt: at(3_600_000),
  phase: 'voting',
  config: DEFAULT_CONFIG,
  hostParticipantId: 'p1',
  currentRound: 1,
};
const participants: Participant[] = [
  { id: 'p1', roomId: 'room0001', nickname: 'Ana', joinedAt: T0, lastSeenAt: T0 },
  { id: 'p2', roomId: 'room0001', nickname: 'Beto', joinedAt: T0, lastSeenAt: T0 },
  { id: 'p3', roomId: 'room0001', nickname: 'Caro', joinedAt: at(5_000), lastSeenAt: at(5_000) },
];
const round: Round = {
  roomId: 'room0001',
  number: 1,
  startedAt: at(1_000),
  deadline: at(61_000),
  outcome: null,
  runoffDeadline: null,
  roulette: null,
  rouletteEndsAt: null,
  fullResult: null,
};
const allVotesOf = (participantId: string): Vote[] =>
  CATEGORY_IDS.map((categoryId) => ({ participantId, categoryId, value: categoryId === 'pizza' ? 'super' : 'no' }));

describe('buildPublicSnapshot', () => {
  it('in lobby has no round', () => {
    const snap = buildPublicSnapshot({ room: { ...room, phase: 'lobby', currentRound: 0 }, participants, round: null, votes: [], runoffVoteCount: 0, version: 3 });
    expect(snap).toEqual({
      roomId: 'room0001',
      version: 3,
      phase: 'lobby',
      expiresAt: at(3_600_000).toISOString(),
      hostParticipantId: 'p1',
      config: DEFAULT_CONFIG,
      participants: [
        { id: 'p1', nickname: 'Ana' },
        { id: 'p2', nickname: 'Beto' },
        { id: 'p3', nickname: 'Caro' },
      ],
    });
  });

  it('during voting reports progress and spectators but no votes', () => {
    const votes = [...allVotesOf('p1'), { participantId: 'p2', categoryId: 'pizza' as const, value: 'yes' as const }];
    const snap = buildPublicSnapshot({ room, participants, round, votes, runoffVoteCount: 0, version: 1 });
    expect(snap.round).toEqual({
      number: 1,
      deadline: at(61_000).toISOString(),
      finishedCount: 1,
      voterCount: 2,
      spectatorIds: ['p3'],
    });
    expect(JSON.stringify(snap)).not.toContain('"value"');
  });

  it('in result includes the filtered result and never individual votes by default', () => {
    const votes = [...allVotesOf('p1'), ...allVotesOf('p2')];
    const fullResult = resultFromRound({ kind: 'winner', winner: 'pizza', stats: computeStats(votes) }, votes);
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'result' },
      participants,
      round: { ...round, fullResult },
      votes,
      runoffVoteCount: 0,
      version: 9,
    });
    expect(snap.round?.result?.winner).toBe('pizza');
    expect(snap.round?.result?.individualVotes).toBeUndefined();
    expect(JSON.stringify(snap)).not.toContain('"value"');
  });

  it('in runoff includes finalists, runoff deadline and how many voted', () => {
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'runoff' },
      participants,
      round: { ...round, outcome: { kind: 'runoff', finalists: ['pizza', 'sushi'], stats: computeStats([]) }, runoffDeadline: at(80_000) },
      votes: [],
      runoffVoteCount: 2,
      version: 4,
    });
    expect(snap.round).toMatchObject({ finalists: ['pizza', 'sushi'], runoffDeadline: at(80_000).toISOString(), runoffVotedCount: 2 });
  });

  it('in roulette includes segments, winner and end time', () => {
    const snap = buildPublicSnapshot({
      room: { ...room, phase: 'roulette' },
      participants,
      round: { ...round, roulette: { segments: ['pizza', 'sushi'], winner: 'sushi' }, rouletteEndsAt: at(70_000) },
      votes: [],
      runoffVoteCount: 0,
      version: 5,
    });
    expect(snap.round?.roulette).toEqual({ segments: ['pizza', 'sushi'], winner: 'sushi', endsAt: at(70_000).toISOString() });
  });
});
```

Run: `npm test -- tests/domain/public-snapshot.test.ts` → Expected: FAIL (import `@/lib/server/snapshot-builder` inexistente).

- [ ] **Step 2: Implementar `lib/server/snapshot-builder.ts` y `lib/server/public-snapshot.ts`**

`lib/server/snapshot-builder.ts`:

```ts
import { CATEGORY_IDS } from '@/lib/domain/categories';
import type { Vote } from '@/lib/domain/types';
import { toPublicResult } from '@/lib/domain/visibility';
import type { PublicRound, PublicSnapshot } from '@/lib/shared/api-types';
import type { Participant, Room, Round } from './room-repository';

export function isSpectator(participant: Participant, round: Round): boolean {
  return participant.joinedAt.getTime() > round.startedAt.getTime();
}

export function buildPublicSnapshot(input: {
  room: Room;
  participants: Participant[];
  round: Round | null;
  votes: Vote[];
  runoffVoteCount: number;
  version: number;
}): PublicSnapshot {
  const { room, participants, round, votes } = input;
  const snapshot: PublicSnapshot = {
    roomId: room.id,
    version: input.version,
    phase: room.phase,
    expiresAt: room.expiresAt.toISOString(),
    hostParticipantId: room.hostParticipantId,
    config: room.config,
    participants: participants.map((p) => ({ id: p.id, nickname: p.nickname })),
  };
  if (!round || room.phase === 'lobby') return snapshot;

  const voters = participants.filter((p) => !isSpectator(p, round));
  const votesPerParticipant = new Map<string, number>();
  for (const v of votes) votesPerParticipant.set(v.participantId, (votesPerParticipant.get(v.participantId) ?? 0) + 1);

  const publicRound: PublicRound = {
    number: round.number,
    deadline: round.deadline.toISOString(),
    finishedCount: voters.filter((p) => (votesPerParticipant.get(p.id) ?? 0) >= CATEGORY_IDS.length).length,
    voterCount: voters.length,
    spectatorIds: participants.filter((p) => isSpectator(p, round)).map((p) => p.id),
  };

  if (round.outcome && (round.outcome.kind === 'runoff' || round.outcome.kind === 'roulette')) {
    publicRound.finalists = round.outcome.finalists;
  }
  if (room.phase === 'runoff' && round.runoffDeadline) {
    publicRound.runoffDeadline = round.runoffDeadline.toISOString();
    publicRound.runoffVotedCount = input.runoffVoteCount;
  }
  if (room.phase === 'roulette' && round.roulette && round.rouletteEndsAt) {
    publicRound.roulette = { ...round.roulette, endsAt: round.rouletteEndsAt.toISOString() };
  }
  if (room.phase === 'result' && round.fullResult) {
    const nicknames = Object.fromEntries(participants.map((p) => [p.id, p.nickname]));
    publicRound.result = toPublicResult(round.fullResult, room.config.visibility, nicknames);
  }
  snapshot.round = publicRound;
  return snapshot;
}
```

`lib/server/public-snapshot.ts`:

```ts
import type { Db } from './db';
import {
  getRoom,
  getRound,
  listParticipants,
  listRunoffVotes,
  listVotes,
  nextPublicVersion,
  upsertPublicSnapshot,
} from './room-repository';
import { buildPublicSnapshot } from './snapshot-builder';

export { buildPublicSnapshot, isSpectator } from './snapshot-builder';

export async function writePublicSnapshot(db: Db, roomId: string): Promise<void> {
  const room = await getRoom(db, roomId);
  if (!room) return;
  const participants = await listParticipants(db, roomId);
  const round = room.currentRound > 0 ? await getRound(db, roomId, room.currentRound) : null;
  const votes = round ? await listVotes(db, roomId, round.number) : [];
  const runoffVoteCount = round ? (await listRunoffVotes(db, roomId, round.number)).length : 0;
  const version = await nextPublicVersion(db, roomId);
  await upsertPublicSnapshot(db, roomId, version, buildPublicSnapshot({ room, participants, round, votes, runoffVoteCount, version }));
}
```

- [ ] **Step 3: Implementar `lib/server/room-context.ts`**

```ts
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
  opts: { snapshot?: boolean } = {},
): Promise<T> {
  return transaction(async (tx) => {
    const room = await getRoom(tx, roomId, { forUpdate: true });
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
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test && npm run typecheck`
Expected: PASS y typecheck sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/server tests/domain/public-snapshot.test.ts
git commit -m "feat(server): sanitized public snapshot and locked room transaction context"
```

---

### Task 9: Comandos de sala (crear, unirse, me, abierto, config) y sus rutas

**Files:**
- Create: `lib/server/commands/rooms.ts`
- Create: `app/api/rooms/route.ts`, `app/api/rooms/[roomId]/join/route.ts`, `app/api/rooms/[roomId]/me/route.ts`, `app/api/rooms/[roomId]/opened/route.ts`, `app/api/rooms/[roomId]/config/route.ts`
- Modify: `tests/server/helpers.ts` (agregar `setupRoom`, `readSnapshot`, `countEvents`)
- Test: `tests/server/rooms.test.ts`

**Interfaces:**
- Consumes: Task 7 y Task 8; `cardOrder`; `canTransition`; `DEFAULT_CONFIG`, `ROUND_SECONDS_OPTIONS`.
- Produces:
  - `ROOM_TTL_MS = 3_600_000`, `MAX_PARTICIPANTS = 15`, `MIN_PARTICIPANTS = 2`
  - `normalizeNickname(raw: unknown): { nickname: string; key: string }`
  - `parseConfig(raw: unknown): RoomConfig`
  - `createRoom(body: unknown, now: Date): Promise<SessionResponse>`
  - `joinRoom(roomId: string, body: unknown, now: Date): Promise<SessionResponse>`
  - `getMe(roomId: string, token: string | null, now: Date): Promise<MeResponse>`
  - `recordOpened(roomId: string): Promise<{ ok: true }>`
  - `updateConfig(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }>`
  - Rutas: `POST /api/rooms`, `POST /api/rooms/[roomId]/join`, `GET /api/rooms/[roomId]/me`, `POST /api/rooms/[roomId]/opened`, `POST /api/rooms/[roomId]/config`.

- [ ] **Step 1: Extender `tests/server/helpers.ts`**

Agregar al final del archivo:

```ts
import { createRoom, joinRoom } from '@/lib/server/commands/rooms';
import type { PublicSnapshot } from '@/lib/shared/api-types';

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
```

(Mover los `import` nuevos arriba, junto al import existente de `sql`.)

- [ ] **Step 2: Escribir los tests (fallan)**

`tests/server/rooms.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import { createRoom, getMe, joinRoom, recordOpened, updateConfig } from '@/lib/server/commands/rooms';
import { T0, at, countEvents, readSnapshot, resetDb, setupRoom } from './helpers';

describe('room commands', () => {
  beforeEach(resetDb);

  it('creates a room with the creator as host and publishes a snapshot', async () => {
    const s = await createRoom({ nickname: '  Juli  ' }, T0);
    expect(s.roomId).toMatch(/^[a-z0-9]{8}$/);
    const snap = await readSnapshot(s.roomId);
    expect(snap).toMatchObject({
      phase: 'lobby',
      hostParticipantId: s.participantId,
      config: DEFAULT_CONFIG,
      participants: [{ id: s.participantId, nickname: 'Juli' }],
      expiresAt: at(3_600_000).toISOString(),
    });
    expect(await countEvents(s.roomId, 'room_created')).toBe(1);
  });

  it('lets guests join and records the event', async () => {
    const { roomId } = await setupRoom(3);
    expect((await readSnapshot(roomId)).participants.map((p) => p.nickname)).toEqual(['Host', 'P1', 'P2']);
    expect(await countEvents(roomId, 'participant_joined')).toBe(2);
  });

  it('rejects the 16th participant', async () => {
    const { roomId } = await setupRoom(15);
    await expect(joinRoom(roomId, { nickname: 'Extra' }, T0)).rejects.toMatchObject({ code: 'ROOM_FULL' });
  });

  describe('nicknames (Review Focus 3)', () => {
    it('rejects duplicates ignoring case and surrounding spaces', async () => {
      const s = await createRoom({ nickname: 'Juli' }, T0);
      await expect(joinRoom(s.roomId, { nickname: ' juli ' }, T0)).rejects.toMatchObject({ code: 'NICKNAME_TAKEN' });
    });

    it.each([[''], ['   '], ['a'.repeat(21)], [42], [null]])('rejects %j', async (nickname) => {
      await expect(createRoom({ nickname }, T0)).rejects.toMatchObject({ code: 'INVALID_NICKNAME' });
    });

    it('accepts 20 emojis (counts code points, not UTF-16 units)', async () => {
      const s = await createRoom({ nickname: '🍕'.repeat(20) }, T0);
      expect((await readSnapshot(s.roomId)).participants[0].nickname).toBe('🍕'.repeat(20));
    });

    it('collapses inner whitespace', async () => {
      const s = await createRoom({ nickname: 'Juli    P' }, T0);
      expect((await readSnapshot(s.roomId)).participants[0].nickname).toBe('Juli P');
    });
  });

  it('rejects any action on an expired room', async () => {
    const s = await createRoom({ nickname: 'Host' }, T0);
    await expect(joinRoom(s.roomId, { nickname: 'Late' }, at(3_600_000))).rejects.toMatchObject({ code: 'ROOM_EXPIRED' });
  });

  it('rejects unknown rooms', async () => {
    await expect(joinRoom('nope0000', { nickname: 'A' }, T0)).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });

  it('getMe returns identity and role; rejects bad tokens', async () => {
    const { roomId, players } = await setupRoom(2);
    expect(await getMe(roomId, players[0].token, T0)).toEqual({
      participantId: players[0].participantId,
      nickname: 'Host',
      isHost: true,
      roundNumber: 0,
      isSpectator: false,
      cardOrder: [],
      myVotes: [],
      myRunoffVote: null,
    });
    expect((await getMe(roomId, players[1].token, T0)).isHost).toBe(false);
    await expect(getMe(roomId, 'bad-token', T0)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    await expect(getMe(roomId, null, T0)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('records link opens even without a valid room', async () => {
    await recordOpened('whatever');
    expect(await countEvents('whatever', 'link_opened')).toBe(1);
  });

  describe('updateConfig', () => {
    const next = {
      visibility: { ...DEFAULT_CONFIG.visibility, showWhoVotedWhat: true },
      roundSeconds: 90,
    };

    it('the host can change it in the lobby and everyone sees it', async () => {
      const { roomId, players } = await setupRoom(2);
      await updateConfig(roomId, players[0].token, next, T0);
      expect((await readSnapshot(roomId)).config).toEqual(next);
    });

    it('guests cannot', async () => {
      const { roomId, players } = await setupRoom(2);
      await expect(updateConfig(roomId, players[1].token, next, T0)).rejects.toMatchObject({ code: 'NOT_HOST' });
    });

    it.each([
      [{ ...next, roundSeconds: 30 }],
      [{ ...next, visibility: { ...next.visibility, showRanking: 'yes' } }],
      [{ roundSeconds: 60 }],
    ])('rejects invalid config %j', async (bad) => {
      const { roomId, players } = await setupRoom(2);
      await expect(updateConfig(roomId, players[0].token, bad, T0)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});
```

Run: `npm run test:server` → Expected: FAIL (import `@/lib/server/commands/rooms` inexistente).

- [ ] **Step 3: Implementar `lib/server/commands/rooms.ts`**

```ts
import { cardOrder } from '@/lib/domain/card-order';
import { canTransition } from '@/lib/domain/room-machine';
import { DEFAULT_CONFIG, ROUND_SECONDS_OPTIONS, type RoomConfig, type VisibilityConfig } from '@/lib/domain/types';
import type { MeResponse, SessionResponse } from '@/lib/shared/api-types';
import { sql, transaction } from '../db';
import { AppError } from '../errors';
import { isSpectator, writePublicSnapshot } from '../public-snapshot';
import { requireHost, requireParticipant, withRoomTx } from '../room-context';
import {
  getRound,
  insertEvent,
  insertParticipant,
  insertRoom,
  listParticipants,
  listRunoffVotes,
  listVotes,
  nicknameTaken,
  setRoomConfig,
  setRoomHost,
} from '../room-repository';
import { generateRoomId, generateToken, hashToken } from '../tokens';

export const ROOM_TTL_MS = 60 * 60 * 1000;
export const MAX_PARTICIPANTS = 15;
export const MIN_PARTICIPANTS = 2;
const MAX_NICKNAME_LENGTH = 20;

const VISIBILITY_KEYS: (keyof VisibilityConfig)[] = [
  'showRanking',
  'showScores',
  'showSuperCounts',
  'showTiebreakPath',
  'showWhoVotedWhat',
];

export function normalizeNickname(raw: unknown): { nickname: string; key: string } {
  if (typeof raw !== 'string') throw new AppError('INVALID_NICKNAME');
  const nickname = raw.trim().replace(/\s+/g, ' ');
  const length = [...nickname].length;
  if (length < 1 || length > MAX_NICKNAME_LENGTH) throw new AppError('INVALID_NICKNAME');
  return { nickname, key: nickname.toLocaleLowerCase('es') };
}

export function parseConfig(raw: unknown): RoomConfig {
  const value = raw as { visibility?: Record<string, unknown>; roundSeconds?: unknown } | null;
  const visibility = value?.visibility;
  if (!visibility || VISIBILITY_KEYS.some((k) => typeof visibility[k] !== 'boolean')) {
    throw new AppError('INVALID_INPUT');
  }
  const roundSeconds = value?.roundSeconds as RoomConfig['roundSeconds'];
  if (!ROUND_SECONDS_OPTIONS.includes(roundSeconds)) throw new AppError('INVALID_INPUT');
  return {
    visibility: Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, visibility[k]])) as VisibilityConfig,
    roundSeconds,
  };
}

const nicknameFrom = (body: unknown) => normalizeNickname((body as { nickname?: unknown } | null)?.nickname);

export async function createRoom(body: unknown, now: Date): Promise<SessionResponse> {
  const { nickname, key } = nicknameFrom(body);
  const roomId = generateRoomId();
  const token = generateToken();
  const participantId = await transaction(async (tx) => {
    await insertRoom(tx, {
      id: roomId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ROOM_TTL_MS),
      phase: 'lobby',
      config: DEFAULT_CONFIG,
      hostParticipantId: null,
      currentRound: 0,
    });
    const host = await insertParticipant(tx, { roomId, nickname, nicknameKey: key, tokenHash: hashToken(token), now });
    await setRoomHost(tx, roomId, host.id);
    await insertEvent(tx, 'room_created', roomId);
    await writePublicSnapshot(tx, roomId);
    return host.id;
  });
  return { roomId, participantId, token };
}

export async function joinRoom(roomId: string, body: unknown, now: Date): Promise<SessionResponse> {
  const { nickname, key } = nicknameFrom(body);
  const token = generateToken();
  const participantId = await withRoomTx(roomId, now, async (tx) => {
    const participants = await listParticipants(tx, roomId);
    if (participants.length >= MAX_PARTICIPANTS) throw new AppError('ROOM_FULL');
    if (await nicknameTaken(tx, roomId, key)) throw new AppError('NICKNAME_TAKEN');
    const p = await insertParticipant(tx, { roomId, nickname, nicknameKey: key, tokenHash: hashToken(token), now });
    await insertEvent(tx, 'participant_joined', roomId);
    return p.id;
  });
  return { roomId, participantId, token };
}

export async function getMe(roomId: string, token: string | null, now: Date): Promise<MeResponse> {
  return withRoomTx(
    roomId,
    now,
    async (tx, room) => {
      const me = await requireParticipant(tx, room, token);
      const round = room.currentRound > 0 ? await getRound(tx, roomId, room.currentRound) : null;
      const votes = round ? await listVotes(tx, roomId, round.number) : [];
      const runoffVotes = round ? await listRunoffVotes(tx, roomId, round.number) : [];
      return {
        participantId: me.id,
        nickname: me.nickname,
        isHost: room.hostParticipantId === me.id,
        roundNumber: room.currentRound,
        isSpectator: round ? isSpectator(me, round) : false,
        cardOrder: round ? cardOrder(me.id, round.number) : [],
        myVotes: votes.filter((v) => v.participantId === me.id).map(({ categoryId, value }) => ({ categoryId, value })),
        myRunoffVote: runoffVotes.find((v) => v.participantId === me.id)?.categoryId ?? null,
      };
    },
    { snapshot: false },
  );
}

export async function recordOpened(roomId: string): Promise<{ ok: true }> {
  await insertEvent(sql, 'link_opened', roomId);
  return { ok: true };
}

export async function updateConfig(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }> {
  const config = parseConfig(body);
  await withRoomTx(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    requireHost(room, me);
    if (!canTransition(room.phase, 'config')) throw new AppError('WRONG_PHASE');
    await setRoomConfig(tx, roomId, config);
  });
  return { ok: true };
}
```

- [ ] **Step 4: Crear las rutas**

`app/api/rooms/route.ts`:

```ts
import { createRoom } from '@/lib/server/commands/rooms';
import { handle, readJson } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => createRoom(await readJson(req), new Date()));
}
```

`app/api/rooms/[roomId]/join/route.ts`:

```ts
import { joinRoom } from '@/lib/server/commands/rooms';
import { handle, readJson } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => joinRoom(roomId, await readJson(req), new Date()));
}
```

`app/api/rooms/[roomId]/me/route.ts`:

```ts
import { getMe } from '@/lib/server/commands/rooms';
import { handle, tokenFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => getMe(roomId, tokenFrom(req), new Date()));
}
```

`app/api/rooms/[roomId]/opened/route.ts`:

```ts
import { recordOpened } from '@/lib/server/commands/rooms';
import { handle } from '@/lib/server/http';

export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => recordOpened(roomId));
}
```

`app/api/rooms/[roomId]/config/route.ts`:

```ts
import { updateConfig } from '@/lib/server/commands/rooms';
import { handle, readJson, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => updateConfig(roomId, tokenFrom(req), await readJson(req), new Date()));
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm run test:server && npm run typecheck && npm run build`
Expected: PASS; typecheck y build sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/server/commands app/api tests/server
git commit -m "feat(api): create, join, me, opened and config endpoints"
```

---

### Task 10: Comandos de ronda (iniciar, votar, cerrar, ballotage) y sus rutas

**Files:**
- Create: `lib/server/commands/resolve.ts`, `lib/server/commands/round.ts`
- Create: `app/api/rooms/[roomId]/start/route.ts`, `app/api/rooms/[roomId]/vote/route.ts`, `app/api/rooms/[roomId]/close/route.ts`, `app/api/rooms/[roomId]/runoff-vote/route.ts`
- Modify: `tests/server/helpers.ts` (agregar `voteAll`)
- Test: `tests/server/round.test.ts`

**Interfaces:**
- Consumes: Tasks 3–9.
- Produces:
  - `RUNOFF_MS = 20_000`, `ROULETTE_MS = 6_000`
  - `resolveVoting(tx: Db, room: Room, round: Round, now: Date): Promise<void>`
  - `resolveRunoff(tx: Db, room: Room, round: Round, now: Date): Promise<void>`
  - `startRound(roomId, token, now): Promise<{ roundNumber: number }>`
  - `castVote(roomId, token, body: unknown, now): Promise<{ ok: true }>` (body `{ categoryId, value }`)
  - `closeIfDue(roomId, now): Promise<{ ok: true }>`
  - `castRunoffVote(roomId, token, body: unknown, now): Promise<{ ok: true }>` (body `{ categoryId }`)
  - Rutas `POST /start`, `/vote`, `/close`, `/runoff-vote`.

- [ ] **Step 1: Extender `tests/server/helpers.ts`**

```ts
import { CATEGORY_IDS } from '@/lib/domain/categories';
import type { CategoryId, VoteValue } from '@/lib/domain/types';
import { castVote } from '@/lib/server/commands/round';

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
```

(Imports arriba con el resto.)

- [ ] **Step 2: Escribir los tests (fallan)**

`tests/server/round.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getMe, joinRoom } from '@/lib/server/commands/rooms';
import { castRunoffVote, castVote, closeIfDue, startRound } from '@/lib/server/commands/round';
import { sql } from '@/lib/server/db';
import { T0, at, countEvents, readSnapshot, resetDb, setupRoom, voteAll } from './helpers';

const START = at(1_000);
const VOTE = at(2_000);

async function startedRoom(players: number) {
  const room = await setupRoom(players);
  await startRound(room.roomId, room.players[0].token, START);
  return room;
}

describe('startRound', () => {
  beforeEach(resetDb);

  it('needs at least 2 participants', async () => {
    const { roomId, players } = await setupRoom(1);
    await expect(startRound(roomId, players[0].token, START)).rejects.toMatchObject({ code: 'NOT_ENOUGH_PLAYERS' });
  });

  it('only the host can start', async () => {
    const { roomId, players } = await setupRoom(2);
    await expect(startRound(roomId, players[1].token, START)).rejects.toMatchObject({ code: 'NOT_HOST' });
  });

  it('opens voting with a server deadline of roundSeconds', async () => {
    const { roomId } = await startedRoom(2);
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('voting');
    expect(snap.round).toMatchObject({ number: 1, deadline: at(61_000).toISOString(), voterCount: 2, finishedCount: 0 });
    expect(await countEvents(roomId, 'round_started')).toBe(1);
  });
});

describe('castVote', () => {
  beforeEach(resetDb);

  it('allows a single super per round', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'super' }, VOTE);
    await expect(
      castVote(roomId, players[0].token, { categoryId: 'sushi', value: 'super' }, VOTE),
    ).rejects.toMatchObject({ code: 'SUPER_ALREADY_USED' });
  });

  it('a retried vote is rejected as ALREADY_VOTED and not duplicated (Review Focus 2)', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'yes' }, VOTE);
    await expect(
      castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'yes' }, VOTE),
    ).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from votes where room_id = ${roomId}`;
    expect(n).toBe(1);
  });

  it('a vote after the deadline is rejected, not counted, and closes the round (Review Focus 1)', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'super' }, VOTE);
    await expect(
      castVote(roomId, players[1].token, { categoryId: 'pizza', value: 'super' }, at(61_000)),
    ).rejects.toMatchObject({ code: 'WRONG_PHASE' });
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('result');
    expect(snap.round?.result?.scores?.find((s) => s.categoryId === 'pizza')?.score).toBe(2);
  });

  it('rejects invalid input', async () => {
    const { roomId, players } = await startedRoom(2);
    await expect(castVote(roomId, players[0].token, { categoryId: 'tacos', value: 'yes' }, VOTE)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'maybe' }, VOTE)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('late joiners are spectators and cannot vote in the first round', async () => {
    const { roomId } = await startedRoom(2);
    const late = await joinRoom(roomId, { nickname: 'Late' }, at(5_000));
    expect((await getMe(roomId, late.token, at(5_000))).isSpectator).toBe(true);
    await expect(castVote(roomId, late.token, { categoryId: 'pizza', value: 'yes' }, VOTE)).rejects.toMatchObject({ code: 'SPECTATOR' });
    expect((await readSnapshot(roomId)).round?.spectatorIds).toEqual([late.participantId]);
  });

  it('closes immediately when every voter finished: direct win', async () => {
    const { roomId, players } = await startedRoom(2);
    await voteAll(roomId, players[0].token, { pizza: 'super', sushi: 'yes' }, VOTE);
    expect((await readSnapshot(roomId)).round?.finishedCount).toBe(1);
    await voteAll(roomId, players[1].token, { pizza: 'super', sushi: 'yes' }, VOTE);
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('result');
    expect(snap.round?.result).toMatchObject({ winner: 'pizza', tiebreak: { path: 'direct' } });
    expect(snap.round?.result?.individualVotes).toBeUndefined();
    expect(JSON.stringify(snap)).not.toContain('"value"');
    expect(await countEvents(roomId, 'round_resolved')).toBe(1);
  });

  it('no cravings when everybody said no', async () => {
    const { roomId, players } = await startedRoom(2);
    await voteAll(roomId, players[0].token, {}, VOTE);
    await voteAll(roomId, players[1].token, {}, VOTE);
    expect((await readSnapshot(roomId)).round?.result).toMatchObject({ winner: null, tiebreak: { path: 'no_cravings' } });
  });
});

describe('runoff and roulette', () => {
  beforeEach(resetDb);

  // 3 vs 2 con alguien que apoya a ambas -> ballotage pizza vs sushi
  async function roomInRunoff() {
    const room = await startedRoom(2);
    await voteAll(room.roomId, room.players[0].token, { pizza: 'super', sushi: 'yes' }, VOTE);
    await voteAll(room.roomId, room.players[1].token, { pizza: 'yes', sushi: 'yes' }, VOTE);
    return room;
  }

  it('goes to runoff with a 20 s deadline', async () => {
    const { roomId } = await roomInRunoff();
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('runoff');
    expect([...(snap.round?.finalists ?? [])].sort()).toEqual(['pizza', 'sushi']);
    expect(snap.round?.runoffDeadline).toBe(at(22_000).toISOString());
  });

  it('runoff winner when everyone voted', async () => {
    const { roomId, players } = await roomInRunoff();
    await castRunoffVote(roomId, players[0].token, { categoryId: 'sushi' }, at(3_000));
    await expect(castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(3_000))).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
    await expect(castRunoffVote(roomId, players[1].token, { categoryId: 'pasta' }, at(3_000))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await castRunoffVote(roomId, players[1].token, { categoryId: 'sushi' }, at(3_000));
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('result');
    expect(snap.round?.result).toMatchObject({ winner: 'sushi', tiebreak: { path: 'runoff' } });
  });

  it('a spectator who joins during the runoff can vote and counts toward "everyone voted" (Review Focus 5)', async () => {
    const { roomId, players } = await roomInRunoff();
    const late = await joinRoom(roomId, { nickname: 'Late' }, at(3_000));
    await castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(4_000));
    await castRunoffVote(roomId, players[1].token, { categoryId: 'sushi' }, at(4_000));
    expect((await readSnapshot(roomId)).phase).toBe('runoff');
    await castRunoffVote(roomId, late.token, { categoryId: 'pizza' }, at(4_000));
    expect((await readSnapshot(roomId)).round?.result?.winner).toBe('pizza');
  });

  it('runoff tie -> roulette -> result after the animation', async () => {
    const { roomId, players } = await roomInRunoff();
    await castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(3_000));
    await castRunoffVote(roomId, players[1].token, { categoryId: 'sushi' }, at(3_000));
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('roulette');
    expect(snap.round?.roulette?.endsAt).toBe(at(9_000).toISOString());
    expect(['pizza', 'sushi']).toContain(snap.round?.roulette?.winner);

    await closeIfDue(roomId, at(8_000));
    expect((await readSnapshot(roomId)).phase).toBe('roulette');
    await closeIfDue(roomId, at(9_000));
    const done = await readSnapshot(roomId);
    expect(done.phase).toBe('result');
    expect(done.round?.result).toMatchObject({ winner: snap.round?.roulette?.winner, tiebreak: { path: 'roulette_after_runoff' } });
  });

  it('runoff timer expiry closes it with the votes so far', async () => {
    const { roomId, players } = await roomInRunoff();
    await castRunoffVote(roomId, players[0].token, { categoryId: 'pizza' }, at(3_000));
    await closeIfDue(roomId, at(22_000));
    expect((await readSnapshot(roomId)).round?.result?.winner).toBe('pizza');
  });

  it('skips the runoff when everyone supported exactly one finalist', async () => {
    const { roomId, players } = await startedRoom(2);
    await voteAll(roomId, players[0].token, { pizza: 'yes' }, VOTE);
    await voteAll(roomId, players[1].token, { sushi: 'yes' }, VOTE);
    const snap = await readSnapshot(roomId);
    expect(snap.phase).toBe('roulette');
    expect([...(snap.round?.roulette?.segments ?? [])].sort()).toEqual(['pizza', 'sushi']);
  });
});

describe('closeIfDue', () => {
  beforeEach(resetDb);

  it('does nothing before the deadline', async () => {
    const { roomId } = await startedRoom(2);
    await closeIfDue(roomId, at(60_999));
    expect((await readSnapshot(roomId)).phase).toBe('voting');
  });

  it('is idempotent under concurrent calls', async () => {
    const { roomId, players } = await startedRoom(2);
    await castVote(roomId, players[0].token, { categoryId: 'pizza', value: 'super' }, VOTE);
    await Promise.all([closeIfDue(roomId, at(61_000)), closeIfDue(roomId, at(61_000)), closeIfDue(roomId, at(61_001))]);
    expect((await readSnapshot(roomId)).phase).toBe('result');
    expect(await countEvents(roomId, 'round_resolved')).toBe(1);
  });

  it('is a no-op in the lobby', async () => {
    const { roomId } = await setupRoom(2, T0);
    await closeIfDue(roomId, at(1_000));
    expect((await readSnapshot(roomId)).phase).toBe('lobby');
  });
});
```

Run: `npm run test:server` → Expected: FAIL (import `@/lib/server/commands/round` inexistente).

- [ ] **Step 3: Implementar `lib/server/commands/resolve.ts`**

```ts
import { phaseAfterRound, phaseAfterRunoff } from '@/lib/domain/room-machine';
import { cryptoRng } from '@/lib/domain/random';
import { resultFromRound, resultFromRunoff } from '@/lib/domain/result';
import { scoreRunoff } from '@/lib/domain/runoff';
import { scoreRound } from '@/lib/domain/scoring';
import type { FullResult } from '@/lib/domain/types';
import type { Db } from '../db';
import {
  insertEvent,
  listParticipants,
  listRunoffVotes,
  listVotes,
  setRoomPhase,
  updateRound,
  type Room,
  type Round,
} from '../room-repository';

export const RUNOFF_MS = 20_000;
export const ROULETTE_MS = 6_000;

const after = (now: Date, ms: number) => new Date(now.getTime() + ms);

async function logResolved(tx: Db, room: Room, round: Round, full: FullResult, now: Date) {
  await insertEvent(tx, 'round_resolved', room.id, {
    round: round.number,
    path: full.path,
    durationMs: now.getTime() - round.startedAt.getTime(),
  });
}

/** Cierra la primera vuelta. Llamar solo con la sala bloqueada y en fase `voting`. */
export async function resolveVoting(tx: Db, room: Room, round: Round, now: Date): Promise<void> {
  const participants = await listParticipants(tx, room.id);
  const votes = await listVotes(tx, room.id, round.number);
  // Todos los presentes pueden votar el ballotage: votantes de la ronda + espectadores.
  const outcome = scoreRound({ votes, eligibleRunoffVoterIds: participants.map((p) => p.id), rng: cryptoRng });

  if (outcome.kind === 'runoff') {
    await updateRound(tx, room.id, round.number, { outcome, runoffDeadline: after(now, RUNOFF_MS) });
  } else {
    const fullResult = resultFromRound(outcome, votes);
    if (outcome.kind === 'roulette') {
      await updateRound(tx, room.id, round.number, {
        outcome,
        fullResult,
        roulette: { segments: outcome.finalists, winner: outcome.winner },
        rouletteEndsAt: after(now, ROULETTE_MS),
      });
    } else {
      await updateRound(tx, room.id, round.number, { outcome, fullResult });
    }
    await logResolved(tx, room, round, fullResult, now);
  }
  await setRoomPhase(tx, room.id, phaseAfterRound(outcome.kind));
}

/** Cierra el ballotage. Llamar solo con la sala bloqueada y en fase `runoff`. */
export async function resolveRunoff(tx: Db, room: Room, round: Round, now: Date): Promise<void> {
  if (round.outcome?.kind !== 'runoff') throw new Error(`Round ${round.number} of ${room.id} has no runoff`);
  const votes = await listVotes(tx, room.id, round.number);
  const runoffVotes = await listRunoffVotes(tx, room.id, round.number);
  const runoff = scoreRunoff({ finalists: round.outcome.finalists, runoffVotes, rng: cryptoRng });
  const fullResult = resultFromRunoff(round.outcome, runoff, votes, runoffVotes);

  if (runoff.kind === 'roulette') {
    await updateRound(tx, room.id, round.number, {
      fullResult,
      roulette: { segments: runoff.finalists, winner: runoff.winner },
      rouletteEndsAt: after(now, ROULETTE_MS),
    });
  } else {
    await updateRound(tx, room.id, round.number, { fullResult });
  }
  await logResolved(tx, room, round, fullResult, now);
  await setRoomPhase(tx, room.id, phaseAfterRunoff(runoff.kind));
}
```

- [ ] **Step 4: Implementar `lib/server/commands/round.ts`**

```ts
import { CATEGORY_IDS, isCategoryId } from '@/lib/domain/categories';
import { canTransition } from '@/lib/domain/room-machine';
import type { CategoryId, Vote, VoteValue } from '@/lib/domain/types';
import type { ErrorCode } from '@/lib/shared/api-types';
import { AppError } from '../errors';
import { isSpectator } from '../public-snapshot';
import { requireHost, requireParticipant, requireRound, withRoomTx } from '../room-context';
import {
  insertEvent,
  insertRound,
  insertRunoffVote,
  insertVote,
  listParticipants,
  listRunoffVotes,
  listVotes,
  setRoomPhase,
  startRoomRound,
  type Participant,
  type Round,
} from '../room-repository';
import { MIN_PARTICIPANTS } from './rooms';
import { resolveRunoff, resolveVoting } from './resolve';

const VOTE_VALUES: VoteValue[] = ['super', 'yes', 'no'];

/** Algunas validaciones deben confirmar la transacción (p. ej. cerrar la ronda) y recién después rechazar. */
type Outcome = { rejected: ErrorCode | null };

function rejectIf(outcome: Outcome): { ok: true } {
  if (outcome.rejected) throw new AppError(outcome.rejected);
  return { ok: true };
}

function parseCategory(body: unknown): CategoryId {
  const categoryId = (body as { categoryId?: unknown } | null)?.categoryId;
  if (!isCategoryId(categoryId)) throw new AppError('INVALID_INPUT');
  return categoryId;
}

function parseVoteValue(body: unknown): VoteValue {
  const value = (body as { value?: unknown } | null)?.value;
  if (!VOTE_VALUES.includes(value as VoteValue)) throw new AppError('INVALID_INPUT');
  return value as VoteValue;
}

function allVotersFinished(participants: Participant[], round: Round, votes: Vote[]): boolean {
  const voters = participants.filter((p) => !isSpectator(p, round));
  return voters.every((p) => votes.filter((v) => v.participantId === p.id).length >= CATEGORY_IDS.length);
}

export async function startRound(roomId: string, token: string | null, now: Date): Promise<{ roundNumber: number }> {
  return withRoomTx(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    requireHost(room, me);
    if (!canTransition(room.phase, 'start')) throw new AppError('WRONG_PHASE');
    const participants = await listParticipants(tx, roomId);
    if (participants.length < MIN_PARTICIPANTS) throw new AppError('NOT_ENOUGH_PLAYERS');
    const number = room.currentRound + 1;
    await insertRound(tx, {
      roomId,
      number,
      startedAt: now,
      deadline: new Date(now.getTime() + room.config.roundSeconds * 1000),
    });
    await startRoomRound(tx, roomId, number);
    await insertEvent(tx, 'round_started', roomId, { round: number });
    return { roundNumber: number };
  });
}

export async function castVote(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }> {
  const categoryId = parseCategory(body);
  const value = parseVoteValue(body);
  const outcome = await withRoomTx<Outcome>(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    if (!canTransition(room.phase, 'vote')) return { rejected: 'WRONG_PHASE' };
    const round = await requireRound(tx, room);
    if (now.getTime() >= round.deadline.getTime()) {
      await resolveVoting(tx, room, round, now);
      return { rejected: 'WRONG_PHASE' };
    }
    if (isSpectator(me, round)) return { rejected: 'SPECTATOR' };

    const votes = await listVotes(tx, roomId, round.number);
    const mine = votes.filter((v) => v.participantId === me.id);
    if (mine.some((v) => v.categoryId === categoryId)) return { rejected: 'ALREADY_VOTED' };
    if (value === 'super' && mine.some((v) => v.value === 'super')) return { rejected: 'SUPER_ALREADY_USED' };

    const vote: Vote = { participantId: me.id, categoryId, value };
    await insertVote(tx, roomId, round.number, vote);
    const participants = await listParticipants(tx, roomId);
    if (allVotersFinished(participants, round, [...votes, vote])) await resolveVoting(tx, room, round, now);
    return { rejected: null };
  });
  return rejectIf(outcome);
}

export async function closeIfDue(roomId: string, now: Date): Promise<{ ok: true }> {
  await withRoomTx(roomId, now, async (tx, room) => {
    if (room.currentRound === 0) return;
    const round = await requireRound(tx, room);
    const t = now.getTime();
    if (canTransition(room.phase, 'close_voting') && t >= round.deadline.getTime()) {
      await resolveVoting(tx, room, round, now);
    } else if (canTransition(room.phase, 'close_runoff') && round.runoffDeadline && t >= round.runoffDeadline.getTime()) {
      await resolveRunoff(tx, room, round, now);
    } else if (canTransition(room.phase, 'finish_roulette') && round.rouletteEndsAt && t >= round.rouletteEndsAt.getTime()) {
      await setRoomPhase(tx, roomId, 'result');
    }
  });
  return { ok: true };
}

export async function castRunoffVote(roomId: string, token: string | null, body: unknown, now: Date): Promise<{ ok: true }> {
  const categoryId = parseCategory(body);
  const outcome = await withRoomTx<Outcome>(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    if (!canTransition(room.phase, 'runoff_vote')) return { rejected: 'WRONG_PHASE' };
    const round = await requireRound(tx, room);
    if (round.runoffDeadline && now.getTime() >= round.runoffDeadline.getTime()) {
      await resolveRunoff(tx, room, round, now);
      return { rejected: 'WRONG_PHASE' };
    }
    if (round.outcome?.kind !== 'runoff' || !round.outcome.finalists.includes(categoryId)) {
      return { rejected: 'INVALID_INPUT' };
    }
    const existing = await listRunoffVotes(tx, roomId, round.number);
    if (existing.some((v) => v.participantId === me.id)) return { rejected: 'ALREADY_VOTED' };

    await insertRunoffVote(tx, roomId, round.number, { participantId: me.id, categoryId });
    const participants = await listParticipants(tx, roomId);
    if (existing.length + 1 >= participants.length) await resolveRunoff(tx, room, round, now);
    return { rejected: null };
  });
  return rejectIf(outcome);
}
```

- [ ] **Step 5: Crear las rutas**

`app/api/rooms/[roomId]/start/route.ts`:

```ts
import { startRound } from '@/lib/server/commands/round';
import { handle, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => startRound(roomId, tokenFrom(req), new Date()));
}
```

`app/api/rooms/[roomId]/vote/route.ts`:

```ts
import { castVote } from '@/lib/server/commands/round';
import { handle, readJson, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => castVote(roomId, tokenFrom(req), await readJson(req), new Date()));
}
```

`app/api/rooms/[roomId]/close/route.ts`:

```ts
import { closeIfDue } from '@/lib/server/commands/round';
import { handle } from '@/lib/server/http';

export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => closeIfDue(roomId, new Date()));
}
```

`app/api/rooms/[roomId]/runoff-vote/route.ts`:

```ts
import { castRunoffVote } from '@/lib/server/commands/round';
import { handle, readJson, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => castRunoffVote(roomId, tokenFrom(req), await readJson(req), new Date()));
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npm run test:server && npm test && npm run typecheck`
Expected: PASS todo.

- [ ] **Step 7: Commit**

```bash
git add lib/server/commands app/api tests/server
git commit -m "feat(api): start, vote, close and runoff endpoints with server-side resolution"
```

---

### Task 11: Heartbeat, traspaso de anfitrión y "Jugar otra ronda"

**Files:**
- Modify: `lib/server/commands/rooms.ts` (agregar `heartbeat`, `replay`, `HOST_TIMEOUT_MS`)
- Create: `app/api/rooms/[roomId]/heartbeat/route.ts`, `app/api/rooms/[roomId]/replay/route.ts`
- Test: `tests/server/host.test.ts`

**Interfaces:**
- Consumes: Tasks 7–10.
- Produces: `HOST_TIMEOUT_MS = 30_000`; `heartbeat(roomId, token, now): Promise<{ hostParticipantId: string | null }>`; `replay(roomId, token, now): Promise<{ ok: true }>`; rutas `POST /heartbeat`, `POST /replay`.

- [ ] **Step 1: Escribir los tests (fallan)**

`tests/server/host.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getMe, heartbeat, joinRoom, replay } from '@/lib/server/commands/rooms';
import { startRound } from '@/lib/server/commands/round';
import { at, countEvents, readSnapshot, resetDb, setupRoom, voteAll } from './helpers';

describe('host transfer', () => {
  beforeEach(resetDb);

  it('does not transfer before 30 s without signal', async () => {
    const { roomId, players } = await setupRoom(3);
    await heartbeat(roomId, players[1].token, at(30_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
  });

  it('transfers to the earliest-joined active participant after 30 s in the lobby', async () => {
    const { roomId, players } = await setupRoom(3);
    await heartbeat(roomId, players[2].token, at(20_000));
    await heartbeat(roomId, players[2].token, at(31_000));
    // P1 (players[1]) entró antes que P2 pero no da señal desde T0 -> el rol va a P2
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[2].participantId);
  });

  it('the original host does not get the role back when reconnecting', async () => {
    const { roomId, players } = await setupRoom(2);
    await heartbeat(roomId, players[1].token, at(31_000));
    await heartbeat(roomId, players[0].token, at(32_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[1].participantId);
    expect((await getMe(roomId, players[0].token, at(32_000))).isHost).toBe(false);
  });

  it('never transfers during voting (the round does not depend on the host)', async () => {
    const { roomId, players } = await setupRoom(2);
    await startRound(roomId, players[0].token, at(1_000));
    await heartbeat(roomId, players[1].token, at(45_000));
    expect((await readSnapshot(roomId)).hostParticipantId).toBe(players[0].participantId);
  });
});

describe('replay', () => {
  beforeEach(resetDb);

  async function finishedRoom() {
    const room = await setupRoom(2);
    await startRound(room.roomId, room.players[0].token, at(1_000));
    await voteAll(room.roomId, room.players[0].token, { pizza: 'super' }, at(2_000));
    await voteAll(room.roomId, room.players[1].token, { pizza: 'super' }, at(2_000));
    return room;
  }

  it('only the host, only from result', async () => {
    const { roomId, players } = await finishedRoom();
    await expect(replay(roomId, players[1].token, at(3_000))).rejects.toMatchObject({ code: 'NOT_HOST' });
    await replay(roomId, players[0].token, at(3_000));
    expect((await readSnapshot(roomId)).phase).toBe('lobby');
    expect((await readSnapshot(roomId)).round).toBeUndefined();
    await expect(replay(roomId, players[0].token, at(3_000))).rejects.toMatchObject({ code: 'WRONG_PHASE' });
    expect(await countEvents(roomId, 'replay')).toBe(1);
  });

  it('someone who joined during the previous round votes normally in the next one', async () => {
    const { roomId, players } = await finishedRoom();
    const late = await joinRoom(roomId, { nickname: 'Late' }, at(2_500));
    await replay(roomId, players[0].token, at(3_000));
    await startRound(roomId, players[0].token, at(4_000));
    const me = await getMe(roomId, late.token, at(5_000));
    expect(me).toMatchObject({ roundNumber: 2, isSpectator: false });
    expect(me.cardOrder).toHaveLength(14);
  });
});
```

Run: `npm run test:server` → Expected: FAIL (`heartbeat`/`replay` no exportados).

- [ ] **Step 2: Implementar en `lib/server/commands/rooms.ts`**

Agregar a los imports de `../room-repository`: `setRoomPhase`, `touchParticipant`. Agregar al final del archivo:

```ts
export const HOST_TIMEOUT_MS = 30_000;

/**
 * Marca al participante como conectado. En `lobby`/`result`, si el anfitrión lleva más de 30 s sin
 * señal, pasa el rol al participante activo que entró primero. Solo reescribe la foto si cambió el rol.
 */
export async function heartbeat(
  roomId: string,
  token: string | null,
  now: Date,
): Promise<{ hostParticipantId: string | null }> {
  let hostChanged = false;
  const hostParticipantId = await withRoomTx(
    roomId,
    now,
    async (tx, room) => {
      const me = await requireParticipant(tx, room, token);
      await touchParticipant(tx, me.id, now);
      if (room.phase !== 'lobby' && room.phase !== 'result') return room.hostParticipantId;

      const participants = (await listParticipants(tx, roomId)).map((p) => (p.id === me.id ? { ...p, lastSeenAt: now } : p));
      const isActive = (lastSeenAt: Date) => now.getTime() - lastSeenAt.getTime() <= HOST_TIMEOUT_MS;
      const host = participants.find((p) => p.id === room.hostParticipantId);
      if (host && isActive(host.lastSeenAt)) return room.hostParticipantId;

      const candidate = participants.find((p) => isActive(p.lastSeenAt)); // ya vienen ordenados por joined_at
      if (!candidate || candidate.id === room.hostParticipantId) return room.hostParticipantId;
      await setRoomHost(tx, roomId, candidate.id);
      hostChanged = true;
      return candidate.id;
    },
    { snapshot: false },
  );
  if (hostChanged) await transaction((tx) => writePublicSnapshot(tx, roomId));
  return { hostParticipantId };
}

export async function replay(roomId: string, token: string | null, now: Date): Promise<{ ok: true }> {
  await withRoomTx(roomId, now, async (tx, room) => {
    const me = await requireParticipant(tx, room, token);
    requireHost(room, me);
    if (!canTransition(room.phase, 'replay')) throw new AppError('WRONG_PHASE');
    await setRoomPhase(tx, roomId, 'lobby');
    await insertEvent(tx, 'replay', roomId);
  });
  return { ok: true };
}
```

- [ ] **Step 3: Crear las rutas**

`app/api/rooms/[roomId]/heartbeat/route.ts`:

```ts
import { heartbeat } from '@/lib/server/commands/rooms';
import { handle, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => heartbeat(roomId, tokenFrom(req), new Date()));
}
```

`app/api/rooms/[roomId]/replay/route.ts`:

```ts
import { replay } from '@/lib/server/commands/rooms';
import { handle, tokenFrom } from '@/lib/server/http';

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  return handle(async () => replay(roomId, tokenFrom(req), new Date()));
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm run test:server && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/commands/rooms.ts app/api tests/server/host.test.ts
git commit -m "feat(api): heartbeat with host transfer and replay"
```

---

### Task 12: Infraestructura del cliente (reloj, sesión, API, tiempo real, timers, gestos, mensajes)

**Files:**
- Create: `lib/client/clock.ts`, `lib/client/session-token.ts`, `lib/client/api.ts`, `lib/client/supabase-browser.ts`, `lib/client/use-room.ts`, `lib/client/use-room-timers.ts`, `lib/client/messages.ts`, `lib/client/swipe.ts`
- Test: `tests/client/clock.test.ts`, `tests/client/api.test.ts`, `tests/client/swipe.test.ts`, `tests/client/due-at.test.ts`

**Interfaces:**
- Consumes: `ErrorCode`, `PublicSnapshot`, `MeResponse`, `SessionResponse`, `RoomConfig`, `CategoryId`, `VoteValue`.
- Produces:
  - `clock.ts`: `updateServerTime(serverTime: number, receivedAt?: number)`, `serverNow(): number`, `msUntil(iso: string): number`, `resetClock()`
  - `session-token.ts`: `type Session = { participantId: string; token: string }`, `getSession(roomId)`, `saveSession(roomId, session)`, `clearSession(roomId)`
  - `api.ts`: `class ApiError extends Error { code: ErrorCode | 'NETWORK' }`, `createRoom(nickname)`, `joinRoom(roomId, nickname)`, `getMe(roomId, token)`, `markOpened(roomId)`, `updateConfig(roomId, token, config)`, `startRound(roomId, token)`, `sendVote(roomId, token, { categoryId, value })` (reintenta en `NETWORK`, `ALREADY_VOTED` = éxito), `sendRunoffVote(roomId, token, categoryId)`, `closeRoom(roomId)`, `heartbeat(roomId, token)`, `replay(roomId, token)`
  - `supabase-browser.ts`: `getBrowserSupabase(): SupabaseClient`
  - `use-room.ts`: `type RoomState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; snapshot: PublicSnapshot; reconnecting: boolean }`, `useRoom(roomId): RoomState`
  - `use-room-timers.ts`: `dueAt(snapshot: PublicSnapshot): string | null`, `useRoomTimers(roomId, snapshot: PublicSnapshot | null, token: string | null): void`
  - `messages.ts`: `ERROR_MESSAGES: Record<ErrorCode | 'NETWORK', string>`, `messageFor(error: unknown): string`
  - `swipe.ts`: `SWIPE_DISTANCE = 110`, `SWIPE_VELOCITY = 600`, `HINT_DISTANCE = 40`, `classifySwipe(offset, velocity): VoteValue | null`, `hintFor(offset): VoteValue | null`

- [ ] **Step 1: Escribir los tests (fallan)**

`tests/client/clock.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { msUntil, resetClock, serverNow, updateServerTime } from '@/lib/client/clock';

describe('server clock (Review Focus 4)', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetClock();
  });

  it('corrects a device clock that is 5 minutes ahead', () => {
    const server = Date.parse('2026-10-01T20:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(server + 5 * 60_000);
    updateServerTime(server);
    expect(serverNow()).toBe(server);
    expect(msUntil(new Date(server + 60_000).toISOString())).toBe(60_000);
  });

  it('without server time it falls back to the device clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    expect(serverNow()).toBe(1_000);
  });
});
```

`tests/client/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sendVote } from '@/lib/client/api';

const json = (status: number, body: object) =>
  new Response(JSON.stringify({ ...body, serverTime: Date.now() }), { status, headers: { 'content-type': 'application/json' } });

describe('sendVote (Review Focus 2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries after a network error and treats ALREADY_VOTED as success', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(409, { error: { code: 'ALREADY_VOTED', message: '' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendVote('room0001', 'tok', { categoryId: 'pizza', value: 'yes' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers['x-participant-token']).toBe('tok');
  });

  it('surfaces other errors with their code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(409, { error: { code: 'SUPER_ALREADY_USED', message: '' } })));
    await expect(sendVote('room0001', 'tok', { categoryId: 'pizza', value: 'super' })).rejects.toMatchObject({
      code: 'SUPER_ALREADY_USED',
    });
  });

  it('gives up after 3 network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(sendVote('room0001', 'tok', { categoryId: 'pizza', value: 'no' })).rejects.toBeInstanceOf(ApiError);
  });
});
```

`tests/client/swipe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifySwipe, hintFor } from '@/lib/client/swipe';

const still = { x: 0, y: 0 };

describe('classifySwipe', () => {
  it.each([
    [{ x: 150, y: 10 }, still, 'yes'],
    [{ x: -150, y: 10 }, still, 'no'],
    [{ x: 20, y: -150 }, still, 'super'],
    [{ x: 30, y: 0 }, { x: 900, y: 0 }, 'yes'], // flick rápido
    [{ x: 0, y: -30 }, { x: 0, y: -900 }, 'super'],
    [{ x: 50, y: 40 }, still, null], // no alcanza
    [{ x: 0, y: 150 }, still, null], // hacia abajo no hace nada
  ] as const)('offset %j velocity %j -> %s', (offset, velocity, expected) => {
    expect(classifySwipe(offset, velocity)).toBe(expected);
  });
});

describe('hintFor', () => {
  it('shows a hint earlier than the commit threshold', () => {
    expect(hintFor({ x: 50, y: 0 })).toBe('yes');
    expect(hintFor({ x: -50, y: 0 })).toBe('no');
    expect(hintFor({ x: 0, y: -50 })).toBe('super');
    expect(hintFor({ x: 10, y: 10 })).toBeNull();
  });
});
```

`tests/client/due-at.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dueAt } from '@/lib/client/use-room-timers';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import type { PublicSnapshot } from '@/lib/shared/api-types';

const base: PublicSnapshot = {
  roomId: 'room0001',
  version: 1,
  phase: 'lobby',
  expiresAt: '2026-10-01T21:00:00.000Z',
  hostParticipantId: 'p1',
  config: DEFAULT_CONFIG,
  participants: [],
};
const round = { number: 1, deadline: 'D', finishedCount: 0, voterCount: 2, spectatorIds: [] };

describe('dueAt', () => {
  it('lobby and result have nothing to close', () => {
    expect(dueAt(base)).toBeNull();
    expect(dueAt({ ...base, phase: 'result', round })).toBeNull();
  });

  it('picks the deadline of the current phase', () => {
    expect(dueAt({ ...base, phase: 'voting', round })).toBe('D');
    expect(dueAt({ ...base, phase: 'runoff', round: { ...round, runoffDeadline: 'R' } })).toBe('R');
    expect(dueAt({ ...base, phase: 'roulette', round: { ...round, roulette: { segments: [], winner: 'pizza', endsAt: 'E' } } })).toBe('E');
  });
});
```

Run: `npm test` → Expected: FAIL (imports inexistentes).

- [ ] **Step 2: Implementar `lib/client/clock.ts`**

```ts
let offsetMs = 0;

/** Ajusta el desfase con la hora del servidor (viene en cada respuesta de la API). */
export function updateServerTime(serverTime: number, receivedAt: number = Date.now()): void {
  offsetMs = serverTime - receivedAt;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function msUntil(iso: string): number {
  return Date.parse(iso) - serverNow();
}

export function resetClock(): void {
  offsetMs = 0;
}
```

- [ ] **Step 3: Implementar `lib/client/session-token.ts`**

```ts
export type Session = { participantId: string; token: string };

const key = (roomId: string) => `antojitos:session:${roomId}`;

export function getSession(roomId: string): Session | null {
  try {
    const raw = localStorage.getItem(key(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    return typeof parsed.participantId === 'string' && typeof parsed.token === 'string'
      ? { participantId: parsed.participantId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(roomId: string, session: Session): void {
  try {
    localStorage.setItem(key(roomId), JSON.stringify(session));
  } catch {
    // Sin storage (modo privado estricto): la sesión dura lo que la pestaña.
  }
}

export function clearSession(roomId: string): void {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    // ignorar
  }
}
```

- [ ] **Step 4: Implementar `lib/client/api.ts`**

```ts
import type { CategoryId, RoomConfig, VoteValue } from '@/lib/domain/types';
import type { ErrorCode, MeResponse, SessionResponse } from '@/lib/shared/api-types';
import { updateServerTime } from './clock';

export class ApiError extends Error {
  constructor(public readonly code: ErrorCode | 'NETWORK') {
    super(code);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, opts: { token?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers['x-participant-token'] = opts.token;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const data = (await res.json().catch(() => ({}))) as { serverTime?: number; error?: { code?: ErrorCode } };
  if (typeof data.serverTime === 'number') updateServerTime(data.serverTime);
  if (!res.ok) throw new ApiError(data.error?.code ?? 'INTERNAL');
  return data as T;
}

const room = (roomId: string, action: string) => `/api/rooms/${encodeURIComponent(roomId)}/${action}`;

export const createRoom = (nickname: string) => call<SessionResponse>('POST', '/api/rooms', { body: { nickname } });

export const joinRoom = (roomId: string, nickname: string) =>
  call<SessionResponse>('POST', room(roomId, 'join'), { body: { nickname } });

export const getMe = (roomId: string, token: string) => call<MeResponse>('GET', room(roomId, 'me'), { token });

export const markOpened = (roomId: string) => call<{ ok: true }>('POST', room(roomId, 'opened'));

export const updateConfig = (roomId: string, token: string, config: RoomConfig) =>
  call<{ ok: true }>('POST', room(roomId, 'config'), { token, body: config });

export const startRound = (roomId: string, token: string) =>
  call<{ roundNumber: number }>('POST', room(roomId, 'start'), { token });

/** Reintenta hasta 3 veces ante fallas de red. Si el servidor ya lo tenía, es éxito. */
export async function sendVote(
  roomId: string,
  token: string,
  vote: { categoryId: CategoryId; value: VoteValue },
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await call('POST', room(roomId, 'vote'), { token, body: vote });
      return;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_VOTED') return;
      if (error instanceof ApiError && error.code === 'NETWORK' && attempt < 3) continue;
      throw error;
    }
  }
}

export const sendRunoffVote = (roomId: string, token: string, categoryId: CategoryId) =>
  call<{ ok: true }>('POST', room(roomId, 'runoff-vote'), { token, body: { categoryId } });

export const closeRoom = (roomId: string) => call<{ ok: true }>('POST', room(roomId, 'close'));

export const heartbeat = (roomId: string, token: string) =>
  call<{ hostParticipantId: string | null }>('POST', room(roomId, 'heartbeat'), { token });

export const replay = (roomId: string, token: string) => call<{ ok: true }>('POST', room(roomId, 'replay'), { token });
```

- [ ] **Step 5: Implementar `lib/client/swipe.ts`**

```ts
import type { VoteValue } from '@/lib/domain/types';

export const SWIPE_DISTANCE = 110;
export const SWIPE_VELOCITY = 600;
export const HINT_DISTANCE = 40;

type Vec = { x: number; y: number };

function direction(offset: Vec, velocity: Vec, distance: number, speed: number): VoteValue | null {
  const upward = -offset.y > Math.abs(offset.x) || -velocity.y > Math.abs(velocity.x);
  if (upward && (-offset.y > distance || -velocity.y > speed)) return 'super';
  if (!upward && (Math.abs(offset.x) > distance || Math.abs(velocity.x) > speed)) {
    const sign = offset.x !== 0 ? offset.x : velocity.x;
    return sign > 0 ? 'yes' : 'no';
  }
  return null;
}

/** Arriba = súper antojo, derecha = me va, izquierda = paso. Hacia abajo no hace nada. */
export function classifySwipe(offset: Vec, velocity: Vec): VoteValue | null {
  return direction(offset, velocity, SWIPE_DISTANCE, SWIPE_VELOCITY);
}

export function hintFor(offset: Vec): VoteValue | null {
  return direction(offset, { x: 0, y: 0 }, HINT_DISTANCE, Infinity);
}
```

- [ ] **Step 6: Implementar `lib/client/messages.ts`**

```ts
import type { ErrorCode } from '@/lib/shared/api-types';
import { ApiError } from './api';

export const ERROR_MESSAGES: Record<ErrorCode | 'NETWORK', string> = {
  ROOM_NOT_FOUND: 'Esta sala no existe.',
  ROOM_EXPIRED: 'Esta sala expiró.',
  ROOM_FULL: 'La sala está llena (15/15).',
  NICKNAME_TAKEN: 'Ese apodo ya lo está usando alguien en la sala. Probá con otro.',
  INVALID_NICKNAME: 'El apodo tiene que tener entre 1 y 20 caracteres.',
  INVALID_TOKEN: 'No te reconocemos en esta sala. Volvé a entrar con tu apodo.',
  NOT_HOST: 'Solo quien arma la sala puede hacer eso.',
  WRONG_PHASE: 'Eso ya no se puede hacer en este momento.',
  NOT_ENOUGH_PLAYERS: 'Hacen falta al menos 2 personas para arrancar.',
  SUPER_ALREADY_USED: 'Ya usaste tu súper antojo.',
  ALREADY_VOTED: 'Ya votaste esa.',
  SPECTATOR: 'Esta ronda ya arrancó. Votás en la próxima.',
  INVALID_INPUT: 'Algo no salió bien. Probá de nuevo.',
  INTERNAL: 'Se nos quemó algo en la cocina. Probá de nuevo.',
  NETWORK: 'Sin conexión. Revisá tu internet.',
};

export function messageFor(error: unknown): string {
  return error instanceof ApiError ? ERROR_MESSAGES[error.code] : ERROR_MESSAGES.INTERNAL;
}
```

- [ ] **Step 7: Implementar `lib/client/supabase-browser.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Cliente anon: solo puede leer room_public (RLS). */
export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}
```

- [ ] **Step 8: Implementar `lib/client/use-room.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { getBrowserSupabase } from './supabase-browser';

export type RoomState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; snapshot: PublicSnapshot; reconnecting: boolean };

/** Foto pública de la sala: carga inicial + cambios por Realtime. Cada evento trae la foto completa. */
export function useRoom(roomId: string): RoomState {
  const [state, setState] = useState<RoomState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let currentVersion = -1;
    let cancelled = false;

    const apply = (snapshot: PublicSnapshot) => {
      if (cancelled || snapshot.version <= currentVersion) return;
      currentVersion = snapshot.version;
      setState({ status: 'ready', snapshot, reconnecting: false });
    };

    const load = async () => {
      const { data } = await supabase.from('room_public').select('snapshot').eq('room_id', roomId).maybeSingle();
      if (cancelled) return;
      if (data?.snapshot) apply(data.snapshot as PublicSnapshot);
      else setState((s) => (s.status === 'ready' ? s : { status: 'missing' }));
    };

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_public', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { snapshot?: PublicSnapshot } | null;
          if (row?.snapshot) apply(row.snapshot);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Al (re)conectar se vuelve a pedir la foto completa: no hay nada que reconciliar.
          void load();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState((s) => (s.status === 'ready' ? { ...s, reconnecting: true } : s));
        }
      });

    void load();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return state;
}
```

- [ ] **Step 9: Implementar `lib/client/use-room-timers.ts`**

```ts
'use client';

import { useEffect } from 'react';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { closeRoom, heartbeat } from './api';
import { msUntil } from './clock';

const HEARTBEAT_MS = 10_000;
const CLOSE_GRACE_MS = 250;
const CLOSE_RETRY_MS = 2_000;

/** Momento en que hay que pedirle al servidor que cierre la fase actual. */
export function dueAt(snapshot: PublicSnapshot): string | null {
  const round = snapshot.round;
  if (!round) return null;
  if (snapshot.phase === 'voting') return round.deadline;
  if (snapshot.phase === 'runoff') return round.runoffDeadline ?? null;
  if (snapshot.phase === 'roulette') return round.roulette?.endsAt ?? null;
  return null;
}

export function useRoomTimers(roomId: string, snapshot: PublicSnapshot | null, token: string | null): void {
  useEffect(() => {
    if (!token) return;
    const beat = () => void heartbeat(roomId, token).catch(() => undefined);
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [roomId, token]);

  const target = snapshot ? dueAt(snapshot) : null;
  useEffect(() => {
    if (!target) return;
    const fire = () => void closeRoom(roomId).catch(() => undefined);
    const wait = Math.max(0, msUntil(target)) + CLOSE_GRACE_MS;
    const first = setTimeout(fire, wait);
    const retry = setTimeout(fire, wait + CLOSE_RETRY_MS);
    return () => {
      clearTimeout(first);
      clearTimeout(retry);
    };
  }, [roomId, target]);
}
```

- [ ] **Step 10: Correr y verificar que pasa**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS, sin errores.

- [ ] **Step 11: Commit**

```bash
git add lib/client tests/client
git commit -m "feat(client): server clock, session, api client, realtime room hook, timers and swipe gestures"
```

---

### Task 13: Pantallas de inicio, ingreso y sala de espera

**Files:**
- Create: `components/Logo.tsx`, `components/NicknameForm.tsx`, `components/StatusScreen.tsx`, `components/RoomScreen.tsx`, `components/LobbyScreen.tsx`, `components/VisibilitySummary.tsx`, `components/HostControls.tsx`
- Modify: `app/page.tsx`
- Create: `app/j/[roomId]/page.tsx`

**Interfaces:**
- Consumes: Task 12 completo.
- Produces:
  - `RoomScreen({ roomId })`: orquesta sesión, foto pública, timers y `me`; elige la pantalla por fase. Expone a las pantallas de fase las props `{ roomId: string; session: Session; snapshot: PublicSnapshot; me: MeResponse; isHost: boolean }` (tipo `PhaseProps`, exportado desde `components/RoomScreen.tsx`).
  - `VISIBILITY_LABELS: { key: keyof VisibilityConfig; label: string }[]` (exportado desde `VisibilitySummary.tsx`).
  - `StatusScreen({ kind: 'loading' | 'missing' | 'expired' | 'full' })`.

La verificación de esta tarea es manual (los e2e llegan en Task 16).

- [ ] **Step 1: `components/Logo.tsx`**

```tsx
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="text-center">
      <p className={`font-black tracking-tight text-primary ${size === 'lg' ? 'text-5xl' : 'text-2xl'}`}>Antojitos</p>
      {size === 'lg' && <p className="mt-1 text-lg text-ink/70">Menos vueltas, más sabor</p>}
    </div>
  );
}
```

- [ ] **Step 2: `components/NicknameForm.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { messageFor } from '@/lib/client/messages';

export function NicknameForm({
  submitLabel,
  onSubmit,
}: {
  submitLabel: string;
  onSubmit: (nickname: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(nickname);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label htmlFor="nickname" className="text-sm font-bold">
        Tu apodo
      </label>
      <input
        id="nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={40}
        autoComplete="nickname"
        placeholder="Ej: Juli"
        className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-lg outline-none focus:border-primary"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || nickname.trim() === ''}
        className="rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-white shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Un segundo…' : submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: `components/StatusScreen.tsx`**

```tsx
import Link from 'next/link';
import { Logo } from './Logo';

const COPY = {
  loading: { title: 'Cargando…', body: null, cta: false },
  missing: { title: 'Esta sala no existe o ya expiró', body: 'Las salas duran una hora.', cta: true },
  expired: { title: 'Esta sala expiró', body: 'Las salas duran una hora.', cta: true },
  full: { title: 'La sala está llena', body: 'Ya hay 15 personas adentro.', cta: true },
} as const;

export function StatusScreen({ kind }: { kind: keyof typeof COPY }) {
  const copy = COPY[kind];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-extrabold">{copy.title}</h1>
      {copy.body && <p className="text-ink/70">{copy.body}</p>}
      {copy.cta && (
        <Link href="/" className="rounded-2xl bg-primary px-6 py-3 font-extrabold text-white">
          Crear una sala nueva
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 4: `app/page.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { NicknameForm } from '@/components/NicknameForm';
import { createRoom } from '@/lib/client/api';
import { saveSession } from '@/lib/client/session-token';

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" />
      <p className="text-center text-lg">
        ¿Qué se come? Armá una sala, compartí el link y que cada uno swipee en privado.
      </p>
      <NicknameForm
        submitLabel="Crear sala"
        onSubmit={async (nickname) => {
          const session = await createRoom(nickname);
          saveSession(session.roomId, { participantId: session.participantId, token: session.token });
          router.push(`/j/${session.roomId}`);
        }}
      />
    </main>
  );
}
```

- [ ] **Step 5: `components/VisibilitySummary.tsx`**

```tsx
import type { RoomConfig, VisibilityConfig } from '@/lib/domain/types';

export const VISIBILITY_LABELS: { key: keyof VisibilityConfig; label: string }[] = [
  { key: 'showRanking', label: 'Ranking completo de categorías' },
  { key: 'showScores', label: 'Puntaje por categoría' },
  { key: 'showSuperCounts', label: 'Cantidad de súper antojos' },
  { key: 'showTiebreakPath', label: 'Si hubo ballotage o ruleta, y cómo se llegó' },
  { key: 'showWhoVotedWhat', label: 'Quién votó qué' },
];

export function VisibilitySummary({ config }: { config: RoomConfig }) {
  const shown = VISIBILITY_LABELS.filter(({ key }) => config.visibility[key]);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-extrabold">Qué se va a mostrar al final</h2>
      {config.visibility.showWhoVotedWhat && (
        <p role="alert" className="mt-3 rounded-2xl bg-accent px-3 py-2 font-bold text-white">
          Ojo: al final todos van a ver quién votó qué.
        </p>
      )}
      <ul className="mt-3 space-y-1 text-sm">
        <li>✅ La categoría ganadora</li>
        {shown.map(({ key, label }) => (
          <li key={key}>✅ {label}</li>
        ))}
      </ul>
      {!config.visibility.showWhoVotedWhat && (
        <p className="mt-3 text-sm text-ink/70">🔒 Nadie ve lo que votó cada uno.</p>
      )}
      <p className="mt-3 text-sm text-ink/70">⏱️ Ronda de {config.roundSeconds} segundos.</p>
    </section>
  );
}
```

- [ ] **Step 6: `components/HostControls.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { startRound, updateConfig } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';
import { ROUND_SECONDS_OPTIONS, type RoomConfig, type RoundSeconds } from '@/lib/domain/types';
import { VISIBILITY_LABELS } from './VisibilitySummary';

export function HostControls({
  roomId,
  token,
  config,
  participantCount,
}: {
  roomId: string;
  token: string;
  config: RoomConfig;
  participantCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function save(next: RoomConfig) {
    setError(null);
    try {
      await updateConfig(roomId, token, next);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await startRound(roomId, token);
    } catch (err) {
      setError(messageFor(err));
      setStarting(false);
    }
  }

  const canStart = participantCount >= 2;

  return (
    <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-extrabold">Configuración (solo vos la ves)</h2>
      <ul className="space-y-2">
        <li>
          <label className="flex items-center gap-3 text-ink/60">
            <input type="checkbox" checked disabled className="size-5 accent-primary" />
            La categoría ganadora (siempre)
          </label>
        </li>
        {VISIBILITY_LABELS.map(({ key, label }) => (
          <li key={key}>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.visibility[key]}
                onChange={(e) => void save({ ...config, visibility: { ...config.visibility, [key]: e.target.checked } })}
                className="size-5 accent-primary"
              />
              {label}
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-center justify-between gap-3">
        <span>Duración de la ronda</span>
        <select
          value={config.roundSeconds}
          onChange={(e) => void save({ ...config, roundSeconds: Number(e.target.value) as RoundSeconds })}
          className="rounded-xl border-2 border-ink/10 bg-white px-3 py-2"
        >
          {ROUND_SECONDS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} s
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void start()}
        disabled={!canStart || starting}
        className="w-full rounded-2xl bg-primary px-4 py-4 text-xl font-extrabold text-white shadow-md disabled:opacity-50"
      >
        Empezar
      </button>
      {!canStart && <p className="text-center text-sm text-ink/70">Esperando que se sume alguien más…</p>}
    </section>
  );
}
```

- [ ] **Step 7: `components/LobbyScreen.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { PhaseProps } from './RoomScreen';
import { HostControls } from './HostControls';
import { Logo } from './Logo';
import { VisibilitySummary } from './VisibilitySummary';

export function LobbyScreen({ roomId, session, snapshot, isHost }: PhaseProps) {
  const [copied, setCopied] = useState(false);
  const host = snapshot.participants.find((p) => p.id === snapshot.hostParticipantId);

  async function share() {
    const url = `${window.location.origin}/j/${roomId}`;
    if (navigator.share) {
      await navigator.share({ title: 'Antojitos', text: '¿Qué se come? Sumate:', url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <Logo />
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">
          Participantes ({snapshot.participants.length}/15)
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {snapshot.participants.map((p) => (
            <li key={p.id} className="rounded-full bg-secondary/20 px-3 py-1 font-semibold">
              {p.nickname}
              {p.id === snapshot.hostParticipantId && ' 👑'}
              {p.id === session.participantId && ' (vos)'}
            </li>
          ))}
        </ul>
      </section>
      <button
        type="button"
        onClick={() => void share()}
        className="rounded-2xl border-2 border-primary px-4 py-3 font-extrabold text-primary"
      >
        {copied ? '¡Link copiado!' : 'Compartir link'}
      </button>
      <VisibilitySummary config={snapshot.config} />
      {isHost ? (
        <HostControls
          roomId={roomId}
          token={session.token}
          config={snapshot.config}
          participantCount={snapshot.participants.length}
        />
      ) : (
        <p className="text-center text-ink/70">Esperando que {host?.nickname ?? 'el anfitrión'} arranque la ronda…</p>
      )}
    </main>
  );
}
```

- [ ] **Step 8: `components/RoomScreen.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, getMe, joinRoom, markOpened } from '@/lib/client/api';
import { serverNow } from '@/lib/client/clock';
import { clearSession, getSession, saveSession, type Session } from '@/lib/client/session-token';
import { useRoom } from '@/lib/client/use-room';
import { useRoomTimers } from '@/lib/client/use-room-timers';
import type { MeResponse, PublicSnapshot } from '@/lib/shared/api-types';
import { LobbyScreen } from './LobbyScreen';
import { Logo } from './Logo';
import { NicknameForm } from './NicknameForm';
import { StatusScreen } from './StatusScreen';

export type PhaseProps = {
  roomId: string;
  session: Session;
  snapshot: PublicSnapshot;
  me: MeResponse;
  isHost: boolean;
};

function useHostChangeNotice(snapshot: PublicSnapshot | null): string | null {
  const previous = useRef<string | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const hostId = snapshot?.hostParticipantId;
  useEffect(() => {
    if (hostId === undefined) return;
    if (previous.current !== undefined && previous.current !== hostId) {
      const nickname = snapshot?.participants.find((p) => p.id === hostId)?.nickname;
      if (nickname) {
        setNotice(`Ahora ${nickname} es quien arranca la ronda`);
        const timer = setTimeout(() => setNotice(null), 4000);
        previous.current = hostId;
        return () => clearTimeout(timer);
      }
    }
    previous.current = hostId;
  }, [hostId, snapshot]);
  return notice;
}

export function RoomScreen({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<MeResponse | null>(null);
  const room = useRoom(roomId);
  const snapshot = room.status === 'ready' ? room.snapshot : null;

  useEffect(() => {
    const stored = getSession(roomId);
    setSession(stored);
    if (!stored) void markOpened(roomId).catch(() => undefined);
  }, [roomId]);

  useRoomTimers(roomId, snapshot, session?.token ?? null);
  const hostNotice = useHostChangeNotice(snapshot);

  // `me` (orden de tarjetas, votos propios, rol) se refresca al cambiar de ronda o de fase.
  const meKey = snapshot ? `${snapshot.round?.number ?? 0}:${snapshot.phase}:${snapshot.hostParticipantId}` : '';
  useEffect(() => {
    if (!session || !meKey) return;
    getMe(roomId, session.token)
      .then(setMe)
      .catch((error) => {
        if (error instanceof ApiError && error.code === 'INVALID_TOKEN') {
          clearSession(roomId);
          setSession(null);
        }
      });
  }, [roomId, session, meKey]);

  if (session === undefined || room.status === 'loading') return <StatusScreen kind="loading" />;
  if (room.status === 'missing' || !snapshot) return <StatusScreen kind="missing" />;
  if (Date.parse(snapshot.expiresAt) <= serverNow()) return <StatusScreen kind="expired" />;

  if (!session) {
    if (snapshot.participants.length >= 15) return <StatusScreen kind="full" />;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4">
        <Logo size="lg" />
        <p className="text-center text-lg">Te invitaron a decidir qué se come. ¿Cómo te llamamos?</p>
        <NicknameForm
          submitLabel="Entrar"
          onSubmit={async (nickname) => {
            const joined = await joinRoom(roomId, nickname);
            const next = { participantId: joined.participantId, token: joined.token };
            saveSession(roomId, next);
            setSession(next);
          }}
        />
      </main>
    );
  }

  const roundNumber = snapshot.round?.number ?? 0;
  if (!me || (snapshot.phase !== 'lobby' && me.roundNumber !== roundNumber)) return <StatusScreen kind="loading" />;

  const props: PhaseProps = {
    roomId,
    session,
    snapshot,
    me,
    isHost: snapshot.hostParticipantId === session.participantId,
  };

  return (
    <>
      {room.reconnecting && (
        <p className="fixed inset-x-0 top-0 z-50 bg-secondary py-1 text-center text-sm font-bold">Reconectando…</p>
      )}
      {hostNotice && (
        <p role="status" className="fixed inset-x-4 bottom-4 z-50 rounded-2xl bg-ink px-4 py-3 text-center font-bold text-white">
          {hostNotice}
        </p>
      )}
      {renderPhase(props)}
    </>
  );
}

function renderPhase(props: PhaseProps) {
  switch (props.snapshot.phase) {
    case 'lobby':
      return <LobbyScreen {...props} />;
    default:
      return <StatusScreen kind="loading" />;
  }
}
```

(Las fases `voting`, `runoff`, `roulette` y `result` se conectan en Tasks 14 y 15.)

- [ ] **Step 9: `app/j/[roomId]/page.tsx`**

```tsx
import { RoomScreen } from '@/components/RoomScreen';

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomScreen roomId={roomId} />;
}
```

- [ ] **Step 10: Verificación automática**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: todo sin errores.

- [ ] **Step 11: Verificación manual**

Con `npm run db:start` corriendo y `.env.local` completo: `npm run dev`. En una ventana normal y otra de incógnito (con la vista de celular de las DevTools):
1. Crear sala con "Ana" → se ve la sala de espera con "Ana 👑 (vos)" y el botón "Empezar" deshabilitado con "Esperando que se sume alguien más…".
2. Abrir el link en incógnito, entrar como "Beto" → en ambas ventanas aparece "Participantes (2/15)" sin recargar.
3. Destildar/tildar "Quién votó qué" como Ana → en la ventana de Beto aparece/desaparece el aviso fucsia.
4. Recargar la ventana de Beto → vuelve a la sala sin pedir apodo.
5. Abrir `/j/noexiste` → "Esta sala no existe o ya expiró".

- [ ] **Step 12: Commit**

```bash
git add app components
git commit -m "feat(ui): home, join and lobby screens with host configuration"
```

---

### Task 14: Pantalla de votación (swipe) y fotos

Requiere que Task 1 esté aprobada.

**Files:**
- Create: `scripts/convert-photos.mjs`, `public/categories/*.webp` (generadas)
- Create: `components/Countdown.tsx`, `components/SwipeDeck.tsx`, `components/VotingScreen.tsx`
- Modify: `components/RoomScreen.tsx` (función `renderPhase`)

**Interfaces:**
- Consumes: `PhaseProps`, `sendVote`, `ApiError`, `classifySwipe`, `hintFor`, `msUntil`, `categoryName`, `categoryImage`.
- Produces: `Countdown({ until: string })` (reusado en Task 15); `VotingScreen(props: PhaseProps)`; `SwipeDeck({ categoryId, superAvailable, onVote, onSuperBlocked })`. El DOM de la tarjeta lleva `data-testid="card"` y `data-category-id`; los botones tienen `aria-label` "Paso", "Súper antojo", "Me va" (los usa Playwright en Task 16).

- [ ] **Step 1: `scripts/convert-photos.mjs`**

```js
// Descarga las fotos aprobadas (scripts/category-photos.json) y las guarda como WebP 720x960.
import { mkdir, readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';

const photos = JSON.parse(await readFile(new URL('./category-photos.json', import.meta.url), 'utf8'));
await mkdir('public/categories', { recursive: true });

for (const [id, { imageUrl }] of Object.entries(photos)) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const out = `public/categories/${id}.webp`;
  await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(720, 960, { fit: 'cover', position: 'attention' })
    .webp({ quality: 68 })
    .toFile(out);
  console.log(`${id}: ${Math.round((await stat(out)).size / 1024)} KB`);
}
```

- [ ] **Step 2: Generar las fotos**

Run: `node scripts/convert-photos.mjs`
Expected: 14 líneas `<id>: <n> KB`, cada una ≤ 90 KB. Si alguna supera 90 KB, bajar `quality` a 60 y volver a correr. Abrir 2 o 3 archivos y verificar que el plato quedó centrado.

- [ ] **Step 3: `components/Countdown.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { msUntil } from '@/lib/client/clock';

export function Countdown({ until }: { until: string }) {
  const [ms, setMs] = useState(() => msUntil(until));
  useEffect(() => {
    setMs(msUntil(until));
    const id = setInterval(() => setMs(msUntil(until)), 250);
    return () => clearInterval(id);
  }, [until]);
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return (
    <span
      aria-label={`Quedan ${seconds} segundos`}
      className={`text-2xl font-black tabular-nums ${seconds <= 10 ? 'text-accent' : 'text-ink'}`}
    >
      {seconds}s
    </span>
  );
}
```

- [ ] **Step 4: `components/SwipeDeck.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { classifySwipe, hintFor } from '@/lib/client/swipe';
import { categoryImage, categoryName } from '@/lib/domain/categories';
import type { CategoryId, VoteValue } from '@/lib/domain/types';

const HINT_LABEL: Record<VoteValue, string> = { yes: 'ME VA', no: 'PASO', super: '¡SÚPER ANTOJO!' };
const HINT_STYLE: Record<VoteValue, string> = {
  yes: 'left-4 top-6 -rotate-12 border-secondary text-secondary',
  no: 'right-4 top-6 rotate-12 border-ink text-ink',
  super: 'inset-x-0 bottom-24 mx-auto w-fit border-accent text-accent',
};

export function SwipeDeck({
  categoryId,
  superAvailable,
  onVote,
  onSuperBlocked,
}: {
  categoryId: CategoryId;
  superAvailable: boolean;
  onVote: (value: VoteValue) => void;
  onSuperBlocked: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const [hint, setHint] = useState<VoteValue | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const busy = useRef(false);

  const springBack = () => {
    void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    void animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
  };

  async function commit(value: VoteValue) {
    if (busy.current) return;
    if (value === 'super' && !superAvailable) {
      setHint(null);
      springBack();
      onSuperBlocked();
      return;
    }
    busy.current = true;
    if (value === 'super') await animate(y, -900, { duration: 0.25 });
    else await animate(x, value === 'yes' ? 600 : -600, { duration: 0.25 });
    onVote(value);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      <div className="relative aspect-[3/4] w-full max-w-sm">
        <motion.div
          data-testid="card"
          data-category-id={categoryId}
          drag
          style={{ x, y, rotate }}
          onDrag={(_, info) => setHint(hintFor(info.offset))}
          onDragEnd={(_, info) => {
            setHint(null);
            const value = classifySwipe(info.offset, info.velocity);
            if (value) void commit(value);
            else springBack();
          }}
          className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden rounded-3xl bg-secondary shadow-xl active:cursor-grabbing"
        >
          {!imageFailed && (
            <Image
              src={categoryImage(categoryId)}
              alt=""
              fill
              sizes="(max-width: 448px) 100vw, 384px"
              draggable={false}
              priority
              onError={() => setImageFailed(true)}
              className="pointer-events-none object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-5 pt-16">
            <h2 className="text-3xl font-black text-white">{categoryName(categoryId)}</h2>
          </div>
          {hint && (
            <span className={`absolute rounded-xl border-4 bg-white/90 px-3 py-1 text-2xl font-black ${HINT_STYLE[hint]}`}>
              {HINT_LABEL[hint]}
            </span>
          )}
        </motion.div>
      </div>

      <div className="flex items-center gap-6">
        <button
          type="button"
          aria-label="Paso"
          onClick={() => void commit('no')}
          className="grid size-16 place-items-center rounded-full bg-white text-3xl shadow-md active:scale-95"
        >
          ✗
        </button>
        <button
          type="button"
          aria-label="Súper antojo"
          aria-disabled={!superAvailable}
          onClick={() => void commit('super')}
          className={`grid size-20 place-items-center rounded-full text-4xl shadow-lg active:scale-95 ${
            superAvailable ? 'bg-accent text-white' : 'bg-ink/10 text-ink/30'
          }`}
        >
          ⭐
        </button>
        <button
          type="button"
          aria-label="Me va"
          onClick={() => void commit('yes')}
          className="grid size-16 place-items-center rounded-full bg-white text-3xl text-primary shadow-md active:scale-95"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `components/VotingScreen.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { ApiError, sendVote } from '@/lib/client/api';
import type { CategoryId, VoteValue } from '@/lib/domain/types';
import { Countdown } from './Countdown';
import type { PhaseProps } from './RoomScreen';
import { SwipeDeck } from './SwipeDeck';

export function VotingScreen({ roomId, session, snapshot, me }: PhaseProps) {
  const round = snapshot.round!;
  const [voted, setVoted] = useState(() => new Set<CategoryId>(me.myVotes.map((v) => v.categoryId)));
  const [superUsed, setSuperUsed] = useState(() => me.myVotes.some((v) => v.value === 'super'));
  const [notice, setNotice] = useState<string | null>(null);

  const isSpectator = me.isSpectator || round.spectatorIds.includes(session.participantId);
  const remaining = me.cardOrder.filter((id) => !voted.has(id));
  const current = remaining[0];

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(null), 1800);
  }

  async function vote(categoryId: CategoryId, value: VoteValue) {
    setVoted((prev) => new Set(prev).add(categoryId));
    if (value === 'super') setSuperUsed(true);
    try {
      await sendVote(roomId, session.token, { categoryId, value });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SUPER_ALREADY_USED') flash('Ya usaste tu súper antojo');
      // WRONG_PHASE: la ronda ya cerró; la foto pública nos lleva a la pantalla siguiente.
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <Countdown until={round.deadline} />
        <p className="text-sm font-bold text-ink/70">
          {round.finishedCount} de {round.voterCount} terminaron
        </p>
      </header>

      {isSpectator ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-5xl">👀</p>
          <h1 className="text-2xl font-extrabold">La ronda ya arrancó</h1>
          <p className="text-ink/70">Vas a ver el resultado y podés jugar la próxima. Si hay ballotage, votás.</p>
        </section>
      ) : current ? (
        <>
          <p className="text-center text-sm font-bold text-ink/60">
            {me.cardOrder.length - remaining.length + 1} de {me.cardOrder.length}
          </p>
          <SwipeDeck
            key={current}
            categoryId={current}
            superAvailable={!superUsed}
            onVote={(value) => void vote(current, value)}
            onSuperBlocked={() => flash('Ya usaste tu súper antojo')}
          />
        </>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-5xl">🙌</p>
          <h1 className="text-2xl font-extrabold">¡Listo! Esperando al resto…</h1>
        </section>
      )}

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-28 z-40 rounded-2xl bg-ink px-4 py-3 text-center font-bold text-white">
          {notice}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Conectar la fase en `components/RoomScreen.tsx`**

Agregar el import `import { VotingScreen } from './VotingScreen';` y reemplazar `renderPhase` por:

```tsx
function renderPhase(props: PhaseProps) {
  switch (props.snapshot.phase) {
    case 'lobby':
      return <LobbyScreen {...props} />;
    case 'voting':
      return <VotingScreen key={`voting-${props.me.roundNumber}`} {...props} />;
    default:
      return <StatusScreen kind="loading" />;
  }
}
```

- [ ] **Step 7: Verificación automática**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 8: Verificación manual**

Con dos ventanas (normal e incógnito, vista celular):
1. Ana empieza → ambos ven la cuenta regresiva desde 60 y la primera tarjeta con foto (el orden difiere entre los dos).
2. Arrastrar a la derecha muestra "ME VA" y al soltar pasa la siguiente; izquierda "PASO"; arriba "¡SÚPER ANTOJO!".
3. Usar el ⭐ una vez; luego swipe hacia arriba devuelve la tarjeta y muestra "Ya usaste tu súper antojo"; el botón ⭐ se ve gris.
4. Recargar a mitad: sigue en la misma tarjeta y el ⭐ sigue gastado.
5. Al terminar: "¡Listo! Esperando al resto…" y en la otra ventana "1 de 2 terminaron".

- [ ] **Step 9: Commit**

```bash
git add scripts/convert-photos.mjs public/categories components
git commit -m "feat(ui): swipe voting screen with category photos"
```

---

### Task 15: Ballotage, ruleta y resultado

**Files:**
- Create: `components/RunoffScreen.tsx`, `components/RouletteScreen.tsx`, `components/ResultScreen.tsx`
- Modify: `components/RoomScreen.tsx` (función `renderPhase`)

**Interfaces:**
- Consumes: `PhaseProps`, `Countdown`, `sendRunoffVote`, `replay`, `msUntil`, `categoryName`, `categoryImage`, `PublicResult`, `ResultPath`.
- Produces: `RunoffScreen(props: PhaseProps)`, `RouletteScreen(props: PhaseProps)`, `ResultScreen(props: PhaseProps)`. Textos que usa Playwright: "¡Hay empate!", "¡Se come {Categoría}!", "Jugar otra ronda", "No hubo antojos".

- [ ] **Step 1: `components/RunoffScreen.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ApiError, sendRunoffVote } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';
import { categoryImage, categoryName } from '@/lib/domain/categories';
import type { CategoryId } from '@/lib/domain/types';
import { Countdown } from './Countdown';
import type { PhaseProps } from './RoomScreen';

export function RunoffScreen({ roomId, session, snapshot, me }: PhaseProps) {
  const round = snapshot.round!;
  const finalists = round.finalists ?? [];
  const [choice, setChoice] = useState<CategoryId | null>(me.myRunoffVote);
  const [error, setError] = useState<string | null>(null);

  async function choose(categoryId: CategoryId) {
    if (choice) return;
    setChoice(categoryId);
    try {
      await sendRunoffVote(roomId, session.token, categoryId);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'ALREADY_VOTED' || err.code === 'WRONG_PHASE')) return;
      setChoice(null);
      setError(messageFor(err));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-primary">¡Hay empate!</h1>
        {round.runoffDeadline && <Countdown until={round.runoffDeadline} />}
      </header>
      <p className="text-lg">{choice ? 'Listo, ya votaste.' : 'Elegí una sola. La más votada gana.'}</p>
      <div className="grid gap-3">
        {finalists.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => void choose(id)}
            disabled={choice !== null}
            aria-pressed={choice === id}
            className={`relative h-32 overflow-hidden rounded-3xl bg-secondary text-left shadow-md transition ${
              choice === id ? 'ring-4 ring-primary' : choice ? 'opacity-50' : 'active:scale-[0.98]'
            }`}
          >
            <Image src={categoryImage(id)} alt="" fill sizes="448px" className="object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-4 text-2xl font-black text-white">
              {categoryName(id)}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <p className="text-center text-sm font-bold text-ink/70">
        {round.runoffVotedCount ?? 0} de {snapshot.participants.length} votaron
      </p>
    </main>
  );
}
```

- [ ] **Step 2: `components/RouletteScreen.tsx`**

```tsx
'use client';

import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { msUntil } from '@/lib/client/clock';
import { categoryName } from '@/lib/domain/categories';
import type { PhaseProps } from './RoomScreen';

const COLORS = ['#FF5722', '#FFB300', '#E91E63'];
const TURNS = 6;

export function RouletteScreen({ snapshot }: PhaseProps) {
  const roulette = snapshot.round!.roulette!;
  const [done, setDone] = useState(false);
  const segment = 360 / roulette.segments.length;
  const winnerIndex = roulette.segments.indexOf(roulette.winner);
  // Gira en sentido horario hasta dejar el centro del segmento ganador bajo la flecha (arriba).
  const target = 360 * TURNS + (360 - (winnerIndex + 0.5) * segment);
  // Se calcula una vez: quien entra tarde ve una animación más corta.
  const duration = useMemo(() => Math.max(1.5, msUntil(roulette.endsAt) / 1000 - 0.8), [roulette.endsAt]);
  const background = `conic-gradient(${roulette.segments
    .map((_, i) => `${COLORS[i % COLORS.length]} ${i * segment}deg ${(i + 1) * segment}deg`)
    .join(', ')})`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-black">¡A la ruleta!</h1>
      <p className="text-ink/70">Está re parejo. Que decida la suerte.</p>
      <div className="relative size-72">
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-4xl" aria-hidden>
          ▼
        </span>
        <motion.div
          className="relative size-full rounded-full border-8 border-white shadow-xl"
          style={{ background }}
          initial={{ rotate: 0 }}
          animate={{ rotate: target }}
          transition={{ duration, ease: [0.12, 0.8, 0.2, 1] }}
          onAnimationComplete={() => setDone(true)}
        >
          {roulette.segments.map((id, i) => (
            <span
              key={id}
              className="absolute left-1/2 top-1/2 origin-left whitespace-nowrap text-lg font-black text-white drop-shadow"
              style={{ transform: `rotate(${(i + 0.5) * segment - 90}deg) translateX(30px)` }}
            >
              {categoryName(id)}
            </span>
          ))}
        </motion.div>
      </div>
      <p className={`text-2xl font-black text-primary transition-opacity ${done ? 'opacity-100' : 'opacity-0'}`}>
        ¡Salió {categoryName(roulette.winner)}!
      </p>
    </main>
  );
}
```

- [ ] **Step 3: `components/ResultScreen.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { useState } from 'react';
import { replay } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';
import { categoryImage, categoryName } from '@/lib/domain/categories';
import type { CategoryId, PublicResult, ResultPath } from '@/lib/domain/types';
import type { PhaseProps } from './RoomScreen';

const PATH_TEXT: Record<ResultPath, string> = {
  no_cravings: 'Nadie sumó puntos.',
  direct: 'Ganó directo, sin discusión.',
  runoff: 'Se definió en el ballotage.',
  roulette_after_skip: 'Empate clavado: se fue directo a la ruleta.',
  roulette_after_runoff: 'El ballotage volvió a empatar: decidió la ruleta.',
};

const VOTE_ICON = { super: '⭐', yes: '✓', no: '✗' } as const;

function Breakdown({ result }: { result: PublicResult }) {
  const rows: CategoryId[] = result.ranking ?? result.scores?.map((s) => s.categoryId) ?? result.superCounts?.map((s) => s.categoryId) ?? [];
  if (rows.length === 0) return null;
  const score = (id: CategoryId) => result.scores?.find((s) => s.categoryId === id)?.score;
  const supers = (id: CategoryId) => result.superCounts?.find((s) => s.categoryId === id)?.superCount;
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-extrabold">{result.ranking ? 'Ranking' : 'Detalle'}</h2>
      <ol className="space-y-1">
        {rows.map((id, i) => (
          <li key={id} className="flex items-center justify-between gap-2">
            <span>
              {result.ranking && <span className="mr-2 font-bold text-ink/50">{i + 1}.</span>}
              {categoryName(id)}
            </span>
            <span className="font-bold tabular-nums">
              {score(id) !== undefined && `${score(id)} pts`}
              {supers(id) ? ` · ${supers(id)} ⭐` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ResultScreen({ roomId, session, snapshot, isHost }: PhaseProps) {
  const result = snapshot.round?.result;
  const [error, setError] = useState<string | null>(null);
  const host = snapshot.participants.find((p) => p.id === snapshot.hostParticipantId);
  if (!result) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      {result.winner ? (
        <motion.section
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="relative h-72 overflow-hidden rounded-3xl bg-secondary shadow-xl"
        >
          <Image src={categoryImage(result.winner)} alt="" fill sizes="448px" priority className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-20">
            <p className="text-sm font-bold uppercase tracking-wide text-secondary">🎉 ¡Match!</p>
            <h1 className="text-4xl font-black text-white">¡Se come {categoryName(result.winner)}!</h1>
          </div>
        </motion.section>
      ) : (
        <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-5xl">🤷</p>
          <h1 className="mt-2 text-3xl font-black">No hubo antojos</h1>
          <p className="mt-1 text-ink/70">Nadie sumó puntos. ¿Otra ronda?</p>
        </section>
      )}

      {result.tiebreak && result.winner && <p className="text-center font-bold text-ink/70">{PATH_TEXT[result.tiebreak.path]}</p>}

      {result.tiebreak?.runoffCounts && (
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-extrabold">Ballotage</h2>
          <ul className="space-y-1">
            {result.tiebreak.runoffCounts.map((c) => (
              <li key={c.categoryId} className="flex justify-between">
                <span>{categoryName(c.categoryId)}</span>
                <span className="font-bold">{c.votes} votos</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Breakdown result={result} />

      {result.individualVotes && (
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-extrabold">Quién votó qué</h2>
          <ul className="space-y-3">
            {result.individualVotes.map((person) => (
              <li key={person.nickname}>
                <p className="font-bold">{person.nickname}</p>
                <p className="text-sm text-ink/80">
                  {person.votes.filter((v) => v.value !== 'no').map((v) => `${VOTE_ICON[v.value]} ${categoryName(v.categoryId)}`).join(' · ') ||
                    'No le fue nada'}
                </p>
                {person.runoffChoice && (
                  <p className="text-sm text-ink/60">Ballotage: {categoryName(person.runoffChoice)}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      {isHost ? (
        <button
          type="button"
          onClick={() => replay(roomId, session.token).catch((err) => setError(messageFor(err)))}
          className="rounded-2xl bg-primary px-4 py-4 text-xl font-extrabold text-white shadow-md"
        >
          Jugar otra ronda
        </button>
      ) : (
        <p className="text-center text-ink/70">Si quieren otra, {host?.nickname ?? 'el anfitrión'} la arranca.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Conectar las fases en `components/RoomScreen.tsx`**

Agregar imports de `RunoffScreen`, `RouletteScreen`, `ResultScreen` y reemplazar `renderPhase` por:

```tsx
function renderPhase(props: PhaseProps) {
  switch (props.snapshot.phase) {
    case 'lobby':
      return <LobbyScreen {...props} />;
    case 'voting':
      return <VotingScreen key={`voting-${props.me.roundNumber}`} {...props} />;
    case 'runoff':
      return <RunoffScreen key={`runoff-${props.me.roundNumber}`} {...props} />;
    case 'roulette':
      return <RouletteScreen key={`roulette-${props.me.roundNumber}`} {...props} />;
    case 'result':
      return <ResultScreen {...props} />;
  }
}
```

- [ ] **Step 5: Verificación automática**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

Con dos ventanas:
1. **Victoria directa:** ambos ⭐ a Pizza, el resto "Paso" → "¡Se come Pizza!" con animación, ranking y "Ganó directo".
2. **Ballotage:** Ana ⭐ Pizza + ✓ Sushi; Beto ✓ Pizza + ✓ Sushi → "¡Hay empate!", cuenta desde 20; ambos eligen Sushi → "¡Se come Sushi!" y "Se definió en el ballotage".
3. **Ruleta:** Ana ✓ solo Pizza; Beto ✓ solo Sushi → ruleta que gira ~6 s y cae en el mismo lugar en ambas ventanas → resultado.
4. **Jugar otra ronda** (Ana) → ambos vuelven a la sala de espera.
5. Con "Quién votó qué" activado, el resultado muestra la sección con los votos de cada uno.

- [ ] **Step 7: Commit**

```bash
git add components
git commit -m "feat(ui): runoff, roulette and result screens"
```

---

### Task 16: E2E multiusuario, consultas de métricas y README

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/flows.spec.ts`
- Create: `docs/metrics.sql`
- Modify: `README.md`, `.gitignore` (agregar `test-results/` y `playwright-report/` si no están)

**Interfaces:**
- Consumes: la app completa; textos y `aria-label` de Tasks 13–15.

- [ ] **Step 1: Instalar el navegador de Playwright**

Run: `npx playwright install chromium`

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3000', ...devices['Pixel 7'] },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: `tests/e2e/helpers.ts`**

```ts
import { devices, expect, type Browser, type Page } from '@playwright/test';
import type { CategoryId, VoteValue } from '@/lib/domain/types';

const BUTTON: Record<VoteValue, string> = { super: 'Súper antojo', yes: 'Me va', no: 'Paso' };

export async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:3000' });
  return context.newPage();
}

export async function createRoomAs(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Tu apodo').fill(nickname);
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await page.waitForURL(/\/j\/[a-z0-9]{8}$/);
  await expect(page.getByText(/Participantes/)).toBeVisible();
  return page.url();
}

export async function joinAs(page: Page, url: string, nickname: string): Promise<void> {
  await page.goto(url);
  await page.getByLabel('Tu apodo').fill(nickname);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/Participantes/)).toBeVisible();
}

/** Vota con botones las tarjetas que le tocan, en el orden en que aparecen. */
export async function voteCards(
  page: Page,
  choices: Partial<Record<CategoryId, VoteValue>>,
  count = 14,
): Promise<CategoryId[]> {
  const seen: CategoryId[] = [];
  for (let i = 0; i < count; i++) {
    const card = page.getByTestId('card');
    await expect(card).toBeVisible();
    const id = (await card.getAttribute('data-category-id')) as CategoryId;
    seen.push(id);
    await page.getByRole('button', { name: BUTTON[choices[id] ?? 'no'], exact: true }).click();
    await expect(page.locator(`[data-testid="card"][data-category-id="${id}"]`)).toHaveCount(0);
  }
  return seen;
}
```

- [ ] **Step 4: `tests/e2e/flows.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { createRoomAs, joinAs, newPlayer, voteCards } from './helpers';

test('three players reach a direct win', async ({ browser }) => {
  const [host, guest1, guest2] = await Promise.all([newPlayer(browser), newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest1, url, 'Beto');
  await joinAs(guest2, url, 'Caro');
  await expect(host.getByText('Participantes (3/15)')).toBeVisible();

  await host.getByRole('button', { name: 'Empezar' }).click();
  await Promise.all([
    voteCards(host, { pizza: 'super' }),
    voteCards(guest1, { pizza: 'super' }),
    voteCards(guest2, { pizza: 'yes', sushi: 'super' }),
  ]);

  for (const page of [host, guest1, guest2]) {
    await expect(page.getByText('¡Se come Pizza!')).toBeVisible();
  }
  await expect(guest1.getByText('Quién votó qué')).toHaveCount(0);
});

test('a tie with overlapping support goes to runoff', async ({ browser }) => {
  const [host, guest1, guest2] = await Promise.all([newPlayer(browser), newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest1, url, 'Beto');
  await joinAs(guest2, url, 'Caro');
  await host.getByRole('button', { name: 'Empezar' }).click();

  // pizza 2, sushi 2; Caro apoya a ambas -> ballotage
  await Promise.all([
    voteCards(host, { pizza: 'yes' }),
    voteCards(guest1, { sushi: 'yes' }),
    voteCards(guest2, { pizza: 'yes', sushi: 'yes' }),
  ]);

  for (const page of [host, guest1, guest2]) {
    await expect(page.getByText('¡Hay empate!')).toBeVisible();
    await page.getByRole('button', { name: 'Pizza' }).click();
  }
  for (const page of [host, guest1, guest2]) {
    await expect(page.getByText('¡Se come Pizza!')).toBeVisible();
  }
});

test('a clean split skips the runoff and spins the roulette', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest, url, 'Beto');
  await host.getByRole('button', { name: 'Empezar' }).click();

  await Promise.all([voteCards(host, { pizza: 'yes' }), voteCards(guest, { sushi: 'yes' })]);

  await expect(host.getByText('¡A la ruleta!')).toBeVisible();
  await expect(host.getByText(/¡Se come (Pizza|Sushi)!/)).toBeVisible({ timeout: 20_000 });
  const hostWinner = await host.getByText(/¡Se come (Pizza|Sushi)!/).textContent();
  await expect(guest.getByText(hostWinner!)).toBeVisible();

  await host.getByRole('button', { name: 'Jugar otra ronda' }).click();
  await expect(guest.getByText(/Participantes/)).toBeVisible();
});

test('reloading mid-round resumes on an unvoted card', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest, url, 'Beto');
  await host.getByRole('button', { name: 'Empezar' }).click();

  const voted = await voteCards(host, {}, 3);
  await host.waitForLoadState('networkidle'); // que terminen de llegar los votos en vuelo
  await host.reload();
  const card = host.getByTestId('card');
  await expect(card).toBeVisible();
  expect(voted).not.toContain(await card.getAttribute('data-category-id'));
  await expect(host.getByText('4 de 14')).toBeVisible();
});
```

- [ ] **Step 5: Correr los e2e**

Con Supabase local corriendo (`npm run db:start`) y `.env.local` completo:
Run: `npm run test:e2e`
Expected: 4 tests PASS. Si falla alguno, mirar el trace con `npx playwright show-trace` sobre el archivo de `test-results/`, corregir la causa en la UI o en el servidor (no en el test) y volver a correr.

- [ ] **Step 6: `docs/metrics.sql`** (spec §11)

```sql
-- Métricas de la POC (correr en el SQL editor de Supabase). Fuente: tabla events.

-- Tasa de finalización: salas que llegaron a resultado / salas creadas
select
  count(distinct room_id) filter (where type = 'round_resolved')::numeric
    / nullif(count(distinct room_id) filter (where type = 'room_created'), 0) as completion_rate
from events;

-- Tiempo medio de decisión (segundos), desde inicio de ronda hasta resultado
select avg((data->>'durationMs')::numeric) / 1000 as avg_decision_seconds
from events
where type = 'round_resolved';

-- Tasa de rebote del link: aperturas sin ingreso
select
  1 - count(*) filter (where type = 'participant_joined')::numeric
      / nullif(count(*) filter (where type = 'link_opened'), 0) as bounce_rate
from events;

-- Tasa de desempate: rondas que fueron a ballotage o ruleta
select
  count(*) filter (where data->>'path' in ('runoff', 'roulette_after_skip', 'roulette_after_runoff'))::numeric
    / nullif(count(*), 0) as tiebreak_rate
from events
where type = 'round_resolved';

-- Repetición: salas que jugaron más de una ronda
select
  count(*) filter (where rounds > 1)::numeric / nullif(count(*), 0) as replay_rate
from (
  select room_id, count(*) as rounds from events where type = 'round_started' group by room_id
) per_room;
```

- [ ] **Step 7: Reescribir `README.md`**

```markdown
# Antojitos

> Menos vueltas, más sabor.

Web app efímera para decidir qué se come en grupo: cada uno swipea categorías en privado y la app
cruza los votos. Producto: [`docs/product-spec.md`](docs/product-spec.md). Diseño técnico:
[`docs/superpowers/specs/2026-10-01-antojitos-poc-design.md`](docs/superpowers/specs/2026-10-01-antojitos-poc-design.md).

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para Supabase local)

## Desarrollo local

    npm install
    npm run db:start          # levanta Supabase local y aplica las migraciones
    npx supabase status       # copiar DB URL, API URL y anon key
    cp .env.example .env.local  # completar con esos valores
    npm run dev               # http://localhost:3000

## Tests

    npm test                  # dominio y cliente (sin base de datos)
    npm run test:server       # comandos del servidor contra Supabase local
    npm run test:e2e          # flujo multiusuario con Playwright (levanta `npm run dev`)

## Deploy (Supabase + Vercel)

1. Crear un proyecto en Supabase y aplicar las migraciones: `npx supabase link --project-ref <ref>`
   y `npx supabase db push`. Verificar en Database → Extensions que `pg_cron` esté activo.
2. Importar el repo en Vercel y configurar las variables de entorno:
   - `DATABASE_URL`: connection string del **pooler en modo transacción** (puerto 6543).
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: de Project Settings → API.
3. Métricas: [`docs/metrics.sql`](docs/metrics.sql).
```

(En el archivo real, los bloques de comandos van con triple backtick `bash`; acá están indentados para no romper el plan.)

- [ ] **Step 8: Verificación final completa**

Run: `npm test && npm run test:server && npm run typecheck && npm run lint && npm run build && npm run test:e2e`
Expected: todo PASS y sin errores.

- [ ] **Step 9: Commit**

```bash
git add playwright.config.ts tests/e2e docs/metrics.sql README.md .gitignore
git commit -m "test(e2e): multiplayer flows; docs: metrics queries and README"
```
