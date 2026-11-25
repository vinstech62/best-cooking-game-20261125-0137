// Boot and the one loop: input every frame, the kitchen advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused and
// game over. ?shot=cover|assembly|serve|rush stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { DAY_SECONDS, ITEM, addPopup, createRun, recipeById, serveReward, updatePopups } from './state.js';
import { createOrderBoard, findMatchingOrder, removeOrder, stepOrders } from './orders.js';
import { STATIONS, chopStep, createKitchen, grillState, stepKitchen } from './kitchen.js';
import { clickTo, createChef, nearestStation, trashCarried, useStation, walkChef } from './chef.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
/** Points lost when a ticket's customer walks away. */
const EXPIRE_PENALTY = 25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function createGame() {
  return {
    run: createRun(),
    board: createOrderBoard(),
    kitchen: createKitchen(),
    chef: createChef(),
    time: 0,
    hint: 'WASD / click to move  •  E to use a station  •  hold SPACE to chop',
    highlight: null,
  };
}

let game = createGame();
let best = 0;

function announce(message) {
  status.textContent = message;
}

/** Serve the first plate that matches a waiting ticket; returns true on a serve. */
function ringBell() {
  for (const plate of game.kitchen.plates) {
    if (plate.items.length === 0) continue;
    const order = findMatchingOrder(game.board, plate.items);
    if (order === null) continue;
    const reward = serveReward(
      recipeById(order.recipeId),
      order.patience,
      order.maxPatience,
      game.run.combo,
    );
    removeOrder(game.board, order.id);
    plate.items.length = 0;
    game.run.score += reward.points;
    game.run.coins += reward.coins;
    game.run.combo += 1;
    game.run.bestCombo = Math.max(game.run.bestCombo, game.run.combo);
    game.run.served += 1;
    game.kitchen.bellRing = 0.6;
    addPopup(game.run, STATIONS.bell.x, STATIONS.bell.y - 60, `+${reward.points}`, '#f2c94c');
    audio.ding();
    announce(`Served ${order.name} for ${reward.points} points.`);
    return true;
  }
  audio.buzz();
  game.hint = 'No plate matches a ticket yet — check the order board!';
  return false;
}

function hintFor(station) {
  const chef = game.chef;
  const kitchen = game.kitchen;
  if (station === null) return 'WASD / click to move  •  E to use a station  •  hold SPACE to chop';
  if (station.kind === 'bin') {
    return chef.carrying === null ? `E: grab ${station.label.toLowerCase()}` : 'Hands full — chop it, grill it or plate it';
  }
  if (station.kind === 'chop') {
    if (chef.carrying !== null) return 'E: put it on the chopping board';
    if (kitchen.chop.item !== null) {
      return kitchen.chop.progress >= 1 ? 'E: grab the chopped salad' : 'Hold SPACE to chop';
    }
    return 'Bring lettuce or tomato to chop';
  }
  if (station.kind === 'grill') {
    const slot = kitchen.grill[0].item !== null ? kitchen.grill[0] : kitchen.grill[1];
    if (chef.carrying === ITEM.RAW_PATTY) return 'E: put the patty on the grill';
    if (slot.item !== null) {
      const state = grillState(slot);
      if (state === 'cooked') return 'E: grab the cooked patty';
      if (state === 'burnt') return 'E: grab the burnt patty — bin it!';
      return 'Patty is grilling…';
    }
    return 'Bring a raw patty to grill';
  }
  if (station.kind === 'plates') {
    if (chef.carrying !== null) return 'E: add it to the plate';
    const fullest = kitchen.plates[0].items.length >= kitchen.plates[1].items.length ? kitchen.plates[0] : kitchen.plates[1];
    return fullest.items.length > 0 ? 'E: take the top item back off the plate' : 'Build the burger here, ticket order first';
  }
  if (station.kind === 'bell') return 'E: ring the bell to serve a finished plate';
  if (station.kind === 'trash') return 'E: throw away what you are carrying';
  return '';
}

