# Antojitos POC — Diseño técnico

- **Fecha:** 2026-10-01
- **Fuente de verdad de producto:** [`docs/product-spec.md`](../../product-spec.md). Este documento
  describe *cómo* se construye la POC; el *qué* está en el spec. Si algo acá contradice al spec,
  manda el spec y este documento se corrige.
- **Convención de nombres:** todo identificador de código (tablas, columnas, archivos, funciones,
  tipos, fases, ids) va en inglés. Los textos de interfaz van en español rioplatense (§9 del spec).

---

## 1. Objetivo y criterios de éxito

Construir la POC descrita en §3 "Incluido" del spec: crear sala, unirse por link con apodo,
swipe privado de 14 categorías, cierre por timer o por todos terminados, resultado con victoria
directa / ballotage / ruleta, visibilidad configurable y "Jugar otra ronda".

La POC está lista cuando:

1. Un grupo de 2 a 15 personas, cada una desde su celular, llega a un resultado en ~1 minuto.
2. Los votos individuales nunca llegan a otro cliente si "quién votó qué" está desactivado
   (verificable inspeccionando el tráfico de red).
3. Todos ven el mismo resultado, incluida la ruleta.
4. Recargar la página no pierde identidad ni votos.
5. La lógica de §6 tiene cobertura completa de tests y el flujo multiusuario pasa en Playwright.

**Fuera de alcance** (§3 del spec, no se implementa): filtros dietéticos, modalidades, platos o
restaurantes, votación de postre, cuentas, historial, monetización.

---

## 2. Stack

Next.js (App Router) + TypeScript + React · Tailwind CSS · Framer Motion · Supabase (Postgres +
Realtime + `pg_cron`) · Vercel · Vitest + Playwright. Detalle y motivos en §10 del spec.

---

## 3. Arquitectura

Arquitectura de la POC (registrada en §10 del spec como candidata a revisar para la versión
completa):

- **Functional core, imperative shell.** `lib/domain/` son funciones puras (sin React, Supabase,
  red ni reloj: la hora y el azar se reciben como parámetros). Route Handlers y componentes React
  hacen la I/O.
- **Server-authoritative.** El cliente solo envía intenciones; el servidor valida token, rol,
  fase, deadline y vencimiento de sala, y decide.
- **CQRS liviano.** Escrituras por Route Handlers. Lecturas desde `room_public`, una foto
  sanitizada de la sala que el servidor reescribe tras cada cambio. Es la única tabla visible para
  los clientes y la única publicada por Realtime.
- **Máquina de estados** para las fases de la sala.

### 3.1 Estructura de carpetas

```
app/
  page.tsx                      # Inicio: crear sala
  j/[roomId]/page.tsx           # Sala: renderiza la pantalla según la fase
  api/rooms/route.ts            # POST crear sala
  api/rooms/[roomId]/
    join/route.ts
    config/route.ts
    start/route.ts
    vote/route.ts
    close/route.ts
    runoff-vote/route.ts
    heartbeat/route.ts
    replay/route.ts
    me/route.ts                 # GET
    opened/route.ts             # evento link_opened
components/                     # UI (SwipeDeck, VoteButtons, Countdown, Roulette, ...)
lib/
  domain/                       # Núcleo puro, 100% testeado
    categories.ts
    scoring.ts
    runoff.ts
    random.ts
    card-order.ts
    visibility.ts
    room-machine.ts
    types.ts
  server/                       # Cáscara de servidor
    supabase-admin.ts           # Cliente con service role (solo servidor)
    auth.ts                     # Token → participante
    room-repository.ts          # Lectura/escritura de tablas
    public-snapshot.ts          # Construye y escribe room_public
    errors.ts                   # Códigos de error tipados
  shared/
    api-types.ts                # Tipos compartidos cliente/servidor (PublicSnapshot, ErrorCode...)
  client/
    supabase-browser.ts         # Cliente anon (solo lee room_public)
    use-room.ts                 # Suscripción a la foto pública
    session-token.ts            # Token en localStorage
    api.ts                      # Llamadas a los Route Handlers
supabase/migrations/            # Esquema, RLS, índices, pg_cron
public/categories/              # Fotos WebP
tests/
  domain/                       # Vitest puro
  server/                       # Vitest contra Supabase local
  e2e/                          # Playwright
```

