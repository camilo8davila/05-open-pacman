# SPEC 01 — Cuatro fantasmas con IA clásica del arcade

> **Estado:** Approved
> **Depende de:** ninguna
> **Fecha:** 2026-10-06
> **Objetivo:** Los 4 fantasmas (Blinky, Pinky, Inky y Clyde) salen escalonados de la jaula y persiguen a Pac-Man cada uno con su targeting clásico del arcade, alternando fases globales scatter/chase.

## Por qué existe este spec

Hoy hay 2 fantasmas (`hunter` y `random`) y la puerta de la jaula es permeable a los fantasmas. Este spec rompe ese patrón documentado en `AGENTS.md`: la puerta pasa a ser muro para todos y la salida de la jaula se vuelve scripteada. La línea del gotcha de la puerta en `AGENTS.md` se actualiza en el paso 3.

## Scope

**In:**

- 4 fantasmas con `kind` propio (`blinky`, `pinky`, `inky`, `clyde`) que reemplazan a `hunter`/`random` en `src/js/maze.js` (`GHOST_STARTS`) y `src/js/game.js` (`decideGhost`).
- Targeting de chase por personalidad: Blinky directo a Pac-Man (el agresivo), Pinky 4 celdas adelante, Inky flanquea vía Blinky, Clyde condicional por distancia.
- Modo global scatter/chase con temporizador en frames y reversa de dirección al cambiar de modo.
- Salida escalonada de la jaula: Blinky arranca fuera; Pinky, Inky y Clyde salen con retardos fijos (120/240/360 frames) mediante movimiento scripteado.
- La puerta (celda `3`) pasa a ser muro para el movimiento normal de todos los actores; la salida scripteada no usa `canMove`.
- Reordenar `GHOST_COLORS` en `src/js/render.js` para que el color siga al `kind`.
- Actualizar el gotcha de la puerta en `AGENTS.md`.

**Out of scope (para futuros specs):**

- Power pellets y modo frightened (fantasmas comestibles): requiere cambios en `MAZE_STR`, puntuación y render propios.
- Cruise Elroy (aceleración de Blinky al final del nivel) y velocidades distintas por fantasma.
- Rebote cosmético (bobbing) de los fantasmas esperando en la jaula.
- Timers basados en tiempo real (`performance.now()`); aquí todo va en frames.

## Data model

```js
// maze.js — posiciones iniciales (blinky fuera, sobre la puerta)
const GHOST_STARTS = [
  { x: 13, y: 11, kind: "blinky" },
  { x: 13, y: 14, kind: "pinky" },
  { x: 11, y: 14, kind: "inky" },
  { x: 16, y: 14, kind: "clyde" },
];
```

```js
// game.js — personalidad por kind (esquinas y retardos de salida)
const GHOST_PERSONALITIES = {
  blinky: { scatter: { x: 26, y: 1 }, releaseFrame: 0 }, // arranca activo
  pinky: { scatter: { x: 1, y: 1 }, releaseFrame: 120 }, // ~2s a 60fps
  inky: { scatter: { x: 26, y: 29 }, releaseFrame: 240 }, // ~4s
  clyde: { scatter: { x: 1, y: 29 }, releaseFrame: 360 }, // ~6s
};

// ciclo de modos (scatter 7s, chase 20s, repetido) — frames a ~60fps
const MODE_PHASES = [
  { mode: "scatter", frames: 420 },
  { mode: "chase", frames: 1200 },
];
```

Cada ghost en `game.ghosts` gana un campo:

```js
{ x, y, dir: 'up', speed: GHOST_SPEED, kind,
  state: 'waiting' | 'exiting' | 'active' } // blinky arranca 'active'
```

`game` gana tres campos: `ghostMode` (`'scatter'` | `'chase'`), `modeTimer` (frames desde el último cambio de modo) y `releaseTimer` (frames desde el inicio o reset de vida).

Reglas de targeting (posiciones redondeadas a celda, como el código actual):

- **Scatter (todos):** su esquina `scatter`.
- **Chase por kind:**
  - `blinky`: celda de Pac-Man.
  - `pinky`: Pac-Man + 4·`DIRS[pacman.dir]`.
  - `inky`: pivote = Pac-Man + 2·`DIRS[pacman.dir]`; target = `2·pivote − blinky` (usa `game.ghosts[0]`, que es blinky por construcción de `GHOST_STARTS`).
  - `clyde`: si distancia Manhattan a Pac-Man > 8 → Pac-Man; si no → su esquina.
- Selección greedy entre opciones sin reversa (regla existente), menor distancia Manhattan al target; empates por orden fijo `up, left, down, right`. El target no requiere ser transitable.

## Plan de implementación

