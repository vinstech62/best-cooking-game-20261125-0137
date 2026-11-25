// The order board: tickets arrive, wait with a shrinking patience bar, and are
// served or lost. Difficulty ramps with the day: tickets come faster, patience
// gets shorter, and more of them wait at once.

import { RECIPES } from './state.js';

/** First ticket this many seconds into the day. */
const FIRST_ORDER_AT = 2;
/** How often a new ticket arrives, early and late in the day. */
const SPAWN_EARLY = 15;
const SPAWN_LATE = 8;
/** How long a ticket waits before the customer walks away, early and late. */
const PATIENCE_EARLY = 55;
const PATIENCE_LATE = 36;
/** How many tickets may wait at once, early and late. */
const MAX_ORDERS_EARLY = 3;
const MAX_ORDERS_LATE = 4;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createOrderBoard() {
  return { orders: [], nextId: 1, spawnTimer: FIRST_ORDER_AT };
}

/** Pick a recipe: the double burger only shows up once the day is warming up. */
function pickRecipe(elapsed, random) {
  const pool = elapsed < 40 ? RECIPES.slice(0, 3) : RECIPES;
  return pool[Math.floor(random() * pool.length)];
}

function spawnOrder(board, elapsed, random) {
  const ramp = Math.min(1, elapsed / 120);
  const recipe = pickRecipe(elapsed, random);
  const patience = lerp(PATIENCE_EARLY, PATIENCE_LATE, ramp);
  board.orders.push({
    id: board.nextId,
    recipeId: recipe.id,
    name: recipe.name,
    items: [...recipe.items],
    patience,
    maxPatience: patience,
    born: elapsed,
  });
  board.nextId += 1;
}

function maxOrders(elapsed) {
  return Math.min(1, elapsed / 90) < 1 ? MAX_ORDERS_EARLY : MAX_ORDERS_LATE;
}

/**
 * One step: spawn tickets on schedule and drain patience. Returns the ids of
 * tickets whose customers just walked away.
 */
export function stepOrders(board, dt, elapsed, random) {
  const expired = [];
  board.spawnTimer -= dt;
  if (board.spawnTimer <= 0) {
    if (board.orders.length < maxOrders(elapsed)) spawnOrder(board, elapsed, random);
    const ramp = Math.min(1, elapsed / 120);
    board.spawnTimer = lerp(SPAWN_EARLY, SPAWN_LATE, ramp);
  }
  for (const order of board.orders) order.patience -= dt;
  board.orders = board.orders.filter((order) => {
    if (order.patience > 0) return true;
    expired.push(order.id);
    return false;
  });
  return expired;
}

/** Does a plate's items match a ticket exactly, item for item? */
export function plateMatchesOrder(plateItems, order) {
  if (plateItems.length !== order.items.length) return false;
  const wanted = [...order.items].sort();
  const have = [...plateItems].sort();
  return wanted.every((item, index) => item === have[index]);
}

/** The first waiting ticket a plate can serve, or null. */
export function findMatchingOrder(board, plateItems) {
  return board.orders.find((order) => plateMatchesOrder(plateItems, order)) ?? null;
}

export function removeOrder(board, id) {
  board.orders = board.orders.filter((order) => order.id !== id);
}
