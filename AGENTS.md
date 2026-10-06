git push -u origin main# AGENTS.md

Juego tipo Pac-Man en JS vanilla sobre canvas. Sin build, sin bundler, sin npm, sin tests.

## Ejecutar

```sh
open src/index.html                 # file:// funciona (no hay fetch ni módulos)
python3 -m http.server -d src       # alternativa: http://localhost:8000
```

No hay suite de tests, lint ni typecheck. La verificación es manual en el navegador.

## Arquitectura

- NO ES modules: scripts clásicos cargados en orden por `src/index.html` — `maze.js` → `game.js` → `render.js` → `main.js`.
- Se comunican por globals en `window`: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` (maze) · `createGame`, `update`, `DIRS` (game) · `draw` (render).
- Archivo JS nuevo: agregar el tag `<script>` en `index.html` respetando el orden de dependencias y exportar a `window` lo que otros archivos usen.

## Gotchas

- Celdas del grid: `0` vacío · `1` pared · `2` dot · `3` puerta-pen · `4` power pellet. La puerta (`3`) bloquea el movimiento normal de Pac-Man y los fantasmas; la salida inicial de la jaula de los fantasmas es scripteada (`game.js`).
- `MAZE` es la matriz prístina: nunca mutarla. Cada partida la copia a `game.grid` (`createGame`) y los dots se comen ahí. El render dibuja `game.grid`, no `MAZE`.
- Laberinto 28x31, simétrico respecto al eje entre columnas 13-14. Al editar `MAZE_STR`: cada fila debe tener exactamente 28 chars; la fila 14 es el túnel (extremos abiertos).
- El canvas en `index.html` (560x620) es `(28, 31) * TILE` (`TILE = 20` en `render.js`). Si cambias dimensiones del maze o `TILE`, actualiza el canvas.
- Movimiento en posiciones fraccionales (pacman 1/8 celda/frame, fantasmas 1/10); los giros solo aplican cuando la posición está alineada a la celda (`aligned`). El túnel (`wrapTunnel`) solo aplica en `TUNNEL_ROW`.

## Convenciones de código

- Single quotes, 2 espacios, espacio dentro de paréntesis: `fn( a, b )`.
- Identificadores en inglés, comentarios en español.