1. **Datos de los 4 fantasmas** (`src/js/maze.js` + `src/js/render.js`): reemplazar `GHOST_STARTS` por las 4 entradas y reordenar `GHOST_COLORS` a `[ rojo, rosa, cian, naranja ]`. Test manual: cargar el juego y ver 4 fantasmas (3 en la jaula, 1 sobre la puerta) con colores correctos; la lógica vieja los mueve (los kinds nuevos caen en la rama aleatoria).
2. **Espera y personalidad** (`src/js/game.js`): agregar `GHOST_PERSONALITIES`; extender los ghosts en `createGame` con `state` (blinky `'active'`, resto `'waiting'`); `moveGhost` no mueve a los `'waiting'`. Test: Blinky caza; los otros 3 quedan quietos en la jaula.
3. **Salida scripteada + puerta muro** (`src/js/game.js` + `AGENTS.md`): `game.releaseTimer` avanza en `update`; al cumplir `releaseFrame` el ghost pasa a `'exiting'` y sale scripteado (primero centrarse en la columna 13, luego subir hasta la fila 11; al llegar, `'active'` con `dir: 'up'`). La celda `3` es muro para todos en `isWall`, el parámetro `actor` de `isWall`/`canMove` queda sin uso y se elimina. Actualizar el gotcha de la puerta en `AGENTS.md`. Test: Pinky sale ~2s, Inky ~4s, Clyde ~6s, y salen a cazar con la lógica interina (greedy a Pac-Man).
4. **Modo global scatter/chase** (`src/js/game.js`): `ghostMode` + `modeTimer` con `MODE_PHASES` repetido; en scatter todos target su esquina (chase interino = greedy a Pac-Man); al cambiar de modo, los `'active'` invierten `dir` con `OPPOSITE`. Test: se observa ~7s de retirada a esquinas y ~20s de persecución, en loop.
5. **Chase por personalidad** (`src/js/game.js`): `decideGhost` calcula el target según `kind` con las reglas de arriba y desempata con orden fijo `up, left, down, right`. Test: Pinky corta el paso, Inky flanquea por el lado opuesto a Blinky, Clyde se retira al acercarse.
6. **Reset por muerte** (`src/js/game.js`): `resetPositions` re-ejecuta la salida escalonada (posiciones a starts, estados por kind, `releaseTimer` a 0) y reinicia `ghostMode` a `'scatter'` con `modeTimer` a 0. Test: perder una vida y ver la re-salida escalonada; ganar comiendo todos los dots sigue funcionando.

## Criterios de aceptación

- [ ] Al iniciar, Blinky (rojo) sale de (13,11) y persigue directamente la celda de Pac-Man.
- [ ] Pinky (rosa) sale de la jaula ~2s después, Inky (cian) ~4s y Clyde (naranja) ~6s.
- [ ] Pinky apunta 4 celdas adelante de la dirección de Pac-Man (le corta el paso).
- [ ] Inky flanquea: su objetivo se aleja de Blinky por el lado opuesto (visible con Blinky cerca de Pac-Man).
- [ ] Clyde persigue a más de 8 celdas de distancia y se retira a su esquina (1,29) al quedar a ≤8.
- [ ] Los 4 se retiran a sus esquinas ~7s (scatter) y persiguen ~20s (chase), invirtiendo dirección en cada cambio.
- [ ] Ningún fantasma reentra a la jaula por la puerta.
- [ ] Al perder una vida, los fantasmas vuelven a sus starts y re-ejecutan la salida escalonada con el modo scatter reiniciado.
- [ ] No hay errores en la consola y la partida se gana al comer todos los dots.

## Decisiones

- **Sí:** personalidades clásicas del arcade (elegido por el usuario en la fase de preguntas).
- **Sí:** ciclo scatter/chase simplificado repetido (420/1200 frames) en vez de la tabla de 8 fases del arcade. Mismo efecto jugable, menos código.
- **Sí:** reversa de dirección al cambiar de modo (comportamiento clásico).
- **Sí:** desempate clásico `up, left, down, right`; distancia Manhattan (ya usada en `game.js`) en vez de la Euclídea del arcade.
- **Sí:** puerta (`3`) como muro para todos y salida scripteada sin `canMove`. Simplifica `isWall` (elimina `actor`) y evita re-entradas a la jaula.
- **Sí:** timers en frames asumiendo ~60fps de `requestAnimationFrame`.
- **No:** replicar el bug original de Pinky (overflow hacia arriba-izquierda); se implementa el comportamiento intencional.
- **No:** power pellets / frightened, Elroy, velocidades distintas, bobbing (elegidos como fuera de alcance por el usuario o por simplicidad).
- **No:** archivo nuevo (`ghosts.js`); queda en `game.js` para no crear un handshake de globals adicional.

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                            |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Greedy sin pathfinding puede oscilar ante targets inalcanzables (esquinas o targets en pared) | Mismo enfoque del arcade original; la regla de no-reversa y el desempate fijo lo atenúan.                             |
| `requestAnimationFrame` corre a la tasa del display (120Hz en Macs recientes)                 | Los ciclos y salidas se aceleran proporcionalmente. Aceptado; si molesta, un futuro spec migra a `performance.now()`. |

## Qué **no** está en este spec

- Power pellets y modo frightened (fantasmas comestibles).
- Cruise Elroy y velocidades distintas por fantasma.
- Bobbing en la jaula, pathfinding real (A\*), cambios de HUD o de `main.js`/`index.html`.

Cada uno de esos, si llega, va en su propio spec.