---

## 4. Dominio (`lib/domain/`)

### 4.1 Tipos principales

```ts
type CategoryId =
  | 'pizza' | 'burgers' | 'sushi' | 'pasta' | 'empanadas' | 'grill' | 'milanesa'
  | 'middle_eastern' | 'mexican' | 'chinese' | 'peruvian' | 'chicken' | 'sandwiches' | 'veggie';

type VoteValue = 'super' | 'yes' | 'no';           // pesos 2 / 1 / 0 (spec §5.1)

type RoomPhase = 'lobby' | 'voting' | 'runoff' | 'roulette' | 'result';

type VisibilityConfig = {
  showRanking: boolean;          // default true
  showScores: boolean;           // default true
  showSuperCounts: boolean;      // default true
  showTiebreakPath: boolean;     // default true
  showWhoVotedWhat: boolean;     // default false
};                               // la ganadora es siempre visible: no tiene flag

type RoomConfig = { visibility: VisibilityConfig; roundSeconds: 45 | 60 | 90 };  // default 60
```

`categories.ts` exporta la lista fija con `id`, nombre visible en español y ruta de la foto:

| UI | id |
|---|---|
| Pizza | `pizza` |
| Hamburguesas | `burgers` |
| Sushi | `sushi` |
| Pastas | `pasta` |
| Empanadas | `empanadas` |
| Parrilla | `grill` |
| Milanesas | `milanesa` |
| Comida árabe | `middle_eastern` |
| Mexicana | `mexican` |
| China | `chinese` |
| Peruana | `peruvian` |
| Pollo | `chicken` |
| Sándwiches | `sandwiches` |
| Veggie / Saludable | `veggie` |

### 4.2 `scoring.ts` — primera vuelta (spec §6.1–6.3)

`scoreRound({ votes, eligibleRunoffVoterIds, rng }) → RoundOutcome`

- Suma pesos por categoría. Lo no votado vale 0.
- Si todas las categorías suman 0 → `{ kind: 'no_cravings' }`.
- `margin = max(1, 0.2 × topScore)`. Candidatas = categorías con puntaje > 0 y
  `topScore − score ≤ margin`.
- Una sola candidata → `{ kind: 'winner', categoryId }`.
- Más de 3 candidatas → se toman por mayor puntaje; si hay empate en el puntaje que define el
  último lugar, se sortea con `rng`.
- Con 2 o 3 finalistas, regla de salto (§6.3): si **cada** id de `eligibleRunoffVoterIds`
  (participantes de la ronda + espectadores presentes al cierre) apoyó (`yes` o `super`) a
  exactamente una finalista → `{ kind: 'roulette', finalists, winner }` con ganadora sorteada con
  `rng`. Si no → `{ kind: 'runoff', finalists }`.
- Devuelve también los datos de detalle (ranking, puntajes, súper antojos por categoría, camino
  de desempate) que luego filtra `visibility.ts`.

### 4.3 `runoff.ts` — ballotage (spec §6.2, §6.4)

`scoreRunoff({ finalists, runoffVotes, rng }) → { kind: 'winner' } | { kind: 'roulette', finalists, winner }`

- Gana la finalista con más votos. Si hay empate en el primer puesto, ruleta entre las empatadas,
  con ganadora sorteada con `rng`.
- Si nadie votó en el ballotage, todas las finalistas empatan en 0 → ruleta entre todas.

### 4.4 `random.ts` y `card-order.ts`

- `random.ts`: interfaz `Rng` (`next(): number` en [0, 1)), implementación con semilla
  (determinística, para tests y orden de tarjetas) y una basada en `crypto` (para sorteos reales).
