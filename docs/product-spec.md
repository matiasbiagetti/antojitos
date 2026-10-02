# ANTOJITOS — Product Spec (POC)

> **Para el agente:** este documento es la fuente de verdad del producto. Toda spec, diseño o plan
> que generes debe ser consistente con él. Si algo no está cubierto o parece contradictorio,
> preguntá antes de asumir. Las secciones marcadas como **[A CONFIRMAR]** son propuestas que
> deben validarse en el brainstorm antes de implementarse. Si una decisión cambia algo de fondo,
> proponé también la actualización de este documento.

---

## 1. El problema

Cuando un grupo de amigos se junta, nadie sabe qué comer. Todos dicen "me da lo mismo" o no
dicen lo que realmente quieren para no comprometer a los demás. La decisión se estira, gana el
que más insiste o se termina pidiendo algo que a nadie le entusiasma.

## 2. La solución

Una web app efímera donde cada persona, desde su propio celular y **en privado**, swipea
categorías de comida al estilo Tinder. Al terminar, la app cruza los votos y muestra qué se come.
Nadie tiene que exponer su opinión frente al grupo.

- **Nombre:** Antojitos
- **Lema:** "Menos vueltas, más sabor"
- **Objetivo de experiencia:** llegar a una decisión en el menor tiempo posible, idealmente en
  alrededor de un minuto de swipe.

## 3. Alcance de la POC

### Incluido
- Crear una sala y compartirla por link.
- Unirse sin cuenta ni descarga, solo con un apodo y un avatar emoji.
- Swipe de **categorías de comida** (estilo Rappi / PedidosYa).
- Votación con tres opciones: **Súper antojo / Sí / No**.
- Cierre de ronda por timer o cuando todos terminan.
- Cálculo de resultado con victoria directa, ballotage y ruleta.
- Configuración de visibilidad de resultados por parte del anfitrión.

### Fuera de la POC (visión futura, no implementar)
- Filtros dietéticos / líneas rojas (vegetariano, celiaquía, alergias).
- Modalidades: Comida casera, Pedir delivery, Salir a comer.
- Platos específicos, restaurantes, locales, integración con apps de delivery o mapas.
- Votación de postre: ronda separada y opcional, después de decidir la comida principal, para
  elegir qué postre o helado se quiere (si el grupo quiere postre).
- Cuentas de usuario, historial, monetización.

---

## 4. Flujo principal

1. **Anfitrión crea la sala.** Elige su apodo y su avatar (ver §8) y configura la visibilidad de resultados (ver §7).
2. **Comparte el link** `antojitos.app/j/[session_id]` (pensado para WhatsApp/Telegram).
3. **Invitados se unen** ingresando solo un apodo y un avatar. Todos ven una sala de espera con la lista de
   participantes conectados. Antes de empezar, cada participante ve qué se va a mostrar al final
   (especialmente si estará visible quién votó qué).
4. **El anfitrión inicia la ronda.** El anfitrión también vota.
5. **Cada persona swipea** las categorías en su celular, en privado.
6. **La ronda termina** cuando todos terminaron o se agota el timer, lo que ocurra primero.
7. **Se calcula el resultado** (§6). Si hace falta ballotage, se hace una segunda vuelta. Si hace
   falta ruleta, se muestra la animación.
8. **Pantalla de resultado** para todos, con lo que el anfitrión haya habilitado.

---

## 5. Mecánica de votación

### 5.1 Opciones por categoría

| Acción | Significado | Gesto | Peso |
|---|---|---|---|
| Súper antojo | "Esto es lo que más quiero" | Swipe hacia arriba / botón | 2 puntos |
| Sí | "Me va" | Swipe a la derecha | 1 punto |
| No | "Paso" | Swipe a la izquierda | 0 puntos |

- Cada participante tiene **un solo Súper antojo** por ronda. Una vez usado, la opción se
  deshabilita visualmente y **no se puede reasignar** a otra categoría. Tampoco se puede volver
  atrás: si el participante llega al final sin usarlo, no puede aplicarlo a una tarjeta ya votada.