function stepGame(dt, keys) {
  const run = game.run;
  run.elapsed += dt;
  run.timeLeft = Math.max(0, DAY_SECONDS - run.elapsed);
  game.time += dt;

  walkChef(game.chef, dt, keys);

  // Arriving at a clicked station uses it.
  if (game.chef.target === null && game.chef.pendingStation !== null) {
    const station = game.chef.pendingStation;
    game.chef.pendingStation = null;
    const action = useStation(game.chef, game.kitchen, station);
    if (action === 'bell') ringBell();
    else if (action === 'pickup' || action === 'board-take' || action === 'grill-take') audio.pickup();
    else if (action !== null) audio.place();
  }

  // Holding SPACE by the board chops.
  const near = nearestStation(game.chef);
  if (keys.chop && near !== null && near.kind === 'chop' && game.kitchen.chop.item !== null) {
    if (chopStep(game.kitchen, dt)) audio.chop();
  }

  game.highlight = near;
  game.hint = hintFor(near);

  const expired = stepOrders(game.board, dt, run.elapsed, Math.random);
  for (const id of expired) {
    run.score = Math.max(0, run.score - EXPIRE_PENALTY);
    run.combo = 0;
    run.lost += 1;
    audio.expire();
    announce(`A customer walked away. -${EXPIRE_PENALTY} points.`);
  }

  const sizzling = stepKitchen(game.kitchen, dt);
  audio.setSizzle(sizzling);
  updatePopups(run, dt);
  return run.timeLeft <= 0;
}

function runShot(name) {
  const staged = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, staged.screen, best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const keys = { up: false, down: false, left: false, right: false, chop: false };
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'chop',
  };

  function startGame() {
    game = createGame();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Serve every ticket before its patience runs out.');
  }  function endGame() {
    screen = SCREEN_OVER;
    if (game.run.score > best) best = game.run.score;
    audio.setSizzle(false);
    announce(`Day over. Score ${game.run.score}. Best ${best}.`);
  }

  function interact() {
    if (screen !== SCREEN_PLAY) return;
    const station = nearestStation(game.chef);
    const action = useStation(game.chef, game.kitchen, station);
    if (action === 'bell') ringBell();
    else if (action === 'pickup' || action === 'board-take' || action === 'grill-take') audio.pickup();
    else if (action !== null) audio.place();
  }

  window.addEventListener('keydown', (event) => {
    audio.unlock();
    if (event.code === 'Space' && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      if (!event.repeat) startGame();
      event.preventDefault();
      return;
    }
    if (event.code in KEYMAP) {
      keys[KEYMAP[event.code]] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') {
      if (screen === SCREEN_PLAY) interact();
    } else if (event.code === 'KeyT' && screen === SCREEN_PLAY) {
      if (trashCarried(game.chef)) audio.place();
    } else if (event.code === 'KeyM') {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        audio.setSizzle(false);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (event.code === 'KeyR') {
      if (screen === SCREEN_OVER || screen === SCREEN_PAUSED) startGame();
    } else if (event.code === 'Enter') {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code in KEYMAP) keys[KEYMAP[event.code]] = false;
  });
  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.chop = false;
  });

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 800,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      startGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const point = toLogical(event);
    const near = nearestStation(game.chef);
    if (near !== null) {
      // Clicking a station while standing by it uses it at once.
      const station = near;
      const dx = point.x - station.x;
      const dy = point.y - station.y;
      const reach = station.kind === 'bin' ? 80 : 140;
      if (Math.hypot(dx, dy) < reach) {
        interact();
        return;
      }
    }
    clickTo(game.chef, point.x, point.y);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setSizzle(false);
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const over = stepGame(STEP, keys);
        accumulator -= STEP;
        if (over) {
          endGame();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen, best);
  }

  announce('Sizzle and Serve. Press Space or click to open the stall.');
  requestAnimationFrame(frame);
}

/** Read-only peek at the run for automated play-testing (never used by the game). */
window.__sizzle = {
  state() {
    return {
      score: game.run.score,
      coins: game.run.coins,
      combo: game.run.combo,
      served: game.run.served,
      lost: game.run.lost,
      timeLeft: game.run.timeLeft,
      orders: game.board.orders.map((order) => ({ id: order.id, name: order.name, items: [...order.items], patience: Math.round(order.patience) })),
      chef: { x: Math.round(game.chef.x), y: Math.round(game.chef.y), carrying: game.chef.carrying, target: game.chef.target },
      grill: game.kitchen.grill.map((slot) => ({ item: slot.item, seconds: Math.round(slot.seconds) })),
      chop: { item: game.kitchen.chop.item, progress: game.kitchen.chop.progress },
      plates: game.kitchen.plates.map((plate) => [...plate.items]),
    };
  },
};

if (shot) runShot(shot);
else runGame();
