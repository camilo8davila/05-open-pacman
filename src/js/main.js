// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;
let previousTime = null;
let accumulator = 0;

const TICK_DURATION = 1000 / 60;
const MAX_FRAME_DURATION = 100;

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacman.nextDir = dir;
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

function loop( timestamp ) {
  if ( previousTime === null ) previousTime = timestamp;
  accumulator += Math.min( timestamp - previousTime, MAX_FRAME_DURATION );
  previousTime = timestamp;

  while ( accumulator >= TICK_DURATION ) {
    frame++;
    if ( game.state === 'playing' ) {
      update( game );
      if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
      else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
    }
    accumulator -= TICK_DURATION;
  }

  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

requestAnimationFrame( loop );