- Además del gesto, debe haber botones visibles para cada acción (accesibilidad y usuarios que no
  saben que se puede swipear).
- Mientras se arrastra la tarjeta aparece una etiqueta con la acción ("ME VA" / "PASO" /
  "¡SÚPER ANTOJO!"). Con el Súper antojo ya usado, el botón queda deshabilitado y el swipe hacia
  arriba devuelve la tarjeta a su lugar con un aviso breve. No hay swipe hacia abajo ni "deshacer".
- "No" no es un veto: solo no suma puntos.

### 5.2 Categorías

- Lista fija de **14 categorías** para la POC, inspirada en Rappi / PedidosYa:
  Pizza, Hamburguesas, Sushi, Pastas, Empanadas, Parrilla, Milanesas, Comida árabe, Mexicana,
  China, Peruana, Pollo, Sándwiches, Veggie / Saludable.
  ("Ensaladas / Saludable" y "Vegetariana" se fusionaron para no dividir votos entre categorías
  parecidas.) La lista puede revisarse después de la POC.
- Todas las categorías de una ronda deben ser **comidas principales comparables entre sí**.
  Postres y helados no compiten contra pizza o pastas: serán una votación aparte (ver §3).
- **El orden se aleatoriza por participante** para evitar sesgo de posición.
- Cada tarjeta muestra imagen y nombre. Para la POC se usan **fotos con licencia libre**
  (Unsplash / Pexels), guardadas en el proyecto y optimizadas para mobile. Las fotos se proponen
  una por categoría y se aprueban antes de incorporarlas. Cada categoría tiene una única imagen
  asociada, para poder reemplazarlas luego (por ejemplo, por ilustraciones propias).

### 5.3 Fin de la ronda

- Termina con lo que ocurra primero: **todos terminaron de swipear** o **se agotó el timer**.
- Duración del timer: **60 segundos por defecto**; el anfitrión puede elegir entre 45 / 60 / 90 s.
  El timer lo controla el servidor y arranca cuando el anfitrión inicia la ronda (todos ven la
  misma cuenta regresiva). A revisar si la lista final de categorías cambia mucho de tamaño.
- Las categorías que un participante no llegó a votar cuentan como **sin voto** (0 puntos, sin
  penalizar). Los votos parciales valen. Para la regla de §6.3, una finalista sin votar cuenta
  como "no apoyada".
- Durante la ronda se puede mostrar progreso general ("4 de 6 terminaron") sin revelar votos.

---

## 6. Cálculo del resultado

Se calcula el puntaje total de cada categoría sumando los pesos de §5.1.

### 6.1 Victoria directa
Si la categoría con más puntos supera claramente a la segunda, gana directamente.
- **Margen de empate:** `margen = max(1, 20% del puntaje de la primera)`. Una categoría está
  "dentro del margen" si `puntaje_primera − puntaje_categoría ≤ margen`.
- "Claramente" significa que ninguna otra categoría está dentro del margen: en ese caso la
  primera gana directo. Si hay al menos una, se va a ballotage (§6.2).
- Una categoría con 0 puntos nunca es finalista (aunque quede dentro del margen).
- Ejemplos: 2 personas, 3 / 2 → ballotage; 4 / 2 → victoria directa. 6 personas, 10 / 7 →
  victoria directa; 10 / 8 / 8 → ballotage a tres.
- Si ninguna categoría recibió puntos, se informa que no hubo antojos y se ofrece repetir la ronda.

### 6.2 Ballotage
Si el resultado está parejo, se pasa a una segunda vuelta solo entre las categorías finalistas.
- Finalistas: las que están dentro del margen de empate respecto a la primera. **Máximo 3
  finalistas.** Si hay más de 3 dentro del margen, se eligen por mayor puntaje; si hay empate
  en el puntaje que define el último lugar, se sortea en el servidor.
