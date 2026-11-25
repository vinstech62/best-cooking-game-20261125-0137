// The chef: one pair of hands, walking the kitchen. Movement is WASD/arrows or
// click-to-move; E (or a click on a station) uses whatever station is in reach.
// The chef carries one item at a time.

import { BINS, REACH, STATIONS, activePlate, grillSlotAt, grillState, placeOnBoard, plateAt, takeFromBoard } from './kitchen.js';
import { ITEM } from './state.js';

export const CHEF_SPEED = 280;
/** The floor the chef may walk: clear of the counter bins and the HUD. */
const FLOOR = { left: 196, right: 1256, top: 176, bottom: 776 };

export function createChef() {
  return { x: 640, y: 620, carrying: null, target: null, pendingStation: null, moving: false, walkPhase: 0 };
}

function clampChef(chef) {
  chef.x = Math.min(FLOOR.right, Math.max(FLOOR.left, chef.x));
  chef.y = Math.min(FLOOR.bottom, Math.max(FLOOR.top, chef.y));
}

function stationCentre(station) {
  return { x: station.x, y: station.y };
}

/** The nearest station (or bin) in reach of the chef, with its distance. */
export function nearestStation(chef) {
  let best = null;
  let bestDistance = Infinity;
  const consider = (station, distance) => {
    if (distance < bestDistance) {
      bestDistance = distance;
      best = station;
    }
  };
  for (const bin of BINS) {
    consider({ kind: 'bin', item: bin.item, label: bin.label, x: bin.x, y: bin.y }, Math.hypot(chef.x - bin.x, chef.y - bin.y));
  }
  for (const station of Object.values(STATIONS)) {
    const centre = stationCentre(station);
    consider({ ...station, x: centre.x, y: centre.y }, Math.hypot(chef.x - centre.x, chef.y - centre.y));
  }
  return bestDistance <= REACH ? best : null;
}

/** Walk toward the click target; keyboard input cancels it. Returns true while walking. */
export function walkChef(chef, dt, keys) {
  const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  chef.moving = false;
  if (kx !== 0 || ky !== 0) {
    chef.target = null;
    chef.pendingStation = null;
    const length = Math.hypot(kx, ky);
    chef.x += (kx / length) * CHEF_SPEED * dt;
    chef.y += (ky / length) * CHEF_SPEED * dt;
    chef.moving = true;
  } else if (chef.target !== null) {
    const dx = chef.target.x - chef.x;
    const dy = chef.target.y - chef.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10) {
      chef.target = null;
    } else {
      const step = Math.min(distance, CHEF_SPEED * dt);
      chef.x += (dx / distance) * step;
      chef.y += (dy / distance) * step;
      chef.moving = true;
    }
  }
  if (chef.moving) chef.walkPhase += dt * 10;
  clampChef(chef);
}

/**
 * Use the station in reach. Returns an action string the game reacts to:
 * 'pickup', 'place', 'chop-place', 'grill-place', 'grill-take', 'plate-add',
 * 'plate-take', 'trash', 'bell', 'board-take' or null when nothing applies.
 */
export function useStation(chef, kitchen, station) {
  if (station === null) return null;
  if (station.kind === 'bin') {
    if (chef.carrying !== null) return null;
    chef.carrying = station.item;
    return 'pickup';
  }
  if (station.kind === 'chop') {
    if (chef.carrying !== null && placeOnBoard(kitchen, chef.carrying)) {
      chef.carrying = null;
      return 'chop-place';
    }
    if (chef.carrying === null) {
      const taken = takeFromBoard(kitchen);
      if (taken !== null) {
        chef.carrying = taken;
        return 'board-take';
      }
    }
    return null;
  }
  if (station.kind === 'grill') {
    const slot = grillSlotAt(kitchen, chef.x, chef.y) ?? kitchen.grill[0];
    if (chef.carrying === ITEM.RAW_PATTY && slot.item === null) {
      slot.item = ITEM.RAW_PATTY;
      slot.seconds = 0;
      chef.carrying = null;
      return 'grill-place';
    }
    if (chef.carrying === null && slot.item !== null) {
      const state = grillState(slot);
      if (state === 'cooked') {
        chef.carrying = ITEM.PATTY;
        slot.item = null;
        slot.seconds = 0;
        return 'grill-take';
      }
      if (state === 'burnt') {
        chef.carrying = ITEM.BURNT_PATTY;
        slot.item = null;
        slot.seconds = 0;
        return 'grill-take';
      }
    }
    return null;
  }
  if (station.kind === 'plates') {
    if (chef.carrying !== null) {
      const plate = plateAt(kitchen, chef.x, chef.y) ?? activePlate(kitchen);
      if (plate.items.length >= 4) return null;
      plate.items.push(chef.carrying);
      chef.carrying = null;
      return 'plate-add';
    }
    const plate = kitchen.plates[0].items.length >= kitchen.plates[1].items.length ? kitchen.plates[0] : kitchen.plates[1];
    if (plate.items.length === 0) return null;
    chef.carrying = plate.items.pop();
    return 'plate-take';
  }
  if (station.kind === 'trash') {
    if (chef.carrying !== null) {
      chef.carrying = null;
      return 'trash';
    }
    const plate = kitchen.plates[0].items.length >= kitchen.plates[1].items.length ? kitchen.plates[0] : kitchen.plates[1];
    if (plate.items.length === 0) return null;
    plate.items.length = 0;
    return 'trash';
  }
  if (station.kind === 'bell') return 'bell';
  return null;
}

/** Throw away whatever the chef is carrying. */
export function trashCarried(chef) {
  if (chef.carrying === null) return false;
  chef.carrying = null;
  return true;
}

/** Point the chef at a click: walk there, and use the station under it on arrival. */
export function clickTo(chef, x, y) {
  chef.target = { x: Math.min(FLOOR.right, Math.max(FLOOR.left, x)), y: Math.min(FLOOR.bottom, Math.max(FLOOR.top, y)) };
  chef.pendingStation = null;
  for (const bin of BINS) {
    if (Math.abs(x - bin.x) < 80 && Math.abs(y - bin.y) < 55) chef.pendingStation = { kind: 'bin', item: bin.item, label: bin.label, x: bin.x, y: bin.y };
  }
  for (const station of Object.values(STATIONS)) {
    if (Math.abs(x - station.x) < station.w / 2 + 20 && Math.abs(y - station.y) < station.h / 2 + 20) {
      chef.pendingStation = { ...station };
    }
  }
}
