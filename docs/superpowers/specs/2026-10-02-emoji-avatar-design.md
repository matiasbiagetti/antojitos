# Avatar emoji — Diseño técnico

- **Fecha:** 2026-10-02
- **Fuente de verdad de producto:** [`docs/product-spec.md`](../../product-spec.md) (§3, §4, §8 y §9
  actualizados con este cambio). Si algo acá contradice al spec, manda el spec.
- **Convención de nombres:** identificadores en inglés, textos de interfaz en español rioplatense.

---

## 1. Objetivo

Al elegir el apodo (crear sala o unirse por link), cada persona también elige un **avatar emoji**
de una lista propia, como si eligiera una imagen. El avatar acompaña al apodo donde se muestran
participantes. Nunca se usa el teclado de emojis del sistema.

Criterios de éxito:

1. El formulario de apodo muestra un avatar preseleccionado al azar; se puede entrar sin tocarlo.
2. Tocar el avatar abre un selector con pestañas por categoría y todos los emojis disponibles.
3. Los emojis se ven con el arte de Apple (iOS) en cualquier dispositivo.
4. El avatar aparece en la sala de espera y en "Quién votó qué".
5. Abrir la pantalla inicial no descarga el catálogo ni las imágenes del selector.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Origen | Lista propia generada; no se escribe con el teclado. |
| Dibujo | Imagen PNG propia por emoji en `public/avatars/<id>.png`, no emoji nativo. |
| Arte | Apple, desde el paquete `emoji-datasource-apple` (PNG 64 px). |
| Licencia | **Riesgo aceptado por el dueño del producto:** el arte de Apple tiene copyright y no se licencia para terceros. Queda documentado en `docs/avatars.md`. Reemplazable por otro set cambiando el script. |
| Catálogo | Todos los emojis con imagen de Apple, sin variantes de tono de piel ni de género. |
| Default | Uno al azar entre caritas, animales y comida. |
| Unicidad | Se puede repetir; el apodo (único) diferencia. |
| Obligatorio | No hay paso extra: el default ya es válido. |
| Selector | Pestañas por categoría, sin buscador. |

## 3. Catálogo generado

Script `scripts/build-avatars.mjs` (se corre a mano, una vez; su salida se commitea). Usa
`emoji-datasource-apple` como `devDependency`.

Filtro sobre `emoji.json` del paquete:

- `has_img_apple === true`.
- Excluir la categoría `Component` (muestras de tono de piel, partes de pelo).
- Excluir entradas con `obsoleted_by`.
- Excluir variantes de género: secuencias cuyo `unified` contiene `200D-2640` o `200D-2642`.
- Las variantes de tono (`skin_variations`) no se recorren: solo se usa la imagen base.
- Orden: `sort_order` del paquete.

Id del avatar: `unified` en minúsculas, por ejemplo `1f355` (🍕) o `1f468-200d-1f373` (👨‍🍳).

Salidas:

- `public/avatars/<id>.png`: copia de `img/apple/64/<unified en minúsculas>.png`.
- `lib/domain/avatars.json`: `{ "categories": [{ "id": string, "label": string, "icon": string, "avatars": string[] }] }`
  en el orden de categorías del paquete. `id` es el nombre de categoría del paquete en kebab-case
  en inglés (`smileys-emotion`, `people-body`, `animals-nature`, `food-drink`, `travel-places`,
  `activities`, `objects`, `symbols`, `flags`). `label` es el nombre en español para la interfaz
  ("Caritas", "Personas", "Animales", "Comida", "Viajes", "Actividades", "Objetos", "Símbolos",
  "Banderas"). `icon` es el id del avatar que representa la pestaña (el primero de la categoría).

## 4. Dominio

`lib/domain/avatars.ts` (puro, testeado):

- `AVATAR_CATEGORIES`: el contenido de `avatars.json`, tipado.
- `isAvatarId(value: unknown): value is string`: `true` solo para ids del catálogo.
- `DEFAULT_AVATAR_CATEGORIES = ['smileys-emotion', 'animals-nature', 'food-drink']`.
- `randomDefaultAvatar(random: () => number = Math.random): string`: elige uniformemente entre
  los avatares de esas categorías.
- `avatarSrc(id: string): string` → `/avatars/${id}.png`.

## 5. Datos y servidor

- Migración nueva `supabase/migrations/20261002000000_participant_avatar.sql`:
  `alter table participants add column avatar_id text not null default '1f600';` seguido de
  `alter table participants alter column avatar_id drop default;`. El default temporal solo
  rellena a los participantes de salas ya abiertas (😀); los nuevos siempre envían su avatar.
