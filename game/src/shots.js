// The screenshot scenes behind ?shot=cover|assembly|serve|rush. Each one builds a
// real game state with the same rules as play (orders, grill timers, a plate
// mid-assembly) and freezes the day clock, so the frame is a genuine render of
// the game at a moment a player can reach — and the same URL always gives the
// same frame.

import { ITEM, createRun } from './state.js';
import { createOrderBoard } from './orders.js';
import { createKitchen } from './kitchen.js';
import { createChef } from './chef.js';
import { SCREEN_PLAY } from './render.js';

function baseGame() {
  const run = createRun();
  const board = createOrderBoard();
  const kitchen = createKitchen();
  const chef = createChef();
  return { run, board, kitchen, chef, time: 0, hint: null, highlight: null };
}

function ticket(board, id, recipeId, name, items, patience, maxPatience) {
  board.orders.push({ id, recipeId, name, items, patience, maxPatience, born: 0 });
  board.nextId = Math.max(board.nextId, id + 1);
}

/** Set `game` to the named scene and return the screen to draw over it. */
export function stageShot(name, game) {
  const fresh = baseGame();
  Object.assign(game, fresh);
  const { run, board, kitchen, chef } = game;

  if (name === 'assembly') {
    run.timeLeft = 132;
    run.score = 340;
    run.coins = 58;
    run.combo = 2;
    ticket(board, 1, 'classic', 'Classic Burger', ['bun', 'patty', 'choppedLettuce'], 38, 55);
    ticket(board, 2, 'cheese', 'Cheese Melt', ['bun', 'patty', 'cheese', 'choppedTomato'], 22, 50);
    kitchen.plates[0].items = ['bun', 'patty', 'cheese'];
    kitchen.chop.item = 'lettuce';
    kitchen.chop.progress = 0.7;
    kitchen.grill[0].item = 'rawPatty';
    kitchen.grill[0].seconds = 4;
    chef.x = 380;
    chef.y = 470;
    chef.carrying = null;
    game.hint = 'Chopping lettuce — hold SPACE to finish, then plate it';
    game.highlight = { kind: 'chop', x: 380, y: 310 };
    return { screen: SCREEN_PLAY };
  }

  if (name === 'serve') {
    run.timeLeft = 96;
    run.score = 720;
    run.coins = 124;
    run.combo = 3;
    ticket(board, 1, 'classic', 'Classic Burger', ['bun', 'patty', 'choppedLettuce'], 41, 55);
    ticket(board, 2, 'garden', 'Garden Stack', ['bun', 'choppedLettuce', 'choppedTomato', 'cheese'], 30, 50);
    kitchen.plates[0].items = ['bun', 'patty', 'choppedLettuce'];
    kitchen.bellRing = 0.6;
    chef.x = 1120;
    chef.y = 470;
    chef.carrying = null;
    game.time = 0.2;
    run.popups.push({ x: 1180, y: 240, text: '+140', color: '#f2c94c', age: 0.2, life: 1.4 });
    game.hint = 'Classic Burger ready — ring the bell to serve it!';
    game.highlight = { kind: 'bell', x: 1180, y: 310 };
    return { screen: SCREEN_PLAY };
  }

  if (name === 'rush') {
    run.timeLeft = 47;
    run.score = 1150;
    run.coins = 210;
    run.combo = 4;
    ticket(board, 1, 'double', 'Double Trouble', ['bun', 'patty', 'patty', 'cheese'], 6, 40);
    ticket(board, 2, 'cheese', 'Cheese Melt', ['bun', 'patty', 'cheese', 'choppedTomato'], 18, 45);
    ticket(board, 3, 'classic', 'Classic Burger', ['bun', 'patty', 'choppedLettuce'], 26, 50);
    ticket(board, 4, 'garden', 'Garden Stack', ['bun', 'choppedLettuce', 'choppedTomato', 'cheese'], 33, 48);
    kitchen.grill[0].item = 'rawPatty';
    kitchen.grill[0].seconds = 15;
    kitchen.grill[1].item = 'rawPatty';
    kitchen.grill[1].seconds = 5;
    kitchen.chop.item = 'tomato';
    kitchen.chop.progress = 0.45;
    kitchen.plates[0].items = ['bun', 'patty'];
    chef.x = 700;
    chef.y = 480;
    chef.carrying = ITEM.RAW_PATTY;
    game.time = 0.4;
    game.hint = 'Rush hour! One ticket is about to walk away — and a patty is burning';
    game.highlight = { kind: 'grill', x: 680, y: 310 };
    return { screen: SCREEN_PLAY };
  }

  // cover: the busy kitchen at its best — orders waiting, a dish mid-assembly,
  // salad on the board, patties on the grill, the day clock running.
  run.timeLeft = 151;
  run.score = 480;
  run.coins = 86;
  run.combo = 2;
  ticket(board, 1, 'classic', 'Classic Burger', ['bun', 'patty', 'choppedLettuce'], 44, 55);
  ticket(board, 2, 'cheese', 'Cheese Melt', ['bun', 'patty', 'cheese', 'choppedTomato'], 30, 50);
  ticket(board, 3, 'garden', 'Garden Stack', ['bun', 'choppedLettuce', 'choppedTomato', 'cheese'], 18, 48);
  kitchen.plates[0].items = ['bun', 'patty'];
  kitchen.chop.item = 'lettuce';
  kitchen.chop.progress = 0.6;
  kitchen.grill[0].item = 'rawPatty';
  kitchen.grill[0].seconds = 5;
  kitchen.grill[1].item = 'rawPatty';
  kitchen.grill[1].seconds = 8;
  chef.x = 640;
  chef.y = 500;
  chef.carrying = ITEM.TOMATO;
  game.hint = 'WASD / click to move  •  E to use a station  •  hold SPACE to chop';
  game.highlight = { kind: 'grill', x: 680, y: 310 };
  return { screen: SCREEN_PLAY };
}