- En el ballotage, cada participante elige **una sola** finalista. Gana la más votada.
- Timer propio del ballotage: **20 segundos fijos** (no configurable).

### 6.3 Regla de salto directo a ruleta (importante)
**El ballotage solo se hace si puede cambiar el resultado.** Si los votos del ballotage ya se
pueden deducir de la primera vuelta, se salta directo a la ruleta.

- Caso típico: 6 personas, empate 3 a 3, y cada persona votó positivamente a una sola de las dos
  finalistas. Un ballotage repetiría exactamente el mismo 3 a 3, así que se va directo a ruleta.
- Regla general: si **cada participante apoyó (Sí o Súper antojo) a exactamente una de las
  finalistas** en la primera vuelta, el ballotage no aporta información y se omite.
- Si al menos un participante apoyó a más de una finalista o a ninguna, el ballotage sí se hace.
- "Participante" incluye a los espectadores presentes al cerrar la primera vuelta (ver §8): como
  no votaron, cuentan como que no apoyaron a ninguna finalista, así que el ballotage se hace.

### 6.4 Ruleta
Si el ballotage vuelve a empatar, o si se saltó por la regla 6.3, se elige al azar entre las
finalistas empatadas con una animación de ruleta.
- El sorteo se resuelve **en el servidor** y todos ven el mismo resultado.
- La animación debe sentirse divertida, no como un castigo.

---

## 7. Visibilidad de resultados (configurable)

Antes de iniciar la ronda, el anfitrión tilda o destilda qué se mostrará al final:

| Opción | Default |
|---|---|
| Categoría ganadora | Siempre visible (no se puede destildar) |
| Ranking completo de categorías | Activado |
| Puntaje / cantidad de votos por categoría | Activado |
| Cantidad de súper antojos por categoría | Activado |
| Si hubo ballotage o ruleta, y cómo se llegó | Activado |
| Quién votó qué | **Desactivado** |

- La privacidad es el corazón del producto: por defecto **nadie ve votos individuales**.
- Si el anfitrión activa "quién votó qué", **todos los participantes deben verlo claramente antes
  de votar**, nunca enterarse después.
- La configuración no se puede cambiar una vez iniciada la ronda.
- Con "quién votó qué" activado se muestran también los votos del ballotage.
- **Riesgo conocido:** en grupos muy chicos (sobre todo de 2), los datos agregados (puntajes,
  súper antojos) permiten deducir votos individuales. Se acepta como inherente a mostrar
  estadísticas; no se agrega lógica especial. El anfitrión puede desactivar esas opciones.

---

## 8. Reglas de sesión

- Sin login ni descarga. Cada participante se identifica con un apodo, un avatar emoji y un token
  anónimo de sesión en su navegador.
- **Avatar:** se elige tocando un emoji de una lista propia (pestañas por categoría, sin
  teclado del sistema). Viene uno preseleccionado al azar (caritas, animales o comida), se
  puede cambiar y puede repetirse entre participantes. Se muestra junto al apodo en la sala de
  espera y en "quién votó qué". Se dibuja con el arte de emojis de Apple (iOS) guardado en el
  proyecto, igual en todos los dispositivos. **Riesgo aceptado:** ese arte tiene copyright de
  Apple y no tiene licencia libre; está aislado para poder reemplazarlo por otro set.
- Si un participante recarga la página, debe poder volver a la sala con su identidad y sus votos.
- Las salas duran **como máximo 1 hora** desde su creación. Al vencer, la sala se cierra (el link
  muestra que expiró) y sus datos se eliminan.
- Tamaño de grupo: **mínimo 2, máximo 15** participantes, anfitrión incluido. La ronda no puede
  iniciarse con menos de 2; si la sala está llena, quien intenta unirse ve que no hay lugar.
