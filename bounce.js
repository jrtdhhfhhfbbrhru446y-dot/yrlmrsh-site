// Original compact platformer. The simulation is independent of the canvas and runs at 120 Hz.
const STEP = 1 / 120;
const RADIUS = 10;
const GRAVITY = 900;
const JUMP = 340;
const MAX_SPEED = 185;
const rect = (x, y, w, h) => ({ x, y, w, h });
const ring = (x, y) => ({ x, y });

export const BOUNCE_LEVELS = [
  {
    name: 'Первый отскок', width: 1640, height: 336, start: { x: 54, y: 277 },
    solids: [rect(0, 288, 590, 48), rect(660, 288, 980, 48), rect(310, 254, 108, 34), rect(944, 252, 100, 36), rect(1172, 220, 110, 68)],
    hazards: [rect(482, 274, 37, 14), rect(1090, 274, 38, 14), rect(1350, 274, 45, 14)],
    rings: [ring(165, 266), ring(363, 229), ring(626, 240), ring(835, 266), ring(992, 226), ring(1225, 194), ring(1466, 266)],
    checkpoint: { x: 810, y: 288 }, exit: { x: 1560, y: 244, w: 35, h: 44 },
  },
  {
    name: 'Выше крыши', width: 1800, height: 336, start: { x: 54, y: 277 },
    solids: [rect(0, 288, 460, 48), rect(525, 288, 530, 48), rect(1120, 288, 680, 48), rect(220, 252, 105, 36), rect(350, 218, 96, 70), rect(633, 252, 108, 36), rect(777, 218, 107, 70), rect(1284, 252, 95, 36), rect(1420, 218, 105, 70)],
    hazards: [rect(930, 274, 42, 14), rect(1170, 274, 39, 14), rect(1592, 274, 43, 14)],
    rings: [ring(142, 266), ring(272, 226), ring(395, 192), ring(490, 242), ring(685, 226), ring(830, 191), ring(1089, 241), ring(1331, 225), ring(1470, 192), ring(1695, 266)],
    checkpoint: { x: 910, y: 288 }, exit: { x: 1722, y: 244, w: 35, h: 44 },
  },
  {
    name: 'Длинная дорожка', width: 2010, height: 336, start: { x: 54, y: 277 },
    solids: [rect(0, 288, 378, 48), rect(448, 288, 453, 48), rect(970, 288, 488, 48), rect(1526, 288, 484, 48), rect(190, 252, 98, 36), rect(560, 252, 90, 36), rect(690, 218, 100, 70), rect(1120, 252, 100, 36), rect(1255, 218, 102, 70), rect(1660, 252, 100, 36)],
    hazards: [rect(319, 274, 32, 14), rect(824, 274, 38, 14), rect(1030, 274, 36, 14), rect(1400, 274, 35, 14), rect(1820, 274, 43, 14)],
    rings: [ring(128, 266), ring(239, 225), ring(413, 239), ring(605, 225), ring(740, 191), ring(936, 240), ring(1170, 226), ring(1304, 190), ring(1492, 240), ring(1710, 225), ring(1910, 266)],
    checkpoint: { x: 1000, y: 288 }, exit: { x: 1935, y: 244, w: 35, h: 44 },
  },
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function approach(value, target, amount) { return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount); }
function circleRect(x, y, radius, box) {
  const dx = x - clamp(x, box.x, box.x + box.w), dy = y - clamp(y, box.y, box.y + box.h);
  return dx * dx + dy * dy < radius * radius;
}

export function createBounceWorld(index = 0) {
  const level = BOUNCE_LEVELS[clamp(index, 0, BOUNCE_LEVELS.length - 1)];
  return { level, index, x: level.start.x, y: level.start.y, vx: 0, vy: 0, grounded: false, coyote: 0, jumpBuffer: 0,
    collected: new Set(), checkpoint: false, status: 'playing', camera: 0, rotation: 0, elapsed: 0, deaths: 0 };
}