- `card-order.ts`: `cardOrder(participantId, roundNumber)` mezcla las 14 categorías (Fisher-Yates)
  con una semilla derivada de ambos valores. Mismo participante y ronda → mismo orden, así se
  retoma después de recargar sin guardar nada.

### 4.5 `visibility.ts`

`toPublicResult(fullResult, config) → PublicResult`. Quita todo campo no habilitado. Con
`showWhoVotedWhat = false` el objeto devuelto no contiene ningún voto individual (ni de primera
vuelta ni de ballotage). Es el único camino por el que un resultado llega a `room_public`.

### 4.6 `room-machine.ts`

Fases y transiciones válidas:

```
lobby ──start──▶ voting ──close──▶ result            (winner / no_cravings)
                    │      └─────▶ runoff ──close──▶ result | roulette
                    └────────────▶ roulette ──close──▶ result
result ──replay──▶ lobby
```

Expone `canTransition(from, action)` y qué acciones están permitidas en cada fase y para qué rol.

---

## 5. Modelo de datos (Supabase)

Todas las tablas referencian `rooms` con `on delete cascade`.

| Tabla | Columnas principales |
|---|---|
| `rooms` | `id` (texto de 8 caracteres, alfabeto sin caracteres ambiguos), `created_at`, `expires_at` (= `created_at + 1 h`), `phase`, `config` (jsonb), `host_participant_id`, `current_round` |
| `participants` | `id` (uuid), `room_id`, `nickname`, `nickname_key` (minúsculas, para unicidad), `token_hash`, `joined_at`, `last_seen_at` |
| `rounds` | `room_id`, `number`, `started_at`, `deadline`, `outcome` (jsonb: desenlace de la primera vuelta, incluye finalistas), `runoff_deadline`, `roulette` (jsonb: segmentos y ganadora), `roulette_ends_at`, `full_result` (jsonb, privado, incluye la ganadora) |
| `votes` | `room_id`, `round_number`, `participant_id`, `category_id`, `value` |
| `runoff_votes` | `room_id`, `round_number`, `participant_id`, `category_id` |
| `room_public` | `room_id` (pk), `snapshot` (jsonb), `version` |

**Restricciones en la base:**

- `participants`: `unique (room_id, nickname_key)`.
- `votes`: `unique (room_id, round_number, participant_id, category_id)` e índice único parcial
  `(room_id, round_number, participant_id) where value = 'super'`, para que haya un solo Súper
  antojo por participante y ronda.
- `runoff_votes`: `unique (room_id, round_number, participant_id)`.
- El máximo de 15 participantes se valida en el Route Handler dentro de una transacción con
  bloqueo de la fila de `rooms`.

**Seguridad (RLS):**

- RLS activado en todas las tablas.
- Rol `anon`: solo `select` sobre `room_public`. Ningún acceso a las demás.
- Realtime publicado solo para `room_public`.
- Los Route Handlers se conectan directo a Postgres (`DATABASE_URL`, con el pooler de Supabase
  en modo transacción en producción). Esa conexión ignora RLS y permite transacciones con
  bloqueo de fila (`select ... for update` sobre `rooms`), que serializan todos los comandos de
  una sala. La credencial nunca llega al cliente. El cliente usa solo la anon key.

**Espectadores:** no se guardan como rol. Un participante es espectador de la ronda `n` si
`joined_at > rounds[n].started_at`.

**Purga:** `pg_cron` cada 5 minutos ejecuta `delete from rooms where expires_at < now()`, y la
cascada borra el resto.

### 5.1 Foto pública (`room_public.snapshot`)

```ts
type PublicSnapshot = {
  roomId: string;
  phase: RoomPhase;
  expiresAt: string;
  hostParticipantId: string;
  config: RoomConfig;                       // visible para todos desde el lobby (§7)
  participants: { id: string; nickname: string }[];
  round?: {
    number: number;
    deadline: string;
    finishedCount: number;                  // "4 de 6 terminaron"
    voterCount: number;
    finalists?: CategoryId[];               // en runoff y roulette
    runoffDeadline?: string;
    runoffVotedCount?: number;
    roulette?: { segments: CategoryId[]; winner: CategoryId; endsAt: string };
    result?: PublicResult;                  // ya filtrado por visibility.ts
  };
};
```

