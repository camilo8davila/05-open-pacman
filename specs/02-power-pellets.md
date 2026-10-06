# SPEC 02 — Power pellets y modo frightened

> **Estado:** Done
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-06
> **Objetivo:** Las 4 power pellets clásicas de las esquinas (celda 4) hacen a los fantasmas azules, erráticos y comestibles (200/400/800/1600), y el comido vuelve como ojos a la jaula para revivir.

## Por qué existe este spec

SPEC 01 dejó pendiente "power pellets y modo frightened" como una unidad. Este spec extiende dos contratos documentados en `AGENTS.md`: el vocabulario de celdas del grid (0-3 pasa a 0-4) y los estados de los fantasmas (`waiting/exiting/active` ganan `returning/entering`).

## Scope

**In:**

- 4 power pellets en (1,3), (26,3), (1,23), (26,23): char `'o'` en `MAZE_STR` → celda `4` en `parseTile`, dibujadas con radio 7 en `drawDots` (`src/js/render.js`), +50 puntos al comerlas, cuentan en `dotsRemaining`.
- Modo frightened global (360 frames) al comer una pellet: flags `frightened` en los ghosts `'waiting'/'exiting'/'active'`, reversa de `dir` en los `'active'`, huida aleatoria en cruces, parpadeo azul/blanco los últimos 120 frames, ciclo scatter/chase pausado mientras dura.
- Fantasmas comestibles: colisión con un `'active'` frightened → cadena 200/400/800/1600 (reiniciada por cada pellet), el fantasma pasa a `'returning'` (ojos, greedy a la puerta (13,11)), luego `'entering'` (script bajando a (13,14)) y revive vía `'exiting'` existente.
- Colisión solo con fantasmas `'active'` (ojos, esperando o saliendo no colisionan).
- `resetPositions` apaga `frightenedTimer`, `frightenedChain` y flags además del reset de SPEC 01.
- Actualizar el gotcha de celdas en `AGENTS.md` y el header de `src/js/maze.js` a `0-4`.

**Out of scope (para futuros specs):**

- Parpadeo de las pellets (dibujadas estáticas, como los dots).
- Velocidades distintas (frightened lento, Pac-Man rápido, Cruise Elroy) — fuera de alcance ya en SPEC 01.
- Texto flotante con los puntos al comer un fantasma.
- Frutas (bonus) y niveles con frightened progresivamente más corto.
- Timers en tiempo real (`performance.now()`); aquí todo sigue en frames.
- Cambios en `main.js` o `index.html`.

## Data model

```js
// maze.js — parseTile agrega el cuarto valor
if (ch === "o") return 4;

// MAZE_STR, filas 3 y 23 ('o' en cols 1 y 26; mantienen 28 chars y simetría)
("#o####.#####.##.#####.####o#"); // fila 3
("#o..##................##..o#"); // fila 23
```

```js
// game.js
const FRIGHTENED_FRAMES = 360;           // ~6s a ~60fps
const FRIGHTENED_FLASH = 120;            // parpadeo final
const DOOR_OUTSIDE = { x: 13, y: 11 };   // target de los ojos
const EATEN_SCORES = [ 200, 400, 800, 1600 ];

// game gana:
frightenedTimer: 0,   // 0 = sin efecto
frightenedChain: 0,

// cada ghost gana:
frightened: false,
state: 'waiting' | 'exiting' | 'active' | 'returning' | 'entering'
```

Reglas:

- **Comer celda 4** (`movePacman`): grid → 0, `score += 50`, `dotsRemaining--`, `frightenedTimer = 360`, `frightenedChain = 0`, flag `frightened = true` en `waiting/exiting/active`, reversa de `dir` en los `'active'`.
- **`decideGhost`**: frightened → azar entre las opciones sin reversa (callejón → reversa, como hoy); `'returning'` → target fijo `DOOR_OUTSIDE`; resto igual que hoy.
- **Estados nuevos**: `'returning'` llega alineado a (13,11) → `'entering'`; `'entering'` baja scripteado a (13,14) → `'exiting'` (`moveGhostOut` existente sube y deja `'active'`).
- **Timer**: `update` decrementa `frightenedTimer`; al llegar a 0 apaga todos los flags. `updateGhostMode` no avanza mientras `frightenedTimer > 0`.
- **Colisión**: solo `'active'`. Frightened → Pac-Man se lo come (`EATEN_SCORES[chain]` con tope 1600, `chain++`, `state: 'returning'`, `frightened: false`). No frightened → pierde vida como hoy.

Coordenadas en celdas (origen arriba-izquierda), timers en frames, como SPEC 01.

## Plan de implementación

