// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const GHOST_DIR_ORDER = [ 'up', 'left', 'down', 'right' ];
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 1 / 12;
const GHOST_SPEED = 1 / 16;
const FRIGHTENED_FRAMES = 360;
const FRIGHTENED_FLASH = 120;
const DOOR_OUTSIDE = { x: 13, y: 11 };
const EATEN_SCORES = [ 200, 400, 800, 1600 ];

const GHOST_PERSONALITIES = {
  blinky: { scatter: { x: 26, y: 1 }, releaseFrame: 0 },
  pinky: { scatter: { x: 1, y: 1 }, releaseFrame: 120 },
  inky: { scatter: { x: 26, y: 29 }, releaseFrame: 240 },
  clyde: { scatter: { x: 1, y: 29 }, releaseFrame: 360 },
};

const MODE_PHASES = [
  { mode: 'scatter', frames: 600 },
  { mode: 'chase', frames: 900 },
];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) {
    for ( const v of row ) if ( v === 2 || v === 4 ) dots++;
  }

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    ghostMode: 'scatter',
    modeTimer: 0,
    releaseTimer: 0,
    frightenedTimer: 0,
    frightenedChain: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      state: g.kind === 'blinky' ? 'active' : 'waiting',
      frightened: false,
      reversePending: false,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Paredes y puerta bloquean el movimiento normal de todos los actores.
function isWall( grid, x, y ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  return v === 1 || v === 3;
}

// Puede avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function startFrightened( game ) {
  game.frightenedTimer = FRIGHTENED_FRAMES;
  game.frightenedChain = 0;
  game.ghosts.forEach( ( g ) => {
    if ( g.state !== 'waiting' && g.state !== 'exiting' && g.state !== 'active' ) return;
    g.frightened = true;
    g.reversePending = g.state === 'active';
    if ( g.reversePending ) g.dir = OPPOSITE[ g.dir ];
  } );
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    if ( grid[ p.y ][ p.x ] === 2 || grid[ p.y ][ p.x ] === 4 ) {
      const tile = grid[ p.y ][ p.x ];
      grid[ p.y ][ p.x ] = 0;
      game.score += tile === 4 ? 50 : 10;
      game.dotsRemaining--;
      if ( tile === 4 ) startFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function getChaseTarget( game, ghost ) {
  const pacman = game.pacman;
  const pacmanCell = { x: Math.round( pacman.x ), y: Math.round( pacman.y ) };

  if ( ghost.kind === 'blinky' ) return pacmanCell;

  const direction = DIRS[ pacman.dir ];
  if ( ghost.kind === 'pinky' ) {
    return {
      x: pacmanCell.x + direction.x * 4,
      y: pacmanCell.y + direction.y * 4,
    };
  }

  if ( ghost.kind === 'inky' ) {
    const blinky = game.ghosts[ 0 ];
    const pivot = {
      x: pacmanCell.x + direction.x * 2,
      y: pacmanCell.y + direction.y * 2,
    };
    return {
      x: pivot.x * 2 - Math.round( blinky.x ),
      y: pivot.y * 2 - Math.round( blinky.y ),
    };
  }

  const distance =
    Math.abs( Math.round( ghost.x ) - pacmanCell.x ) +
    Math.abs( Math.round( ghost.y ) - pacmanCell.y );
  return distance > 8 ? pacmanCell : GHOST_PERSONALITIES.clyde.scatter;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = GHOST_DIR_ORDER.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];
  if ( g.frightened ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  const target = g.state === 'returning'
    ? DOOR_OUTSIDE
    : game.ghostMode === 'scatter'
      ? GHOST_PERSONALITIES[ g.kind ].scatter
      : getChaseTarget( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhostOut( g ) {
  if ( !aligned( g.x ) || Math.round( g.x ) !== 13 ) {
    g.x += ( g.x < 13 ? 1 : -1 ) * g.speed;
    if ( aligned( g.x ) && Math.round( g.x ) === 13 ) g.x = 13;
    return;
  }

  g.y -= g.speed;
  if ( aligned( g.y ) && Math.round( g.y ) <= 11 ) {
    g.y = 11;
    g.dir = 'up';
    g.state = 'active';
  }
}

function moveGhostIntoPen( g ) {
  if ( !aligned( g.x ) || Math.round( g.x ) !== 13 ) {
    g.x += ( g.x < 13 ? 1 : -1 ) * g.speed;
    if ( aligned( g.x ) && Math.round( g.x ) === 13 ) g.x = 13;
    return;
  }

  g.y += g.speed;
  if ( aligned( g.y ) && Math.round( g.y ) >= 14 ) {
    g.y = 14;
    g.dir = 'up';
    g.frightened = false;
    g.reversePending = false;
    g.state = 'exiting';
  }
}

function moveGhost( game, g ) {
  if ( g.state === 'waiting' ) return;
  if ( g.state === 'exiting' ) {
    moveGhostOut( g );
    return;
  }
  if ( g.state === 'entering' ) {
    moveGhostIntoPen( g );
    return;
  }

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.state === 'returning' && g.x === DOOR_OUTSIDE.x && g.y === DOOR_OUTSIDE.y ) {
      g.state = 'entering';
      return;
    }
    if ( g.reversePending ) g.reversePending = false;
    else decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.state = g.kind === 'blinky' ? 'active' : 'waiting';
    g.frightened = false;
    g.reversePending = false;
  } );
  game.releaseTimer = 0;
  game.ghostMode = 'scatter';
  game.modeTimer = 0;
  game.frightenedTimer = 0;
  game.frightenedChain = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function updateGhostMode( game ) {
  if ( game.frightenedTimer > 0 ) return;

  game.modeTimer++;
  const phase = MODE_PHASES.find( ( item ) => item.mode === game.ghostMode );
  if ( game.modeTimer < phase.frames ) return;

  game.modeTimer = 0;
  game.ghostMode = game.ghostMode === 'scatter' ? 'chase' : 'scatter';
  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'active' ) g.dir = OPPOSITE[ g.dir ];
  } );
}

function updateFrightened( game ) {
  if ( game.frightenedTimer <= 0 ) return;

  game.frightenedTimer--;
  if ( game.frightenedTimer > 0 ) return;

  game.ghosts.forEach( ( g ) => {
    g.frightened = false;
    g.reversePending = false;
  } );
}

function update( game ) {
  updateFrightened( game );
  game.releaseTimer++;
  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'waiting' && game.releaseTimer >= GHOST_PERSONALITIES[ g.kind ].releaseFrame ) {
      g.state = 'exiting';
    }
  } );

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );
  updateGhostMode( game );

  for ( const g of game.ghosts ) {
    if ( g.state !== 'active' ) continue;
    if ( collides( game.pacman, g ) ) {
      if ( g.frightened ) {
        const scoreIndex = Math.min( game.frightenedChain, EATEN_SCORES.length - 1 );
        game.score += EATEN_SCORES[ scoreIndex ];
        game.frightenedChain++;
        g.state = 'returning';
        g.frightened = false;
        g.reversePending = false;
        continue;
      }

      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