Nunca contiene tokens, votos individuales (salvo que `showWhoVotedWhat` esté activo y la fase sea
`result`) ni el `full_result`.

---

## 6. Identidad y sesión

- Al crear la sala o unirse, el servidor genera un token aleatorio de 32 bytes, devuelve el token
  en claro una sola vez y guarda `sha256(token)`.
- El cliente guarda `{ roomId → { participantId, token } }` en `localStorage` y lo envía en el
  header `X-Participant-Token` en cada pedido.
- Al abrir `/j/[roomId]`, si hay token, `GET /me` devuelve identidad, orden de tarjetas y votos
  propios, y el cliente retoma desde la primera tarjeta sin votar.
- Apodo: 1 a 20 caracteres tras recortar espacios, único por sala sin distinguir mayúsculas.

---

## 7. Endpoints

Todos validan, en este orden: sala existe → sala no vencida (`ROOM_EXPIRED`) → token válido si
hace falta (`INVALID_TOKEN`) → rol (`NOT_HOST`) → fase (`WRONG_PHASE`). Los que cambian estado
corren en una transacción que bloquea la fila de `rooms` y, al final, reescriben `room_public`.

| Endpoint | Quién / cuándo | Efecto |
|---|---|---|
| `POST /api/rooms` | cualquiera | Crea sala (`lobby`, config default) y anfitrión. Devuelve `roomId`, `participantId`, token. |
| `POST /api/rooms/[id]/join` | cualquiera | Valida cupo (`ROOM_FULL`) y apodo (`NICKNAME_TAKEN`, `INVALID_NICKNAME`). Se puede unir en cualquier fase; si hay ronda en curso, queda como espectador. |
| `POST /api/rooms/[id]/config` | anfitrión, `lobby` | Actualiza visibilidad y/o `roundSeconds`. |
| `POST /api/rooms/[id]/start` | anfitrión, `lobby`, ≥ 2 participantes (`NOT_ENOUGH_PLAYERS`) | Crea la ronda, `deadline = now + roundSeconds`, fase `voting`. |
| `POST /api/rooms/[id]/vote` | participante no espectador, `voting`, antes del deadline | Inserta el voto (`SUPER_ALREADY_USED`, `ALREADY_VOTED`). Si todos los votantes completaron las 14 tarjetas, cierra la ronda en el mismo pedido. |
| `POST /api/rooms/[id]/close` | cualquiera | Idempotente. `voting` y `now ≥ deadline` → cierra la primera vuelta. `runoff` y `now ≥ runoff_deadline` → cierra el ballotage. `roulette` y `now ≥ roulette_ends_at` → `result`. En cualquier otro caso no hace nada y devuelve OK. |
| `POST /api/rooms/[id]/runoff-vote` | cualquier participante presente en la sala (incluye espectadores), `runoff` | Inserta el voto. Si votaron todos, cierra el ballotage en el mismo pedido. |
| `POST /api/rooms/[id]/heartbeat` | cualquier participante, cada ~10 s | Actualiza `last_seen_at`. En `lobby` o `result`, si el anfitrión lleva más de 30 s sin señal, pasa el rol al participante con señal en los últimos 30 s que tenga el `joined_at` más antiguo. |
| `POST /api/rooms/[id]/replay` | anfitrión, `result` | Fase `lobby`, misma config. |
| `GET /api/rooms/[id]/me` | participante | Identidad, rol, orden de tarjetas de la ronda actual, votos propios. |
| `POST /api/rooms/[id]/opened` | cualquiera sin token | Registra el evento `link_opened` (§12). No cambia la sala. |