1. **Pellets en el grid** (`src/js/maze.js` + `src/js/game.js` + `src/js/render.js` + `AGENTS.md`): `parseTile` agrega `'o' → 4`; filas 3 y 23 de `MAZE_STR` cambian cols 1 y 26 a `'o'`; header de `maze.js` y gotcha de `AGENTS.md` pasan a `0 vacío · 1 pared · 2 dot · 3 puerta · 4 power pellet`; `createGame` cuenta `v === 4` en dots; `movePacman` come la celda 4 (+50); `drawDots` dibuja la 4 con radio 7. Test manual: 4 círculos grandes en las esquinas; comerlas suma 50; el nivel no se gana sin las 4.
2. **Frightened global + huida** (`src/js/game.js` + `src/js/render.js`): constantes y campos nuevos; comer pellet enciende el efecto (flags, reversa, chain 0); `update` decrementa y apaga a 0; `updateGhostMode` no avanza con efecto activo; `decideGhost` elige al azar cuando frightened; `drawGhost( ctx, g, game )` pinta azul (`#2121de`) con cara pálida y alterna a blanco los últimos 120 frames. Test: comer pellet → todos azules deambulando ~6s con parpadeo final; scatter/chase reanuda donde iba.
3. **Comer fantasmas + ojos** (`src/js/game.js` + `src/js/render.js`): colisión ignora a los no-`'active'`; `'active'` frightened → `EATEN_SCORES`, `chain++`, `'returning'`, `frightened: false`; `decideGhost` con `'returning'` apunta a `DOOR_OUTSIDE`; al llegar a (13,11) pasa a `'entering'`; render de `'returning'/'entering'` como ojos (sin cuerpo). Test: comer los 4 de una misma pellet = 200+400+800+1600; los ojos cruzan hasta la puerta sin matar a Pac-Man; un revivido no vuelve azul aunque el timer siga.
4. **Entrada y revival** (`src/js/game.js`): `'entering'` baja scripteado de (13,11) a (13,14), espejo de `moveGhostOut`, y pasa a `'exiting'` (la salida existente lo revive); `resetPositions` apaga `frightenedTimer/chain/flags`. Test: ciclo completo (comido → ojos → jaula → sale cazando); perder una vida en pleno frightened resetea todo como SPEC 01.

## Criterios de aceptación

- [ ] Las 4 pellets se ven claramente más grandes que los dots en (1,3), (26,3), (1,23), (26,23).
- [ ] Comer una pellet suma exactamente 50 y los fantasmas activos invierten dirección y se ponen azules.
- [ ] Frightened dura ~360 frames con dirección aleatoria en cada cruce, y el ciclo scatter/chase se reanuda donde iba.
- [ ] Los últimos ~120 frames los fantasmas frightened parpadean entre azul y blanco.
- [ ] Comer los 4 fantasmas de una misma pellet suma 200+400+800+1600; una nueva pellet reinicia la cadena.
- [ ] El fantasma comido se dibuja solo como ojos, llega greedy a (13,11), entra a la jaula y sale de nuevo `'active'` sin frightened.
- [ ] Solo los `'active'` colisionan: los ojos ni matan ni son comestibles.
- [ ] El nivel no se gana sin comer las 4 pellets (cuentan en `dotsRemaining`).
- [ ] Perder una vida durante el frightened restaura posiciones, modos y flags como SPEC 01.
- [ ] No hay errores en la consola.

## Decisiones

- **Sí:** frightened completo junto con las pellets (SPEC 01 las dejó como unidad; sin efecto, la pellet es solo un dot grande).
- **Sí:** posiciones clásicas del arcade (1,3), (26,3), (1,23), (26,23) — hoy son dots y respetan la simetría del eje 13-14.
- **Sí:** celda `4` con char `'o'` — extiende el patrón `'#'/'.'/'-'` de `MAZE_STR`; comer y dibujar reutilizan `game.grid` sin estructuras paralelas.
- **Sí:** las 4 cuentan en `dotsRemaining` — como el arcade, el nivel exige comerlas.
- **Sí:** 50 puntos (valor del arcade; dot = 10).
- **Sí:** flag `frightened` por ghost + `frightenedTimer` global — los revividos no re-entran al efecto con la misma pellet (clásico) y el parpadeo sale del timer global.
- **Sí:** timers en frames (360/120), mismo criterio de SPEC 01.
- **Sí:** huida aleatoria en cruces reutilizando el filtro de opciones sin reversa.
- **Sí:** pausar scatter/chase durante frightened (clásico; evita reversas cruzadas).
- **Sí:** `'returning' → 'entering' → 'exiting'` — el entering es espejo de `moveGhostOut` y el exiting existente revive sin código nuevo.
- **Sí:** solo los `'active'` colisionan (los ojos cruzando a Pac-Man no lo matan, como el arcade).
- **No:** parpadeo de las pellets; quedan estáticas como los dots.
- **No:** velocidades distintas durante frightened (ya fuera de alcance en SPEC 01).
- **No:** texto flotante con los puntos al comer un fantasma.
- **No:** archivo nuevo (p. ej. `frightened.js`); queda en `game.js`/`render.js`, criterio SPEC 01 de no crear handshakes de globals.

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` corre a la tasa del display (120Hz en Macs recientes)                  | Aceptado ya en SPEC 01; el frightened dura ~3s reales en 120Hz. Si molesta, un futuro spec migra a `performance.now()`. |
| Greedy de los ojos hacia (13,11) puede oscilar, como cualquier target del `decideGhost` actual | Mismo riesgo aceptado en SPEC 01; la regla de no-reversa lo atenúa y (13,11) es una celda abierta central.              |
| Editar `MAZE_STR` puede romper los 28 chars o la simetría                                      | Filas 3 y 23 quedan espejo ('o' en cols 1 y 26); el gotcha de `AGENTS.md` exige contar 28 chars por fila.               |

## Qué **no** está en este spec

- Parpadeo de las pellets, velocidades distintas (frightened lento / Pac-Man rápido / Elroy).
- Texto flotante de puntos, frutas, niveles progresivos, `performance.now()`.
- Cambios en `main.js` o `index.html`.

Cada uno de esos, si llega, va en su propio spec.
