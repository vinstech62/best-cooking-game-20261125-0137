// Drawing only: the kitchen's state and the current screen in, pixels out. The
// 1280x800 playfield is scaled to fit the window and centred. Every ingredient,
// the chef and the stations are drawn with canvas shapes — no image files.

import { FIELD } from './state.js';
import { BINS, GRILL_BURN_SECONDS, GRILL_COOK_SECONDS, STATIONS, grillState } from './kitchen.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const COLORS = {
  backdrop: '#1c130c',
  wall: '#3a2a1a',
  floor: '#8a5a34',
  floorDark: '#7d4f2d',
  tile: '#96683c',
  hud: '#241608',
  panel: '#f7ead2',
  panelDark: '#e8d3ac',
  ink: '#2b1a0c',
  muted: '#8a6f4d',
  ticket: '#fff8e6',
  ticketEdge: '#d9b96a',
  red: '#d33f2e',
  green: '#4caf50',
  amber: '#f2a007',
  gold: '#f2c94c',
  steel: '#b9c0c7',
  grill: '#3c3c40',
};

const ITEM_COLORS = {
  bun: '#e8a94e',
  rawPatty: '#c96a7a',
  patty: '#6b3f1d',
  burntPatty: '#241a12',
  lettuce: '#69b34c',
  choppedLettuce: '#7cc45e',
  tomato: '#e8483f',
  choppedTomato: '#e8483f',
  cheese: '#ffc93c',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** One ingredient, drawn at (x, y) with radius r. */
export function drawItem(ctx, item, x, y, r) {
  ctx.save();
  if (item === 'bun') {
    ctx.fillStyle = ITEM_COLORS.bun;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.15, r, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - r, y + r * 0.15, r * 2, r * 0.35);
    ctx.fillStyle = '#fff3d6';
    ctx.fillRect(x - r * 0.7, y + r * 0.28, r * 1.4, r * 0.12);
  } else if (item === 'patty' || item === 'rawPatty' || item === 'burntPatty') {
    ctx.fillStyle = ITEM_COLORS[item];
    roundRect(ctx, x - r, y - r * 0.55, r * 2, r * 1.1, r * 0.5);
    ctx.fill();
    if (item === 'rawPatty') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      circle(ctx, x - r * 0.4, y - r * 0.2, r * 0.18);
      circle(ctx, x + r * 0.3, y + r * 0.2, r * 0.14);
    }
  } else if (item === 'lettuce' || item === 'choppedLettuce') {
    ctx.fillStyle = ITEM_COLORS[item];
    for (let i = 0; i < 3; i += 1) {
      circle(ctx, x - r * 0.55 + i * r * 0.55, y + (i % 2 === 0 ? -r * 0.2 : r * 0.25), r * 0.55);
    }
  } else if (item === 'tomato' || item === 'choppedTomato') {
    ctx.fillStyle = ITEM_COLORS[item];
    circle(ctx, x, y, r * 0.9);
    ctx.fillStyle = '#69b34c';
    circle(ctx, x, y - r * 0.7, r * 0.3);
  } else if (item === 'cheese') {
    ctx.fillStyle = ITEM_COLORS.cheese;
    ctx.beginPath();
    ctx.moveTo(x - r, y + r * 0.6);
    ctx.lineTo(x + r, y + r * 0.6);
    ctx.lineTo(x, y - r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8a812';
    circle(ctx, x - r * 0.3, y + r * 0.1, r * 0.14);
    circle(ctx, x + r * 0.35, y + r * 0.3, r * 0.12);
  }
  ctx.restore();
}