export function respawnBounce(world) {
  const point = world.checkpoint ? { x: world.level.checkpoint.x, y: world.level.checkpoint.y - RADIUS - 1 } : world.level.start;
  Object.assign(world, { x: point.x, y: point.y, vx: 0, vy: 0, coyote: 0, jumpBuffer: 0, grounded: false, status: 'playing' });
}

export function stepBounce(world, input = {}, dt = STEP) {
  if (world.status !== 'playing') return;
  // Bound public simulation steps too; collision is resolved before any high-speed motion can tunnel.
  dt = clamp(dt, 0, STEP);
  world.elapsed += dt;
  world.coyote = Math.max(0, world.coyote - dt);
  world.jumpBuffer = input.jump ? 0.12 : Math.max(0, world.jumpBuffer - dt);
  const axis = Number(Boolean(input.right)) - Number(Boolean(input.left));
  world.vx = axis ? approach(world.vx, axis * MAX_SPEED, 1000 * dt) : approach(world.vx, 0, (world.grounded ? 1000 : 220) * dt);
  if (world.jumpBuffer > 0 && (world.grounded || world.coyote > 0)) {
    world.vy = -JUMP; world.grounded = false; world.coyote = 0; world.jumpBuffer = 0;
  }
  world.vy = Math.min(world.vy + GRAVITY * dt, 500);
  const previousX = world.x, previousY = world.y;
  world.x = clamp(world.x + world.vx * dt, RADIUS, world.level.width - RADIUS);
  for (const box of world.level.solids) {
    if (world.y + RADIUS <= box.y + 0.01 || world.y - RADIUS >= box.y + box.h - 0.01) continue;
    if (world.x + RADIUS > box.x && world.x - RADIUS < box.x + box.w) {
      if (previousX + RADIUS <= box.x + 0.1) world.x = box.x - RADIUS;
      else if (previousX - RADIUS >= box.x + box.w - 0.1) world.x = box.x + box.w + RADIUS;
      else continue;
      world.vx = 0;
    }
  }
  world.y += world.vy * dt;
  const wasGrounded = world.grounded;
  world.grounded = false;
  for (const box of world.level.solids) {
    if (world.x + RADIUS <= box.x + 0.01 || world.x - RADIUS >= box.x + box.w - 0.01) continue;
    if (world.y + RADIUS > box.y && world.y - RADIUS < box.y + box.h) {
      if (world.vy >= 0 && previousY + RADIUS <= box.y + 0.1) { world.y = box.y - RADIUS; world.vy = 0; world.grounded = true; world.coyote = 0.09; }
      else if (world.vy < 0 && previousY - RADIUS >= box.y + box.h - 0.1) { world.y = box.y + box.h + RADIUS; world.vy = 0; }
    }
  }
  if (wasGrounded && !world.grounded) world.coyote = 0.09;
  world.rotation += (world.x - previousX) / RADIUS;
  const fatal = world.y > world.level.height + 30 || world.level.hazards.some(box => circleRect(world.x, world.y, RADIUS - 3, box));
  if (fatal) { world.status = 'dead'; world.deaths++; return; }
  world.level.rings.forEach((item, index) => {
    if (Math.hypot(world.x - item.x, world.y - item.y) < 27) world.collected.add(index);
  });
  if (Math.abs(world.x - world.level.checkpoint.x) < 21 && Math.abs(world.y - (world.level.checkpoint.y - RADIUS)) < 28) world.checkpoint = true;
  if (world.collected.size === world.level.rings.length && circleRect(world.x, world.y, RADIUS + 2, world.level.exit)) world.status = 'won';
}

