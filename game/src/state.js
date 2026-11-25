// The menu and the run's score: what a dish is, what a day is worth, and how a
// good serve pays. Nothing here draws or listens; it is the game's shared facts.

// The playfield is a fixed 1280x800 logical area; the renderer scales it to fit.
export const FIELD = { width: 1280, height: 800 };

/** One full service: three minutes on the clock. */
export const DAY_SECONDS = 180;

/** Item ids the chef can carry or a plate can hold. */
export const ITEM = {
  BUN: 'bun',
  RAW_PATTY: 'rawPatty',
  PATTY: 'patty',
  BURNT_PATTY: 'burntPatty',
  LETTUCE: 'lettuce',
  CHOPPED_LETTUCE: 'choppedLettuce',
  TOMATO: 'tomato',
  CHOPPED_TOMATO: 'choppedTomato',
  CHEESE: 'cheese',
};

/** What each carried item is called on the plate and the ticket. */
export const ITEM_LABEL = {
  bun: 'Bun',
  rawPatty: 'Raw patty',
  patty: 'Patty',
  burntPatty: 'Burnt patty',
  lettuce: 'Lettuce',
  choppedLettuce: 'Lettuce',
  tomato: 'Tomato',
  choppedTomato: 'Tomato',
  cheese: 'Cheese',
};

/** Which raw ingredients the chopping board can turn into a plated one. */
export const CHOP_TO = { lettuce: 'choppedLettuce', tomato: 'choppedTomato' };

/**
 * The menu: four burgers that combine the same pantry in different ways, so the
 * route through the kitchen changes with the ticket. A recipe's items are the
 * plated forms (a cooked patty, chopped salad); order does not matter on the plate.
 */
export const RECIPES = [
  { id: 'classic', name: 'Classic Burger', items: ['bun', 'patty', 'choppedLettuce'], price: 12 },
  { id: 'cheese', name: 'Cheese Melt', items: ['bun', 'patty', 'cheese', 'choppedTomato'], price: 16 },
  { id: 'garden', name: 'Garden Stack', items: ['bun', 'choppedLettuce', 'choppedTomato', 'cheese'], price: 14 },
  { id: 'double', name: 'Double Trouble', items: ['bun', 'patty', 'patty', 'cheese'], price: 20 },
];

export function recipeById(id) {
  return RECIPES.find((recipe) => recipe.id === id) ?? RECIPES[0];
}

/** A fresh run: score, coins, combo, the day clock and the floating popups. */
export function createRun() {
  return {
    score: 0,
    coins: 0,
    combo: 0,
    served: 0,
    lost: 0,
    bestCombo: 0,
    timeLeft: DAY_SECONDS,
    elapsed: 0,
    popups: [],
    flash: 0,
  };
}

/** Coins and points for a serve: the dish price plus a patience bonus and the combo. */
export function serveReward(recipe, patienceLeft, patienceMax, combo) {
  const patienceBonus = Math.round((patienceLeft / patienceMax) * 8);
  const coins = recipe.price + patienceBonus;
  const points = 100 + coins * 5 + combo * 25;
  return { coins, points };
}

/** A floating "+120" that rises and fades over the bell. */
export function addPopup(run, x, y, text, color) {
  run.popups.push({ x, y, text, color, age: 0, life: 1.4 });
  if (run.popups.length > 8) run.popups.shift();
}

export function updatePopups(run, dt) {
  for (const popup of run.popups) popup.age += dt;
  run.popups = run.popups.filter((popup) => popup.age < popup.life);
}