**Cierre de la primera vuelta:** carga votos y participantes, llama a `scoreRound` con
`eligibleRunoffVoterIds` = votantes de la ronda + espectadores presentes, guarda `full_result` y
pasa a:
- `result`, si hay ganadora o no hubo antojos;
- `runoff`, con `runoff_deadline = now + 20 s`;
- `roulette`, con ganadora sorteada y `roulette_ends_at = now + duración de la animación` (~6 s).

**Ruleta:** el servidor sortea antes de animar. Los clientes animan hacia `roulette.winner` y, al
llegar a `endsAt`, muestran el resultado localmente y llaman a `close` para consolidar la fase
`result`.

**Ronda sin antojos:** fase `result` con `no_cravings`. Se muestra "No hubo antojos" y el
anfitrión puede "Jugar otra ronda".

---

## 8. Cliente

- `use-room(roomId)`: carga `room_public` y se suscribe a sus cambios por Realtime. Cada evento
  trae la foto completa; si llega un `version` menor al actual, se descarta. Al reconectar, vuelve
  a pedir la foto.
- Cada cliente programa un `close` cuando su reloj llega a `deadline`, `runoff_deadline` o
  `roulette_ends_at`, y lo reintenta una vez a los 2 s si la fase no cambió. El servidor decide
  con su propia hora, y la cuenta regresiva visible se corrige con el desfase entre la hora del
  servidor (que viaja en cada respuesta) y la del cliente.
- Heartbeat cada 10 s mientras la pestaña esté abierta.

### 8.1 Pantallas (`/j/[roomId]` según la fase)

1. **Inicio (`/`):** logo, lema "Menos vueltas, más sabor", apodo y botón "Crear sala".
2. **Unirse:** apodo y botón "Entrar". Si hay token guardado para la sala, entra directo.
3. **Sala de espera (`lobby`):**
   - Participantes (n/15), "Compartir" (Web Share API, o copiar link si no está disponible) y un
     resumen de "Qué se va a mostrar al final".
   - Si `showWhoVotedWhat` está activo, un aviso destacado en Frambuesa (`#E91E63`).
   - El anfitrión ve los checkboxes, el selector 45 / 60 / 90 s y "Empezar" (deshabilitado con
     menos de 2 personas, con el texto "Esperando que se sume alguien más…").
   - Aviso cuando cambia el anfitrión.
4. **Votación (`voting`):**
   - Pila de tarjetas con foto y nombre, y botones ✗ / ⭐ / ✓. Mientras se arrastra aparece la
     etiqueta "PASO" / "¡SÚPER ANTOJO!" / "ME VA".
   - Con el ⭐ ya usado, el botón queda deshabilitado y el swipe hacia arriba devuelve la tarjeta
     con el aviso "Ya usaste tu súper antojo".
   - Cuenta regresiva y "x de y terminaron". Al terminar: "¡Listo! Esperando al resto…".
   - Los espectadores ven "La ronda ya arrancó. Vas a ver el resultado y podés jugar la próxima"
     y el progreso.
5. **Ballotage (`runoff`):** "¡Hay empate!", 2 o 3 tarjetas para elegir una con un toque, y cuenta
   de 20 s. Pueden votar participantes y espectadores.
6. **Ruleta (`roulette`):** animación con Framer Motion que cae en la ganadora del servidor. Tono
   festivo, no de castigo.
7. **Resultado (`result`):** ganadora con celebración y "¡Se come X!". Debajo, solo lo que habilitó
   la configuración. El anfitrión ve "Jugar otra ronda".
8. **Sala vencida, inexistente o llena:** mensaje claro y botón "Crear una sala nueva".

**Identidad visual:** paleta de §9 del spec como tokens de Tailwind (`primary #FF5722`,
`secondary #FFB300`, `accent #E91E63`, `background #FFFDF9`, `ink #1E1B18`). Mobile first,
pensado para usar con una mano.

**Isotipo:** para la POC se usa un logotipo tipográfico "Antojitos". La mascota descrita en §9
queda para cuando exista el arte.

---

## 9. Manejo de errores