/** A plated dish: its items stacked like a burger, bottom to top. */
function drawPlateDish(ctx, items, x, y, scale) {
  const r = 26 * scale;
  ctx.fillStyle = '#ffffff';
  circle(ctx, x, y, r + 8 * scale);
  ctx.fillStyle = '#d9d9d9';
  ctx.beginPath();
  ctx.arc(x, y, r + 8 * scale, 0, Math.PI);
  ctx.fill();
  let stackY = y + r * 0.55;
  const step = items.length > 1 ? (r * 1.1) / (items.length - 1) : 0;
  for (const item of items) {
    drawItem(ctx, item, x, stackY, r * 0.62);
    stackY -= step;
  }
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight ?? ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function formatClock(seconds) {
    const left = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }

  function drawFloor() {
    context.fillStyle = COLORS.wall;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = COLORS.floor;
    context.fillRect(0, 160, FIELD.width, FIELD.height - 160);
    context.fillStyle = COLORS.floorDark;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        if ((row + col) % 2 === 0) context.fillRect(col * 80, 160 + row * 80, 80, 80);
      }
    }
    context.fillStyle = COLORS.tile;
    context.fillRect(0, 156, FIELD.width, 6);
  }

  function drawHud(run, orders) {
    context.fillStyle = COLORS.hud;
    context.fillRect(0, 0, FIELD.width, 64);
    text('SIZZLE & SERVE', 24, 42, 30, COLORS.gold, 'left', 'bold');
    text(`Score ${run.score}`, 330, 42, 24, '#fff8e6', 'left', 'bold');
    text(`Coins ${run.coins}`, 500, 42, 24, COLORS.gold, 'left', 'bold');
    if (run.combo >= 2) text(`Combo x${run.combo}`, 650, 42, 24, '#ff8a5c', 'left', 'bold');
    const urgent = run.timeLeft <= 30;
    text(`Day ${formatClock(run.timeLeft)}`, 1000, 42, 30, urgent ? COLORS.red : '#fff8e6', 'center', 'bold');
    text(`Orders ${orders.length}`, 1180, 42, 20, '#cbb98a', 'right');
    if (urgent) {
      context.fillStyle = COLORS.red;
      roundRect(context, 920, 14, 160, 36, 8);
      context.fill();
      text('CLOSING!', 1000, 39, 18, '#ffffff', 'center', 'bold');
    }
  }

  function drawTickets(board) {
    context.fillStyle = '#5a3d22';
    roundRect(context, 16, 70, FIELD.width - 32, 82, 10);
    context.fill();
    text('ORDER BOARD', 30, 100, 15, '#d9b96a', 'left', 'bold');
    if (board.orders.length === 0) {
      text('No orders yet — the lunch rush is coming…', 200, 128, 20, '#f7ead2', 'left');
      return;
    }
    board.orders.forEach((order, index) => {
      const x = 200 + index * 240;
      const y = 76;
      const w = 224;
      const h = 70;
      const fraction = Math.max(0, order.patience / order.maxPatience);
      const critical = fraction < 0.25;
      context.fillStyle = COLORS.ticket;
      roundRect(context, x, y, w, h, 8);
      context.fill();
      context.strokeStyle = critical ? COLORS.red : COLORS.ticketEdge;
      context.lineWidth = critical ? 3 : 2;
      roundRect(context, x, y, w, h, 8);
      context.stroke();
      text(`#${order.id} ${order.name}`, x + 10, y + 22, 15, COLORS.ink, 'left', 'bold');
      let ix = x + 12;
      for (const item of order.items) {
        drawItem(context, item, ix + 10, y + 42, 9);
        ix += 26;
      }
      context.fillStyle = '#e0d3b3';
      context.fillRect(x + 10, y + 58, w - 20, 6);
      context.fillStyle = critical ? COLORS.red : fraction < 0.5 ? COLORS.amber : COLORS.green;
      context.fillRect(x + 10, y + 58, (w - 20) * fraction, 6);
      if (critical) text('HURRY!', x + w - 10, y + 22, 14, COLORS.red, 'right', 'bold');
    });
  }

  function drawBins(highlight) {
    context.fillStyle = '#5a3d22';
    roundRect(context, 24, 180, 156, 520, 10);
    context.fill();
    text('PANTRY', 102, 204, 15, '#d9b96a', 'center', 'bold');
    for (const bin of BINS) {
      const isHot = highlight !== null && highlight.kind === 'bin' && highlight.item === bin.item;
      context.fillStyle = isHot ? '#ffe9a8' : COLORS.panel;
      roundRect(context, bin.x - 68, bin.y - 42, 136, 84, 8);
      context.fill();
      context.strokeStyle = isHot ? COLORS.gold : '#c9a86a';
      context.lineWidth = isHot ? 3 : 1.5;
      roundRect(context, bin.x - 68, bin.y - 42, 136, 84, 8);
      context.stroke();
      drawItem(context, bin.item, bin.x, bin.y - 8, 20);
      text(bin.label, bin.x, bin.y + 32, 14, COLORS.ink, 'center', 'bold');
    }
  }

  function drawChopBoard(kitchen, highlight) {
    const s = STATIONS.chop;
    const isHot = highlight !== null && highlight.kind === 'chop';
    context.fillStyle = isHot ? '#ffe9a8' : '#c98f4e';
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.fill();
    context.strokeStyle = '#8a5a24';
    context.lineWidth = 2;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.stroke();
    text('CHOP', s.x, s.y - s.h / 2 + 20, 14, '#5a3a14', 'center', 'bold');
    if (kitchen.chop.item !== null) {
      drawItem(context, kitchen.chop.item, s.x, s.y + 8, 26);
      if (kitchen.chop.progress > 0 && kitchen.chop.progress < 1) {
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(s.x - 60, s.y + 30, 120, 8);
        context.fillStyle = COLORS.green;
        context.fillRect(s.x - 60, s.y + 30, 120 * kitchen.chop.progress, 8);
        text('Hold SPACE to chop', s.x, s.y + 52, 12, '#5a3a14', 'center');
      } else if (kitchen.chop.progress >= 1) {
        text('Chopped! Grab it (E)', s.x, s.y + 52, 12, '#2e6b1e', 'center', 'bold');
      }
    } else {
      text('Bring lettuce / tomato', s.x, s.y + 30, 13, '#5a3a14', 'center');
    }
  }

  function drawGrill(kitchen, highlight, time) {
    const s = STATIONS.grill;
    const isHot = highlight !== null && highlight.kind === 'grill';
    context.fillStyle = COLORS.grill;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.fill();
    context.strokeStyle = isHot ? COLORS.gold : '#222226';
    context.lineWidth = isHot ? 3 : 2;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.stroke();
    text('GRILL', s.x, s.y - s.h / 2 + 20, 14, '#cfcfd4', 'center', 'bold');
    for (const slot of kitchen.grill) {
      context.fillStyle = '#2a2a2e';
      roundRect(context, slot.x - 48, s.y - 18, 96, 56, 8);
      context.fill();
      context.strokeStyle = '#55555c';
      context.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) {
        context.beginPath();
        context.moveTo(slot.x - 44, s.y - 6 + i * 14);
        context.lineTo(slot.x + 44, s.y - 6 + i * 14);
        context.stroke();
      }
      if (slot.item !== null) {
        const state = grillState(slot);
        const shown = state === 'burnt' ? 'burntPatty' : state === 'cooked' ? 'patty' : 'rawPatty';
        drawItem(context, shown, slot.x, s.y + 10, 22);
        const fraction = Math.min(1, slot.seconds / GRILL_COOK_SECONDS);
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(slot.x - 40, s.y + 34, 80, 6);
        context.fillStyle = state === 'burnt' ? COLORS.red : state === 'cooked' ? COLORS.green : COLORS.amber;
        context.fillRect(slot.x - 40, s.y + 34, 80 * fraction, 6);
        if (state === 'burnt') {
          context.fillStyle = 'rgba(120,120,120,0.55)';
          for (let i = 0; i < 3; i += 1) {
            const sway = Math.sin(time * 2 + i * 2) * 6;
            circle(context, slot.x - 16 + i * 16 + sway, s.y - 30 - ((time * 12 + i * 18) % 24), 7);
          }
          text('BURNT!', slot.x, s.y - s.h / 2 - 8, 13, COLORS.red, 'center', 'bold');
        } else if (state === 'cooked') {
          text('READY', slot.x, s.y - s.h / 2 - 8, 13, COLORS.green, 'center', 'bold');
        }
      }
    }
  }

  function drawPlates(kitchen, highlight) {
    const s = STATIONS.plates;
    const isHot = highlight !== null && highlight.kind === 'plates';
    context.fillStyle = isHot ? '#ffe9a8' : COLORS.panel;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.fill();
    context.strokeStyle = isHot ? COLORS.gold : '#c9a86a';
    context.lineWidth = isHot ? 3 : 1.5;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.stroke();
    text('PLATES', s.x, s.y - s.h / 2 + 20, 14, '#5a3a14', 'center', 'bold');
    kitchen.plates.forEach((plate, index) => {
      const x = s.x - 42 + index * 84;
      if (plate.items.length === 0) {
        context.fillStyle = '#ffffff';
        circle(context, x, s.y + 12, 30);
        context.strokeStyle = '#c9c9c9';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, s.y + 12, 30, 0, Math.PI * 2);
        context.stroke();
      } else {
        drawPlateDish(context, plate.items, x, s.y + 12, 0.85);
      }
    });
  }

  function drawBell(kitchen, highlight, time) {
    const s = STATIONS.bell;
    const isHot = highlight !== null && highlight.kind === 'bell';
    const ringing = kitchen.bellRing > 0 ? Math.sin(time * 30) * 4 : 0;
    context.fillStyle = isHot ? '#ffe9a8' : COLORS.panel;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.fill();
    context.strokeStyle = isHot ? COLORS.gold : '#c9a86a';
    context.lineWidth = isHot ? 3 : 1.5;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.stroke();
    context.fillStyle = COLORS.gold;
    context.beginPath();
    context.arc(s.x + ringing, s.y + 2, 26, Math.PI, 0);
    context.fill();
    context.fillRect(s.x - 26 + ringing, s.y + 2, 52, 6);
    circle(context, s.x + ringing, s.y + 14, 6);
    text('SERVE', s.x, s.y + 48, 14, COLORS.ink, 'center', 'bold');
  }

  function drawTrash(highlight) {
    const s = STATIONS.trash;
    const isHot = highlight !== null && highlight.kind === 'trash';
    context.fillStyle = isHot ? '#ffe9a8' : COLORS.panel;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.fill();
    context.strokeStyle = isHot ? COLORS.gold : '#c9a86a';
    context.lineWidth = isHot ? 3 : 1.5;
    roundRect(context, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 10);
    context.stroke();
    context.fillStyle = '#7a8288';
    roundRect(context, s.x - 22, s.y - 22, 44, 44, 6);
    context.fill();
    context.fillStyle = '#5a6165';
    context.fillRect(s.x - 26, s.y - 28, 52, 8);
    text('TRASH (T)', s.x, s.y + 40, 12, COLORS.ink, 'center', 'bold');
  }

  function drawChef(chef) {
    const bob = chef.moving ? Math.sin(chef.walkPhase) * 2 : 0;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    circle(context, chef.x, chef.y + 26, 22);
    context.fillStyle = '#e8b48c';
    circle(context, chef.x, chef.y + bob, 22);
    context.fillStyle = '#f5f0e6';
    roundRect(context, chef.x - 20, chef.y - 20 + bob, 40, 22, 6);
    context.fill();
    context.fillStyle = '#ffffff';
    circle(context, chef.x - 7, chef.y - 4 + bob, 3);
    circle(context, chef.x + 7, chef.y - 4 + bob, 3);
    context.fillStyle = '#ffffff';
    roundRect(context, chef.x - 18, chef.y - 34 + bob, 36, 16, 8);
    context.fill();
    context.fillStyle = '#f5f0e6';
    circle(context, chef.x - 10, chef.y - 34 + bob, 8);
    circle(context, chef.x + 10, chef.y - 34 + bob, 8);
    if (chef.carrying !== null) {
      context.fillStyle = 'rgba(255,255,255,0.9)';
      circle(context, chef.x, chef.y - 52 + bob, 20);
      context.strokeStyle = '#c9a86a';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(chef.x, chef.y - 52 + bob, 20, 0, Math.PI * 2);
      context.stroke();
      drawItem(context, chef.carrying, chef.x, chef.y - 52 + bob, 14);
    }
  }

  function drawPopups(run) {
    for (const popup of run.popups) {
      const alpha = 1 - popup.age / popup.life;
      context.globalAlpha = alpha;
      text(popup.text, popup.x, popup.y - popup.age * 40, 26, popup.color, 'center', 'bold');
      context.globalAlpha = 1;
    }
  }

  function drawHint(hint) {
    if (hint === null) return;
    context.fillStyle = 'rgba(28,19,12,0.85)';
    roundRect(context, 320, 748, 640, 36, 8);
    context.fill();
    text(hint, 640, 772, 18, '#ffe9a8', 'center');
  }

  function drawPanel(title, lines, prompt) {
    context.fillStyle = 'rgba(20,12,6,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const width = 640;
    const height = 150 + lines.length * 36 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = COLORS.panel;
    roundRect(context, x, y, width, height, 14);
    context.fill();
    context.strokeStyle = COLORS.gold;
    context.lineWidth = 3;
    roundRect(context, x, y, width, height, 14);
    context.stroke();
    text(title, FIELD.width / 2, y + 66, 44, COLORS.ink, 'center', 'bold');
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, y + 116 + index * 36, 20, '#5a4630', 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 28, 22, '#a35c00', 'center', 'bold');
  }

  function drawTitle(best) {
    text('SIZZLE & SERVE', FIELD.width / 2, 300, 64, COLORS.gold, 'center', 'bold');
    text('Run the busiest street-food stall in town.', FIELD.width / 2, 344, 24, '#f7ead2', 'center');
    text('Grab ingredients, chop the salad, grill the patties,', FIELD.width / 2, 420, 20, '#e8d3ac', 'center');
    text('build each burger to its ticket and ring the bell to serve.', FIELD.width / 2, 448, 20, '#e8d3ac', 'center');
    text('Move: WASD / arrows or click  •  Use: E or click  •  Chop: hold SPACE', FIELD.width / 2, 500, 20, '#fff8e6', 'center', 'bold');
    text('Trash: T  •  Pause: P  •  Mute: M  •  Restart: R', FIELD.width / 2, 530, 18, '#cbb98a', 'center');
    if (best > 0) text(`Best score: ${best}`, FIELD.width / 2, 580, 20, COLORS.gold, 'center', 'bold');
    text('Press SPACE or click to open the stall', FIELD.width / 2, 640, 24, '#ff8a5c', 'center', 'bold');
  }

  /** Paint one frame: the kitchen, then the HUD or a panel for the screen. */
  function draw(game, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = COLORS.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawTickets(game.board);
    drawBins(game.highlight);
    drawChopBoard(game.kitchen, game.highlight);
    drawGrill(game.kitchen, game.highlight, game.time);
    drawPlates(game.kitchen, game.highlight);
    drawBell(game.kitchen, game.highlight, game.time);
    drawTrash(game.highlight);
    drawChef(game.chef);
    drawHud(game.run, game.board.orders);
    drawPopups(game.run);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(20,12,6,0.66)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawTitle(best);
      return;
    }
    drawHint(game.hint);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The grill is off and the tickets wait.'], 'Press P to get back to the stove');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Day over!', [
        `Score ${game.run.score}  •  Coins ${game.run.coins}`,
        `Served ${game.run.served} dishes  •  Lost ${game.run.lost} customers`,
        `Best combo x${game.run.bestCombo}`,
        '',
        'The stall closes — but tomorrow is another rush.',
      ], 'Press R or click to open again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, drawItem };
}