- Si alguien entra cuando la ronda ya empezó: entra como **espectador**. No vota en la primera
  vuelta, pero **sí vota en el ballotage** si lo hay (incluso si entra con el ballotage en curso,
  con el tiempo que quede). Ve el resultado con la misma visibilidad que el resto y participa
  normalmente en "Jugar otra ronda". Ocupa lugar dentro del máximo del grupo.
- Si el anfitrión se desconecta:
  - **La ronda nunca se corta.** Timer, cierre, cálculo, ballotage y ruleta los maneja el
    servidor, independientemente del anfitrión. Si vuelve, recupera su identidad y sus votos.
  - El rol de anfitrión solo se necesita en la sala de espera (configurar / iniciar) y en la
    pantalla de resultado ("Jugar otra ronda").
  - **No hay traspaso automático.** Si en esos momentos el anfitrión lleva **más de 30 s sin
    señal** (por ejemplo, porque está en WhatsApp compartiendo el link), los demás participantes
    ven un botón **"Tomar el control"**. El primero que lo toca pasa a ser anfitrión y todos ven
    un aviso. Si nadie lo toca, el anfitrión original sigue siéndolo al volver.
  - Una vez tomado el control, el rol no vuelve automáticamente al anfitrión original.
  - El nuevo anfitrión hereda la configuración de visibilidad y puede ajustarla mientras siga en
    la sala de espera (todos la ven antes de votar, §7).
- Al terminar, opción de **"Jugar otra ronda"** con el mismo grupo.

---

## 9. Experiencia e identidad visual

- **Mobile first.** Se usa casi siempre desde el celular, en una juntada, con una mano.
- **Tono:** amigo facilitador, ágil, espontáneo, sin burocracia. Español rioplatense
  ("Me va", "Paso", "¿Qué se come?").
- **Paleta:**

| Rol | Nombre | Color |
|---|---|---|
| Primario | Naranja Antojo | `#FF5722` |
| Secundario / Match | Mostaza Cálido | `#FFB300` |
| Acento | Frambuesa Jugosa | `#E91E63` |
| Fondo | Crema Neutro | `#FFFDF9` |
| Texto | Carbón Profundo | `#1E1B18` |

- **Isotipo / mascota:** silueta estilizada de un torso redondeado con remera naranja levantada
  mostrando el ombligo, una mano sosteniendo la panza en señal de satisfacción, cuello cortado
  limpiamente sin cabeza, sin humo ni vapor.
- Animaciones de swipe fluidas y feedback claro al votar. Momento de "match" celebratorio en la
  pantalla de resultado.

---

## 10. Stack técnico

| Capa | Propuesta | Motivo |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript (React) | Web app mobile, rutas por sala, lógica de servidor (Route Handlers) en el mismo proyecto |
| Estilos | Tailwind CSS | Rápido para aplicar la paleta y mobile first |
| Swipe / animaciones | Framer Motion | Gestos de swipe y ruleta |
| Base de datos + tiempo real | Supabase (Postgres + Realtime) | Sincronizar sala, progreso y resultados sin servidor propio de websockets |
| Hosting | Vercel | Integración natural con Next.js |
| Limpieza de salas | `pg_cron` de Supabase (cada ~5 min) | Purga de salas vencidas (máximo 1 h); el cron de Vercel gratuito corre solo 1 vez por día |
| Tests | Vitest (lógica) + Playwright (flujo multiusuario) | La lógica de resultado (§6) debe tener cobertura completa |

- La lógica de cálculo de resultado (§6) debe ser una **función pura, separada de la UI y de la
  base de datos**, testeada con casos de victoria directa, ballotage, salto a ruleta y ruleta.
- Los votos individuales nunca se envían a otros clientes si la configuración no lo permite: el
  filtrado ocurre en el servidor, no en el frontend.
- **Votos protegidos:** la tabla de votos está bloqueada para los clientes (RLS). Solo el
  servidor (Route Handlers) escribe y lee votos. Los clientes se suscriben por Realtime únicamente
  a un estado de sala sanitizado (participantes, progreso, resultado ya filtrado).