export function mountBounce(stage, container, observeActivity) {
  stage.innerHTML = `<section class="rg-bounce" aria-label="Bounce"><div class="rg-toolbar"><div class="rg-counters"><strong data-bounce-name></strong><span data-bounce-rings></span></div><div class="rg-actions"><button type="button" data-bounce-play>Начать</button><button type="button" data-bounce-reset>↻ Заново</button></div></div><div class="rg-bounce-field"><canvas width="720" height="336" tabindex="0" aria-label="Bounce. Стрелки влево и вправо — движение. Вверх — прыжок. Пробел — пауза."></canvas><div class="rg-bounce-message"><strong></strong><p></p><button type="button" data-bounce-continue></button></div></div><div class="rg-bounce-controls"><p>Собери кольца и доберись до двери.<br><span>← → — катиться · ↑ — прыгать · пробел — пауза</span></p><div class="rg-bounce-pad" aria-label="Управление шариком"><button type="button" data-bounce-hold="left" aria-label="Катиться влево">←</button><button type="button" data-bounce-hold="right" aria-label="Катиться вправо">→</button><button type="button" data-bounce-hold="jump" aria-label="Прыгнуть">↑</button></div></div><p class="rg-sr-only" data-bounce-live role="status" aria-live="polite"></p></section>`;
  const game = stage.querySelector('.rg-bounce'), canvas = game.querySelector('canvas'), ctx = canvas.getContext('2d');
  const play = game.querySelector('[data-bounce-play]'), message = game.querySelector('.rg-bounce-message');
  const continueButton = game.querySelector('[data-bounce-continue]'), ringLabel = game.querySelector('[data-bounce-rings]');
  const live = game.querySelector('[data-bounce-live]');
  let world = createBounceWorld(), phase = 'ready', raf = 0, lastTime = 0, accumulator = 0, allowed = true, disposed = false;
  let jumpQueued = false, lastRingCount = -1, lastCheckpoint = false;
  const held = new Set(), pointers = new Map(), keys = new Map();
  const clickIntents = new Map();
  game.dataset.pauseReason = ''; game.dataset.lastInputType = ''; game.dataset.lastInputEvent = 'mount';
  function noteInput(type, event) { game.dataset.lastInputType = type; game.dataset.lastInputEvent = event; }

  function label() {
    game.querySelector('[data-bounce-name]').textContent = world.level.name;
    ringLabel.textContent = `Кольца ${world.collected.size} / ${world.level.rings.length}`;
    play.textContent = phase === 'playing' ? 'Пауза' : phase === 'paused' ? 'Продолжить' : phase === 'ready' ? 'Начать' : 'Играть';
    play.disabled = phase === 'dead' || phase === 'won';
    game.dataset.phase = phase;
    game.dataset.level = String(world.index + 1);
  }
  function showOverlay(title, detail, action) {
    message.hidden = false; message.querySelector('strong').textContent = title; message.querySelector('p').textContent = detail;
    continueButton.textContent = action;
  }
  function clearInput({ intents = true } = {}) {
    const captured = [...pointers];
    held.clear(); pointers.clear(); keys.clear(); jumpQueued = false;
    for (const [id, { button }] of captured) { try { button.releasePointerCapture?.(id); } catch { /* Capture may already have ended. */ } }
    game.querySelectorAll('[data-bounce-hold]').forEach(button => button.classList.remove('is-held'));
    if (intents) clickIntents.clear();
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; lastTime = 0; accumulator = 0; clearInput(); }
  function draw() {
    if (!ctx) return;
    const { level } = world;
    ctx.fillStyle = '#eeeadd'; ctx.fillRect(0, 0, 720, 336);
    ctx.save(); ctx.translate(-Math.round(world.camera), 0);
    // A quiet horizon and original brick platforms, with no dense screen texture.
    ctx.strokeStyle = '#d2cdbf'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(level.width, 300); ctx.stroke();
    for (const box of level.solids) {
      if (box.x + box.w < world.camera || box.x > world.camera + 720) continue;
      ctx.fillStyle = '#545b5a'; ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = '#9aa59b'; ctx.fillRect(box.x, box.y, box.w, 5);
      ctx.strokeStyle = '#747d76'; ctx.lineWidth = 1;
      for (let yy = box.y + 20, row = 0; yy < box.y + box.h; yy += 20, row++) {
        ctx.beginPath(); ctx.moveTo(box.x, yy); ctx.lineTo(box.x + box.w, yy); ctx.stroke();
        for (let xx = box.x + (row % 2 ? 28 : 0); xx < box.x + box.w; xx += 56) { ctx.beginPath(); ctx.moveTo(xx, yy - 19); ctx.lineTo(xx, Math.min(yy, box.y + box.h)); ctx.stroke(); }
      }
    }
    for (const box of level.hazards) {
      ctx.fillStyle = '#7c3630'; ctx.strokeStyle = '#4b2724'; ctx.lineWidth = 1;
      const count = Math.max(2, Math.round(box.w / 11)), tooth = box.w / count;
      for (let i = 0; i < count; i++) { ctx.beginPath(); ctx.moveTo(box.x + i * tooth, box.y + box.h); ctx.lineTo(box.x + i * tooth + tooth / 2, box.y); ctx.lineTo(box.x + (i + 1) * tooth, box.y + box.h); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    level.rings.forEach((item, index) => {
      if (world.collected.has(index)) return;
      ctx.lineWidth = 5; ctx.strokeStyle = '#9b6119'; ctx.beginPath(); ctx.ellipse(item.x, item.y, 9, 15, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#ecd18a'; ctx.beginPath(); ctx.ellipse(item.x - 1, item.y - 1, 9, 15, 0, 0, Math.PI * 2); ctx.stroke();
    });
    const cp = level.checkpoint;
    ctx.fillStyle = '#384441'; ctx.fillRect(cp.x - 2, cp.y - 51, 3, 51);
    ctx.fillStyle = world.checkpoint ? '#496b57' : '#b4b9ab'; ctx.beginPath(); ctx.moveTo(cp.x + 1, cp.y - 51); ctx.lineTo(cp.x + 26, cp.y - 43); ctx.lineTo(cp.x + 1, cp.y - 32); ctx.closePath(); ctx.fill();
    const exit = level.exit, unlocked = world.collected.size === level.rings.length;
    ctx.fillStyle = '#333d3a'; ctx.fillRect(exit.x - 4, exit.y - 5, exit.w + 8, exit.h + 5);
    ctx.fillStyle = unlocked ? '#99ac8f' : '#bcb7a8'; ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = '#475441'; ctx.fillRect(exit.x + 25, exit.y + 22, 4, 4);
    if (!unlocked) { ctx.strokeStyle = '#6e6b60'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(exit.x + 7, exit.y + 10); ctx.lineTo(exit.x + exit.w - 7, exit.y + exit.h - 8); ctx.stroke(); }
    ctx.save(); ctx.translate(world.x, world.y); ctx.rotate(world.rotation);
    ctx.fillStyle = '#ae3830'; ctx.strokeStyle = '#572723'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ecc4a0'; ctx.beginPath(); ctx.arc(-3, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c75c4c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6, 0.25, 2.3); ctx.stroke();
    ctx.restore(); ctx.restore();
    // Discrete course progress stays readable on a small laptop screen.
    ctx.fillStyle = '#d8d4c8'; ctx.fillRect(18, 18, 86, 3);
    ctx.fillStyle = '#697368'; ctx.fillRect(18, 18, Math.max(2, 86 * world.x / level.width), 3);
  }
  function updateCamera(snap = false) {
    const target = clamp(world.x - 270, 0, world.level.width - 720);
    world.camera = snap ? target : approach(world.camera, target, Math.max(3, Math.abs(target - world.camera) * 0.1));
  }
  function finishPhase() {
    phase = world.status; stop(); label();
    if (phase === 'dead') showOverlay('Мяч лопнул.', world.checkpoint ? 'Кольца сохранены. Продолжим с флажка.' : 'Кольца сохранены. Попробуем ещё раз.', 'Продолжить');
    else if (world.index < BOUNCE_LEVELS.length - 1) showOverlay('Дверь открыта.', 'Все кольца на месте. Дальше — выше.', 'Следующий уровень →');
    else showOverlay('Хороший отскок.', 'Все три дорожки пройдены.', 'С самого начала');
    live.textContent = phase === 'dead' ? 'Мяч лопнул. Нажмите «Продолжить».' : world.index === 2 ? 'Победа. Все три уровня пройдены.' : 'Уровень пройден. Можно идти дальше.';
  }
  function frame(now) {
    raf = 0;
    if (disposed || phase !== 'playing' || !allowed || document.hidden) return;
    const elapsed = lastTime ? Math.min((now - lastTime) / 1000, 0.06) : STEP;
    lastTime = now; accumulator += elapsed;
    while (accumulator >= STEP && world.status === 'playing') {
      stepBounce(world, { left: held.has('left'), right: held.has('right'), jump: jumpQueued }); jumpQueued = false;
      accumulator -= STEP; updateCamera();
    }
    if (lastRingCount !== world.collected.size) { lastRingCount = world.collected.size; label(); }
    if (!lastCheckpoint && world.checkpoint) { lastCheckpoint = true; live.textContent = 'Чекпойнт. Можно продолжить с флажка.'; }
    draw();
    if (world.status !== 'playing') { finishPhase(); return; }
    raf = requestAnimationFrame(frame);
  }
  function start({ focus = true } = {}) {
    if (!allowed || disposed || document.hidden) return;
    phase = 'playing'; message.hidden = true; lastTime = 0; accumulator = 0; label();
    game.dataset.pauseReason = '';
    if (focus) canvas.focus({ preventScroll: true });
    if (canvas.closest('body.mobile-mode') &&
        globalThis.matchMedia?.('(orientation: landscape) and (max-height: 500px)').matches) {
      canvas.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function pause(reason) {
    if (phase !== 'playing') return;
    game.dataset.pauseReason = reason;
    phase = 'paused'; stop(); label(); showOverlay('Пауза.', 'Продолжим, когда будешь готов.', 'Продолжить');
  }
  function reset(index = world.index) {
    stop(); world = createBounceWorld(index); phase = 'ready'; lastRingCount = -1; lastCheckpoint = false;
    game.dataset.pauseReason = '';
    label(); updateCamera(true); draw(); showOverlay('Bounce', 'Кольца, прыжки и один красный шарик.', 'Поехали');
  }
  function advance(options) {
    if (!allowed) return;
    if (phase === 'won') { reset(world.index < 2 ? world.index + 1 : 0); start(options); }
    else if (phase === 'dead') { respawnBounce(world); updateCamera(true); start(options); }
    else start(options);
  }
  function toggle(reason = 'button', options) { if (phase === 'playing') pause(reason); else if (phase === 'paused' || phase === 'ready') start(options); }
  function activate(name, options) {
    if (!allowed || disposed || document.hidden || phase === 'dead' || phase === 'won') return false;
    if (phase === 'ready') start(options);
    if (phase !== 'playing') return false;
    if (name === 'jump') { if (!held.has('jump')) jumpQueued = true; }
    return true;
  }
  function click(event) {
    const button = event.target.closest('button');
    let inputType = 'keyboard';
    if (event.detail > 0 || event.pointerType) {
      const intent = event.pointerId === undefined
        ? [...clickIntents.values()].find(item => item.released && !item.hold && item.button === button)
        : clickIntents.get(event.pointerId);
      // A hold gesture can hide the start overlay or move focus. Its later
      // compatibility click must never turn into a Pause/Reset button action.
      if (!intent || !intent.released || intent.button !== button || intent.hold) return;
      clickIntents.delete(intent.id);
      inputType = intent.type;
    }
    noteInput(inputType, 'click');
    const options = { focus: inputType !== 'touch' && inputType !== 'pen' };
    if (event.target.closest('[data-bounce-play]')) toggle('button', options);
    else if (event.target.closest('[data-bounce-reset]')) reset();
    else if (event.target.closest('[data-bounce-continue]')) advance(options);
    // Assistive technologies activate buttons with click rather than pointerdown.
    else if (event.detail === 0 && event.target.closest('[data-bounce-hold="jump"]')) activate('jump', options);
  }
  const keyName = key => ({ ArrowLeft: 'left', a: 'left', A: 'left', ф: 'left', Ф: 'left', ArrowRight: 'right', d: 'right', D: 'right', в: 'right', В: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ц: 'jump', Ц: 'jump' })[key];
  const keyId = event => event.code || event.key.toLowerCase();
  function syncHeld(name) {
    const pointerHeld = [...pointers.values()].some(pointer => pointer.name === name);
    if (pointerHeld || [...keys.values()].includes(name)) held.add(name); else held.delete(name);
    game.querySelector(`[data-bounce-hold="${name}"]`)?.classList.toggle('is-held', pointerHeld);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    noteInput('keyboard', 'keydown');
    const name = keyName(event.key);
    if (name) {
      event.preventDefault(); event.stopPropagation();
      const id = keyId(event);
      if (!event.repeat && !keys.has(id) && activate(name)) { keys.set(id, name); syncHeld(name); }
    }
    else if (event.key.toLowerCase() === 'p' || event.key.toLowerCase() === 'з' || (event.key === ' ' && event.target.tagName !== 'BUTTON')) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) toggle('keyboard'); }
    else if (event.key === 'Enter' && event.target === canvas && (phase === 'dead' || phase === 'won')) { event.preventDefault(); event.stopPropagation(); advance(); }
  }
  function keyup(event) {
    const id = keyId(event), name = keys.get(id);
    if (name) { keys.delete(id); syncHeld(name); }
  }
  function pointerdown(event) {
    if (event.button > 0) return;
    const type = event.pointerType || 'mouse', targetButton = event.target.closest('button');
    noteInput(type, 'pointerdown');
    const intent = { id: event.pointerId, type, button: targetButton, hold: Boolean(targetButton?.dataset.bounceHold), released: false };
    clickIntents.set(event.pointerId, intent);
    if (clickIntents.size > 16) clickIntents.delete(clickIntents.keys().next().value);
    const button = event.target.closest('[data-bounce-hold]');
    if (!button || pointers.has(event.pointerId)) return;
    event.preventDefault(); const name = button.dataset.bounceHold;
    if (!activate(name, { focus: type !== 'touch' && type !== 'pen' })) return;
    pointers.set(event.pointerId, { name, button }); syncHeld(name);
    try { button.setPointerCapture?.(event.pointerId); } catch { /* Window pointer-up still releases this input. */ }
  }
  function pointerup(event) {
    game.dataset.lastInputEvent = event.type;
    const intent = clickIntents.get(event.pointerId);
    if (event.type === 'pointercancel') clickIntents.delete(event.pointerId);
    else if (event.type === 'pointerup' && intent) {
      // Touch can implicitly capture pointer-up. Hit-test the actual release
      // when coordinates are available rather than accepting an outside lift.
      const hit = Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
      if (!intent.hold && intent.button?.contains(hit)) intent.released = true;
      else clickIntents.delete(event.pointerId);
    }
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    pointers.delete(event.pointerId);
    syncHeld(pointer.name);
    try { pointer.button.releasePointerCapture?.(event.pointerId); } catch { /* Capture may already have ended. */ }
  }
  // DOM focus is independent of page visibility on touch browsers. Release
  // potentially stuck keys/pointers, but never interpret a control blur as Pause.
  function focusout(event) {
    game.dataset.lastInputEvent = 'focusout';
    if (!game.contains(event.relatedTarget)) {
      const names = new Set(keys.values()); keys.clear(); names.forEach(syncHeld);
    }
  }
  function blur() { game.dataset.lastInputEvent = 'window-blur'; clearInput({ intents: false }); }
  game.addEventListener('click', click); game.addEventListener('keydown', keydown); game.addEventListener('pointerdown', pointerdown);
  game.addEventListener('pointerup', pointerup); game.addEventListener('pointercancel', pointerup); game.addEventListener('lostpointercapture', pointerup);
  game.addEventListener('focusout', focusout); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
  window.addEventListener('pointerup', pointerup); window.addEventListener('pointercancel', pointerup);
  reset();
  const stopActivity = observeActivity(container, (value, reason) => {
    allowed = value;
    if (!value) pause(reason || (document.hidden ? 'hidden' : 'host-inactive'));
  });
  return () => {
    disposed = true; stop(); stopActivity();
    game.removeEventListener('click', click); game.removeEventListener('keydown', keydown); game.removeEventListener('pointerdown', pointerdown);
    game.removeEventListener('pointerup', pointerup); game.removeEventListener('pointercancel', pointerup); game.removeEventListener('lostpointercapture', pointerup);
    game.removeEventListener('focusout', focusout); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    window.removeEventListener('pointerup', pointerup); window.removeEventListener('pointercancel', pointerup);
  };
}
