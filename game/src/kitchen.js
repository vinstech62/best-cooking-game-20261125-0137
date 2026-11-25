// The kitchen itself: where the stations stand, what each one holds, and how
// chopping and grilling advance. The chef moves between these stations; this file
// knows their places and their timers, not the chef.

import { CHOP_TO, ITEM } from './state.js';

/** Seconds a patty needs on the grill, and how long past done before it burns. */
export const GRILL_COOK_SECONDS = 7;
export const GRILL_BURN_SECONDS = 13;
/** Seconds of holding the board to chop one salad item. */
export const CHOP_SECONDS = 1.8;

/** The ingredient bins along the left counter, top to bottom. */
export const BINS = [
  { item: ITEM.BUN, label: 'Buns', x: 102, y: 208 },
  { item: ITEM.RAW_PATTY, label: 'Patties', x: 102, y: 308 },
  { item: ITEM.LETTUCE, label: 'Lettuce', x: 102, y: 408 },
  { item: ITEM.TOMATO, label: 'Tomatoes', x: 102, y: 508 },
  { item: ITEM.CHEESE, label: 'Cheese', x: 102, y: 608 },
];

export const STATIONS = {
  chop: { kind: 'chop', label: 'Chopping board', x: 380, y: 310, w: 170, h: 110 },
  grill: { kind: 'grill', label: 'Grill', x: 680, y: 310, w: 240, h: 110 },
  plates: { kind: 'plates', label: 'Plates', x: 990, y: 310, w: 170, h: 110 },
  bell: { kind: 'bell', label: 'Serve bell', x: 1180, y: 310, w: 90, h: 110 },
  trash: { kind: 'trash', label: 'Trash', x: 1180, y: 680, w: 90, h: 90 },
};

/** How close the chef must stand to use a station. */
export const REACH = 110;

function grillSlot(x) {
  return { x, item: null, seconds: 0 };
}

/** A fresh kitchen: an empty board, two cold grill slots and two clean plates. */
export function createKitchen() {
  return {
    chop: { item: null, progress: 0 },
    grill: [grillSlot(640), grillSlot(730)],
    plates: [{ items: [] }, { items: [] }],
    bellRing: 0,
  };
}

/** The grill slot at a point, or null when the point is not on the grill. */
export function grillSlotAt(kitchen, x, y) {
  const g = STATIONS.grill;
  if (x < g.x - g.w / 2 || x > g.x + g.w / 2 || y < g.y - g.h / 2 || y > g.y + g.h / 2) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const slot of kitchen.grill) {
    const distance = Math.abs(x - slot.x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  return best;
}

/** The plate a new item belongs on when the chef is near the station but not over it. */
export function activePlate(kitchen) {
  if (kitchen.plates[0].items.length > 0 && kitchen.plates[0].items.length < 4) return kitchen.plates[0];
  if (kitchen.plates[1].items.length > 0 && kitchen.plates[1].items.length < 4) return kitchen.plates[1];
  return kitchen.plates[0].items.length === 0 ? kitchen.plates[0] : kitchen.plates[1];
}

/** The plate at a point: the one already holding a dish in progress (so a burger
 * builds on one plate), else the first empty plate. A second plate only starts
 * once the first is full or served.
 */
export function plateAt(kitchen, x, y) {
  const p = STATIONS.plates;
  if (x < p.x - p.w / 2 || x > p.x + p.w / 2 || y < p.y - p.h / 2 || y > p.y + p.h / 2) return null;
  return activePlate(kitchen);
}

/** What a patty on the grill is right now: raw, cooked or burnt. */
export function grillState(slot) {
  if (slot.item === null) return 'empty';
  if (slot.seconds >= GRILL_BURN_SECONDS) return 'burnt';
  if (slot.seconds >= GRILL_COOK_SECONDS) return 'cooked';
  return 'cooking';
}

/** Advance the grill timers; returns true while any patty is cooking. */
export function stepKitchen(kitchen, dt) {
  let sizzling = false;
  for (const slot of kitchen.grill) {
    if (slot.item !== null) {
      slot.seconds += dt;
      sizzling = true;
    }
  }
  if (kitchen.bellRing > 0) kitchen.bellRing = Math.max(0, kitchen.bellRing - dt);
  return sizzling;
}

/** Lay a choppable item on the board; the board takes only one at a time. */
export function placeOnBoard(kitchen, item) {
  if (kitchen.chop.item !== null) return false;
  if (!(item in CHOP_TO)) return false;
  kitchen.chop.item = item;
  kitchen.chop.progress = 0;
  return true;
}

/** Hold the board: chop progress grows; at full, the item becomes its chopped form and waits to be picked up. */
export function chopStep(kitchen, dt) {
  if (kitchen.chop.item === null || kitchen.chop.progress >= 1) return false;
  kitchen.chop.progress += dt / CHOP_SECONDS;
  if (kitchen.chop.progress < 1) return false;
  kitchen.chop.item = CHOP_TO[kitchen.chop.item];
  return true;
}

/** Take whatever is on the board — raw while chopping, chopped when done — or null when empty. */
export function takeFromBoard(kitchen) {
  if (kitchen.chop.item === null) return null;
  const item = kitchen.chop.item;
  kitchen.chop.item = null;
  kitchen.chop.progress = 0;
  return item;
}

/** The board's finished item is handed back by chopStep; this reads what is on it. */
export function boardItem(kitchen) {
  return kitchen.chop.item;
}