- **Timers sin proceso vivo:** cada ronda/ballotage guarda su `deadline`. Al vencer (o cuando
  todos terminaron), los clientes piden el cierre; el servidor verifica la hora y cierra de forma
  idempotente, calcula y publica el resultado.
- **Expiración:** el servidor rechaza cualquier acción sobre una sala vencida, aunque la purga
  todavía no haya corrido.
- **Arquitectura de la POC** (elegida por simplicidad; a revisar/challengear para la versión
  completa):
  - *Functional core, imperative shell:* la lógica de dominio (resultado, ballotage, sorteos,
    visibilidad, fases de sala) son funciones puras; Route Handlers y React hacen I/O.
  - *Server-authoritative:* el cliente solo envía intenciones; el servidor valida y decide.
  - *CQRS liviano:* escrituras por Route Handlers; lecturas desde una "foto pública" sanitizada
    de la sala, a la que los clientes se suscriben por Realtime.
  - *Máquina de estados* para las fases de la sala (espera → votación → [ballotage] → [ruleta] →
    resultado → espera).
  - No se usa Clean / Hexagonal completa a propósito; candidata a evaluarse si el producto crece.
- **Presencia del anfitrión:** heartbeat de cada cliente (~10 s) guardado en la base; el servidor
  usa la última señal para habilitar "Tomar el control" a los 30 s (§8).

---

## 11. Métricas de éxito de la POC

- **Tasa de finalización:** salas que llegan a resultado / salas creadas.
- **Tiempo medio de decisión:** desde inicio de ronda hasta resultado.
- **Tasa de rebote del link:** personas que abren el link y no se unen.
- **Tasa de desempate:** porcentaje de rondas que van a ballotage o ruleta.
- **Repetición:** salas que juegan más de una ronda.

Como las salas se eliminan a la hora, las métricas se registran en una tabla de **eventos
anónimos** que no se purga (sala creada, link abierto, ingreso, ronda iniciada, ronda resuelta
con tipo de desenlace y duración, nueva ronda). No guarda apodos ni votos. En la POC se consultan
con SQL, sin dashboard.

---

## 12. Decisiones abiertas para el brainstorm

1. ~~Pesos de Súper antojo / Sí / No.~~ **Decidido:** 2 / 1 / 0 (ver §5.1).
2. ~~Si el Súper antojo se puede reasignar antes de terminar.~~ **Decidido:** no se reasigna ni
   se aplica hacia atrás (ver §5.1).
3. ~~Definición numérica de "victoria aplastante" y de "empate" para elegir finalistas.~~
   **Decidido:** margen = max(1, 20% del puntaje de la primera) (ver §6.1).
4. ~~Máximo de finalistas en ballotage.~~ **Decidido:** 3; si hay más dentro del margen, mayor
   puntaje y luego sorteo en el servidor (ver §6.2).
5. ~~Duración del timer de ronda y de ballotage.~~ **Decidido:** ronda 60 s (45 / 60 / 90
   configurable), ballotage 20 s fijos (ver §5.3 y §6.2).
6. ~~Lista final de categorías e imágenes.~~ **Decidido:** 14 categorías y fotos con licencia
   libre, aprobadas una por una (ver §5.2).
7. ~~Tamaño mínimo y máximo de grupo.~~ **Decidido:** 2 a 15, anfitrión incluido (ver §8).
8. ~~Comportamiento ante ingreso tardío y desconexión del anfitrión.~~ **Decidido:** el ingreso
   tardío entra como espectador y vota en el ballotage; si el anfitrión se desconecta, la ronda
   sigue; a los 30 s sin señal del anfitrión, otro participante puede "Tomar el control" (ver §8 y §6.3).
9. ~~Confirmación final del stack.~~ **Decidido:** stack de §10 con ajustes de limpieza, timers,
   privacidad y presencia.