- Respuestas de error con forma `{ error: { code, message } }`. Códigos: `ROOM_NOT_FOUND`,
  `ROOM_EXPIRED`, `ROOM_FULL`, `NICKNAME_TAKEN`, `INVALID_NICKNAME`, `INVALID_TOKEN`, `NOT_HOST`,
  `WRONG_PHASE`, `NOT_ENOUGH_PLAYERS`, `SUPER_ALREADY_USED`, `ALREADY_VOTED`, `SPECTATOR`,
  `INVALID_INPUT`, `INTERNAL`.
- El cliente traduce cada código a un texto en español con el tono del producto.
- `WRONG_PHASE` al votar no se muestra como error: el cliente pasa a la pantalla de la fase actual.
- Si se corta la conexión de tiempo real: aviso "Reconectando…" y, al volver, se vuelve a pedir la
  foto completa.
- Las fallas de red en `vote` se reintentan. Las restricciones `unique` hacen que un reintento no
  duplique votos (`ALREADY_VOTED` se trata como éxito).

---

## 10. Testing

**Vitest — dominio (cobertura completa de `lib/domain/`):**
- Pesos 2 / 1 / 0, votos parciales, ronda sin antojos.
- Victoria directa, incluido el piso del margen (2 personas: 3 / 2 → ballotage; 4 / 2 → ganadora).
- Ballotage de 2 y de 3, corte a 3 con sorteo por empate en el último lugar.
- Salto a ruleta: caso 3 a 3 del spec; no se salta si alguien apoyó a dos finalistas, a ninguna,
  no llegó a votarlas o si hay un espectador presente.
- Ballotage: ganadora, empate que va a ruleta, nadie votó.
- `visibility.ts`: con cada flag apagado el campo no aparece. Con `showWhoVotedWhat = false`,
  ningún id de participante asociado a un voto aparece en la salida.
- `room-machine.ts`: transiciones válidas e inválidas.
- `card-order.ts`: determinístico y es una permutación de las 14 categorías.

**Vitest — servidor, contra Supabase local (`supabase start`):**
- Un segundo Súper antojo es rechazado, también con dos pedidos simultáneos.
- `close` repetido o concurrente produce un único resultado.
- Sala vencida rechaza acciones. Sala llena rechaza el ingreso 16.
- Traspaso de anfitrión a los 30 s y no vuelve al original.
- El rol `anon` no puede leer `votes`, `runoff_votes`, `rounds` ni `participants` (RLS).

**Playwright — multiusuario (3 contextos de navegador):**
- Camino feliz: crear sala, unirse 2, votar, victoria directa, resultado.
- Votos armados para forzar ballotage, y votos armados para forzar salto a ruleta.
- Recargar a mitad de la votación retoma en la misma tarjeta.

---

## 11. Assets

Primera tarea del plan: proponer una foto con licencia libre (Unsplash / Pexels) por categoría,
con link y vista previa, para que el usuario apruebe. Recién después se descargan, se convierten
a WebP (~50 KB, formato vertical para la tarjeta) y se guardan en `public/categories/<id>.webp`.

---

## 12. Métricas (§11 del spec)

Las salas y sus datos se borran a la hora, así que las métricas no salen de esas tablas. Se usa
una tabla `events` anónima, sin clave foránea a `rooms` y que no se purga:

| Columna | Contenido |
|---|---|
| `id` | uuid |
| `type` | `room_created`, `link_opened`, `participant_joined`, `round_started`, `round_resolved`, `replay` |
| `room_id` | texto, sin FK (permite agrupar por sala después de la purga) |
| `data` | jsonb: en `round_resolved`, tipo de desenlace (`winner` / `runoff` / `roulette` / `no_cravings`) y duración en ms |
| `created_at` | timestamp |

- Sin apodos, tokens ni votos. RLS: el rol `anon` no tiene acceso; la escriben los Route
  Handlers.
- `link_opened` se registra al abrir `/j/[roomId]` sin token guardado (para la tasa de rebote).
- Las métricas se calculan con consultas SQL documentadas, sin dashboard en la POC.