- `room-repository.ts`: `Participant` suma `avatarId`; `insertParticipant` recibe y guarda
  `avatarId`; los `select` lo devuelven.
- `commands/rooms.ts`: crear sala y unirse leen `avatarId` del body. Si `!isAvatarId(avatarId)`
  → `AppError('INVALID_AVATAR')`. La validación ocurre antes de abrir la transacción, junto a la del apodo.
- `errors.ts` y `api-types.ts`: código `INVALID_AVATAR` → 400.
- `lib/client/messages.ts`: `INVALID_AVATAR: 'Ese avatar no está disponible. Elegí otro.'`
- `lib/client/api.ts`: `createRoom(nickname, avatarId)` y `joinRoom(roomId, nickname, avatarId)`.

Lo que ve el cliente:

- `PublicSnapshot.participants`: `{ id, nickname, avatarId }[]`.
- `MeResponse`: suma `avatarId`.
- `IndividualVotes`: suma `avatarId`.
- `toPublicResult(full, visibility, people)` donde `people: Record<string, { nickname: string; avatarId: string }>`
  reemplaza a `nicknames`. El orden sigue siendo alfabético por apodo.

## 6. Interfaz

**`components/Avatar.tsx`**: `<Avatar id size />` dibuja `<img src={avatarSrc(id)} width={size}
height={size} alt="" draggable={false} />` (img plano, sin optimización de Next, como las fotos de
categorías). Circular con fondo `secondary/20`.

**`components/NicknameForm.tsx`**:

- Estado `avatarId` inicializado con `randomDefaultAvatar()` en el cliente (en un efecto o
  inicializador perezoso que no rompa la hidratación: se renderiza un placeholder neutro hasta montar).
- Arriba del campo de apodo: botón con el avatar de 80 px y la leyenda "Cambiar"
  (`aria-label="Elegir avatar"`).
- `onSubmit: (nickname: string, avatarId: string) => Promise<void>`.
- Mientras `busy`, el botón del avatar queda deshabilitado.

**`components/AvatarPicker.tsx`** (cargado con `next/dynamic` / `import()` al abrir):

- Hoja inferior (`role="dialog"`, `aria-modal`, `aria-label="Elegí tu avatar"`) que ocupa ~85% de
  la altura, con ✕ y cierre al tocar el fondo o con Escape.
- Fila de pestañas (`role="tablist"`), una por categoría, con su `icon` como imagen y `label` como
  `aria-label`.
- Grilla de 7 columnas con scroll vertical, solo de la pestaña activa; cada celda es un botón con
  `<img loading="lazy">` de 40 px. La pestaña inicial es la categoría del avatar actual y este
  aparece marcado.
- Tocar un avatar llama `onSelect(id)` y cierra.

**Dónde se muestra:**

- `LobbyScreen`: chip de participante con `<Avatar size={24}>` a la izquierda del apodo.
- `ResultScreen`, "Quién votó qué": `<Avatar size={32}>` junto al nombre.
- `app/page.tsx` y `RoomScreen`: pasan `avatarId` a `createRoom` / `joinRoom`.

Sin cambios en votación, ballotage, ruleta ni en el aviso de "Tomar el control".

## 7. Tests

- `tests/domain/avatars.test.ts`: el catálogo no está vacío y no tiene ids repetidos; no incluye
  `Component` ni variantes de género; `isAvatarId` acepta un id real y rechaza `''`, `'x'`, números
  y `undefined`; `randomDefaultAvatar` con `random` fijo devuelve ids de las categorías por
  defecto (extremos 0 y 0.9999).
- `tests/domain/visibility.test.ts`: `individualVotes` incluye `avatarId`.
- `tests/domain/public-snapshot.test.ts`: participantes con `avatarId`.
- `tests/server/rooms.test.ts`: crear y unirse guardan el avatar; `INVALID_AVATAR` con id
  inexistente o ausente.
- `tests/server/schema.test.ts`: si verifica columnas, sumar `avatar_id`.
- E2E (`tests/e2e`): los helpers siguen funcionando con el avatar por defecto; un flujo nuevo
  abre el selector, cambia de pestaña, elige un avatar y verifica que la imagen
  (`/avatars/<id>.png`) aparece en el lobby del otro participante.
- Un test que verifica que cada id de `avatars.json` tiene su PNG en `public/avatars/`.

## 8. Fuera de alcance

Buscador de emojis, tonos de piel, avatares únicos por sala, cambiar el avatar después de entrar,
subir fotos propias.
