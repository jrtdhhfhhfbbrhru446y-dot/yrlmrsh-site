import { mountBounce } from './bounce.js?v=studio-70-final';

const DIRECTIONS = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
const ARROW_DIRECTIONS = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };

/** Mount the self-contained games desk. Always call the returned cleanup on navigation. */
export function mountGames(container) {
  const desk = document.createElement('section');
  desk.className = 'retro-games';
  desk.setAttribute('aria-label', 'Игровая');
  desk.innerHTML = `<nav class="rg-tabs" aria-label="Выбрать игру"><button type="button" data-rg-game="snake" aria-pressed="true">Змейка</button><button type="button" data-rg-game="mines" aria-pressed="false">Сапёр</button><button type="button" data-rg-game="bounce" aria-pressed="false">Bounce</button></nav><div class="rg-stage"></div>`;
  container.replaceChildren(desk);
  const stage = desk.querySelector('.rg-stage');
  let active = 'snake';
  let cleanup = mountSnake(stage, container);
  function selectGame(event) {
    const button = event.target.closest('[data-rg-game]');
    if (!button || button.dataset.rgGame === active) return;
    cleanup();
    active = button.dataset.rgGame;
    desk.querySelectorAll('[data-rg-game]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    cleanup = active === 'mines' ? mountMines(stage, container) : active === 'bounce' ? mountBounce(stage, container, observeGameActivity) : mountSnake(stage, container);
  }
  desk.addEventListener('click', selectGame);
  return () => {
    cleanup();
    desk.removeEventListener('click', selectGame);
    desk.remove();
  };
}

function observeGameActivity(container, onChange) {
  let hostActive = true, pageHidden = false;
  const update = () => {
    const reason = document.hidden ? 'hidden' : pageHidden ? 'pagehide' : !hostActive ? 'host-inactive' : 'active';
    onChange(reason === 'active', reason);
  };
  function activity(event) {
    if (!event.target?.contains?.(container)) return;
    hostActive = event.detail?.active !== false;
    update();
  }
  document.addEventListener('retro-activity', activity);
  document.addEventListener('visibilitychange', update);
  const pagehide = () => { pageHidden = true; update(); };
  const pageshow = () => { pageHidden = false; update(); };
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', pageshow);
  update();
  return () => {
    document.removeEventListener('retro-activity', activity);
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', pageshow);
  };
}

function readRecord() {
  try {
    const value = Number(localStorage.getItem('archive26.snake.record'));
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
  catch { return 0; }
}
function saveRecord(value) {
  try { localStorage.setItem('archive26.snake.record', String(value)); } catch { /* Storage can be disabled. */ }
}
function freeFood(snake, width, height, random = Math.random) {
  const occupied = new Set(snake.map(part => part.y * width + part.x));
  const available = [];
  for (let i = 0; i < width * height; i++) if (!occupied.has(i)) available.push(i);
  if (!available.length) return null;
  const chosen = available[Math.floor(random() * available.length)];
  return { x: chosen % width, y: Math.floor(chosen / width) };
}
function queueDirection(queue, current, next) {
  const last = queue[queue.length - 1] || current;
  if (queue.length >= 2 || (next.x === last.x && next.y === last.y) || (next.x === -last.x && next.y === -last.y)) return;
  queue.push(next);
}

function mountSnake(stage, container) {
  stage.innerHTML = `<section class="rg-snake" aria-label="Змейка"><div class="rg-toolbar"><div class="rg-counters"><span>Счёт <strong data-rg-score>0</strong></span><span>Рекорд <strong data-rg-record>0</strong></span></div><div class="rg-actions"><button type="button" data-rg-play>Начать</button><button type="button" data-rg-reset aria-label="Новая игра в змейку">↻ Заново</button></div></div><div class="rg-snake-field"><canvas width="480" height="240" tabindex="0" aria-label="Поле змейки. Стрелки — движение, пробел — начать или поставить на паузу."></canvas><div class="rg-snake-message"><strong>Ещё один ход.</strong><span>Собирай квадраты. Не врезайся.</span></div></div><div class="rg-snake-controls"><p>Стрелки — движение<br>Пробел — пауза</p><div class="rg-dpad" aria-label="Движение змейки"><button type="button" data-rg-direction="up" aria-label="Вверх">↑</button><button type="button" data-rg-direction="left" aria-label="Влево">←</button><button type="button" data-rg-direction="down" aria-label="Вниз">↓</button><button type="button" data-rg-direction="right" aria-label="Вправо">→</button></div></div><p class="rg-live rg-sr-only" role="status" aria-live="polite"></p></section>`;
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const play = stage.querySelector('[data-rg-play]');
  const scoreLabel = stage.querySelector('[data-rg-score]');
  const recordLabel = stage.querySelector('[data-rg-record]');
  const message = stage.querySelector('.rg-snake-message');
  const live = stage.querySelector('.rg-live');
  const width = 24, height = 12, cell = 20;
  let snake, food, direction, queue = [], state = 'ready', timer = 0, score = 0, record = readRecord(), disposed = false, activityAllowed = true;
  recordLabel.textContent = String(record);

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#f7f7f4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (food) {
      ctx.fillStyle = '#181916'; ctx.fillRect(food.x * cell + 5, food.y * cell + 5, 10, 10);
      ctx.fillStyle = '#f7f7f4'; ctx.fillRect(food.x * cell + 8, food.y * cell + 8, 4, 4);
    }
    snake.forEach((part, index) => {
      const left = part.x * cell, top = part.y * cell;
      ctx.fillStyle = index === 0 ? '#11120f' : '#35362f';
      ctx.fillRect(left + 1, top + 1, cell - 2, cell - 2);
      if (!index) {
        ctx.fillStyle = '#f7f7f4';
        if (direction.x) {
          const eyeX = left + (direction.x > 0 ? 13 : 4);
          ctx.fillRect(eyeX, top + 5, 3, 3); ctx.fillRect(eyeX, top + 12, 3, 3);
        } else {
          const eyeY = top + (direction.y > 0 ? 13 : 4);
          ctx.fillRect(left + 5, eyeY, 3, 3); ctx.fillRect(left + 12, eyeY, 3, 3);
        }
      }
    });
  }
  function showMessage(title, text) {
    message.hidden = false;
    message.querySelector('strong').textContent = title;
    message.querySelector('span').textContent = text;
  }
  function clearTimer() { clearTimeout(timer); timer = 0; }
  function schedule() {
    clearTimer();
    if (state === 'playing' && !disposed && activityAllowed && !document.hidden) timer = setTimeout(tick, Math.max(85, 155 - score * 3));
  }
  function finish(won = false) {
    state = 'finished'; clearTimer();
    play.textContent = 'Ещё раз';
    showMessage(won ? 'Всё поле — твоё.' : 'Ещё раз?', `Счёт: ${score}. Рекорд: ${record}.`);
    live.textContent = `${won ? 'Победа.' : 'Игра окончена.'} Счёт: ${score}.`;
  }
  function tick() {
    if (disposed || state !== 'playing') return;
    if (!activityAllowed || document.hidden) { pause(); return; }
    if (queue.length) direction = queue.shift();
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eating = food && head.x === food.x && head.y === food.y;
    // The tail leaves its cell on this turn unless food is eaten.
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= width || head.y >= height || body.some(part => head.x === part.x && head.y === part.y)) { finish(); return; }
    snake.unshift(head);
    if (eating) {
      score++; scoreLabel.textContent = String(score);
      if (score > record) { record = score; recordLabel.textContent = String(record); saveRecord(record); }
      food = freeFood(snake, width, height);
      if (!food) { draw(); finish(true); return; }
    } else snake.pop();
    draw(); schedule();
  }
  function reset(start = false) {
    clearTimer();
    snake = [{ x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 }];
    direction = DIRECTIONS.right; queue = []; score = 0; scoreLabel.textContent = '0';
    food = freeFood(snake, width, height); state = start ? 'playing' : 'ready';
    play.textContent = start ? 'Пауза' : 'Начать';
    if (start) { message.hidden = true; live.textContent = 'Игра началась.'; schedule(); }
    else showMessage('Ещё один ход.', 'Собирай квадраты. Не врезайся.');
    draw();
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused'; clearTimer(); play.textContent = 'Продолжить';
    showMessage('Пауза.', 'Можно выдохнуть.'); live.textContent = 'Игра на паузе.';
  }
  function toggle() {
    if (!activityAllowed) return;
    if (state === 'ready' || state === 'finished') reset(true);
    else if (state === 'playing') pause();
    else { state = 'playing'; message.hidden = true; play.textContent = 'Пауза'; live.textContent = 'Игра продолжается.'; schedule(); }
  }
  function steer(name) {
    if (!activityAllowed) return;
    const next = DIRECTIONS[name];
    if (!next) return;
    if (state === 'ready' || state === 'finished') reset(true);
    if (state === 'playing') queueDirection(queue, direction, next);
  }
  function click(event) {
    if (event.target.closest('[data-rg-play]')) { toggle(); return; }
    if (event.target.closest('[data-rg-reset]')) { reset(false); return; }
    const button = event.target.closest('[data-rg-direction]');
    // Pointer controls turn on press; retain native keyboard/assistive clicks.
    if (button && event.detail === 0) steer(button.dataset.rgDirection);
  }
  function pointerdown(event) {
    const button = event.target.closest('[data-rg-direction]');
    if (!button || event.button > 0 || !activityAllowed || disposed || document.hidden) return;
    event.preventDefault(); steer(button.dataset.rgDirection);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const directionName = ARROW_DIRECTIONS[event.key];
    if (directionName) { event.preventDefault(); event.stopPropagation(); steer(directionName); return; }
    // Leave native button activation intact. Space on the field pauses the game.
    if (event.key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) toggle(); }
  }
  stage.addEventListener('click', click);
  stage.addEventListener('pointerdown', pointerdown);
  stage.addEventListener('keydown', keydown);
  reset();
  const stopActivity = observeGameActivity(container, value => { activityAllowed = value; if (!value) pause(); });
  return () => {
    disposed = true; clearTimer();
    stage.removeEventListener('click', click); stage.removeEventListener('keydown', keydown); stage.removeEventListener('pointerdown', pointerdown);
    stopActivity();
  };
}

function adjacentIndices(index, width, height) {
  const x = index % width, y = Math.floor(index / width), adjacent = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height) adjacent.push(ny * width + nx);
  }
  return adjacent;
}
function createMinefield(width, height, count, first, random = Math.random) {
  const cells = Array.from({ length: width * height }, () => ({ mine: false, adjacent: 0, open: false, flag: false }));
  // Protect the first cell and its neighbours: the first move always gives room to explore.
  const protectedCells = new Set([first, ...adjacentIndices(first, width, height)]);
  const choices = cells.map((_, index) => index).filter(index => !protectedCells.has(index));
  for (let i = choices.length - 1; i > 0; i--) {
    const pick = Math.floor(random() * (i + 1));
    [choices[i], choices[pick]] = [choices[pick], choices[i]];
  }
  choices.slice(0, Math.min(count, choices.length)).forEach(index => { cells[index].mine = true; });
  cells.forEach((cell, index) => { cell.adjacent = adjacentIndices(index, width, height).filter(other => cells[other].mine).length; });
  return cells;
}
function revealMineArea(cells, first, width, height) {
  const pending = [first], visited = new Set();
  while (pending.length) {
    const index = pending.pop();
    if (visited.has(index)) continue;
    visited.add(index);
    const cell = cells[index];
    if (cell.open || cell.flag || cell.mine) continue;
    cell.open = true;
    if (!cell.adjacent) pending.push(...adjacentIndices(index, width, height));
  }
}

function mountMines(stage, container) {
  const width = 9, height = 9, mineCount = 10;
  stage.innerHTML = `<section class="rg-mines" aria-label="Сапёр"><div class="rg-toolbar"><div class="rg-counters"><span>Мины <strong data-rg-mines-left>10</strong></span><span> · Время <strong data-rg-mines-time>00:00</strong></span><span data-rg-mines-status role="status" aria-live="polite">Первый ход безопасен</span></div><button type="button" data-rg-mines-reset>↻ Заново</button></div><div class="rg-mines-layout"><div class="rg-mine-grid" role="grid" aria-label="Поле сапёра: 9 на 9 клеток" aria-rowcount="9" aria-colcount="9"></div><aside class="rg-mines-guide"><div class="rg-mine-mode" aria-label="Действие с клеткой"><button type="button" data-rg-mode="open" aria-pressed="true">Открыть</button><button type="button" data-rg-mode="flag" aria-pressed="false">⚑ Флаг</button></div><p>Открой все клетки<br>без мин.</p><p>Число показывает,<br>сколько мин рядом.</p><p>Правый клик — флаг.<br>На телефоне выбери<br>режим «Флаг».</p><p class="rg-mines-key-hint">Стрелки — выбор<br>Enter — действие<br>F — поставить флаг</p></aside></div></section>`;
  const grid = stage.querySelector('.rg-mine-grid');
  const leftLabel = stage.querySelector('[data-rg-mines-left]');
  const timeLabel = stage.querySelector('[data-rg-mines-time]');
  const status = stage.querySelector('[data-rg-mines-status]');
  let cells = [], generated = false, phase = 'ready', mode = 'open', focused = 0, exploded = -1;
  let elapsedMs = 0, resumedAt = null, timer = 0, activityAllowed = true;
  function paintTime() {
    const seconds = Math.floor((elapsedMs + (resumedAt === null ? 0 : performance.now() - resumedAt)) / 1000);
    timeLabel.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function stopTimer() {
    if (resumedAt !== null) elapsedMs += performance.now() - resumedAt;
    resumedAt = null; clearInterval(timer); timer = 0; paintTime();
  }
  function startTimer() {
    if (!activityAllowed || document.hidden || phase !== 'playing' || resumedAt !== null) return;
    resumedAt = performance.now(); timer = setInterval(paintTime, 1000);
  }
  const buttons = [];
  for (let y = 0; y < height; y++) {
    const row = document.createElement('div'); row.className = 'rg-mine-row'; row.setAttribute('role', 'row');
    for (let x = 0; x < width; x++) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.rgCell = String(y * width + x);
      button.setAttribute('role', 'gridcell'); button.setAttribute('aria-rowindex', String(y + 1)); button.setAttribute('aria-colindex', String(x + 1));
      row.append(button); buttons.push(button);
    }
    grid.append(row);
  }
  function render() {
    const finished = phase === 'won' || phase === 'lost';
    leftLabel.textContent = String(mineCount - cells.filter(cell => cell.flag).length).padStart(2, '0');
    buttons.forEach((button, index) => {
      const cell = cells[index];
      const showMine = cell.mine && (phase === 'lost' || cell.open);
      const wrongFlag = phase === 'lost' && cell.flag && !cell.mine;
      button.classList.toggle('is-open', cell.open || showMine);
      button.classList.toggle('is-flag', cell.flag);
      button.classList.toggle('is-exploded', index === exploded);
      button.classList.toggle('is-wrong', wrongFlag);
      button.tabIndex = index === focused ? 0 : -1;
      button.dataset.number = cell.open && !cell.mine ? String(cell.adjacent) : '';
      button.textContent = wrongFlag ? '×' : cell.flag ? '⚑' : showMine ? '✳' : cell.open && cell.adjacent ? String(cell.adjacent) : '';
      const position = `Ряд ${Math.floor(index / width) + 1}, столбец ${index % width + 1}`;
      const label = wrongFlag ? 'ошибочный флаг' : cell.flag ? 'флаг' : showMine ? 'мина' : cell.open ? cell.adjacent ? `открыто, рядом мин: ${cell.adjacent}` : 'открыто, пусто' : 'закрыто';
      button.setAttribute('aria-label', `${position}: ${label}`);
      button.setAttribute('aria-disabled', String(finished || cell.open));
    });
  }
  function reset() {
    stopTimer(); elapsedMs = 0;
    cells = Array.from({ length: width * height }, () => ({ mine: false, adjacent: 0, open: false, flag: false }));
    generated = false; phase = 'ready'; exploded = -1; focused = 0;
    status.textContent = 'Первый ход безопасен'; paintTime(); render();
  }
  function flag(index) {
    if (phase === 'lost' || phase === 'won' || cells[index].open) return;
    if (!cells[index].flag && cells.filter(cell => cell.flag).length >= mineCount) { status.textContent = 'Все 10 флагов уже на поле'; return; }
    cells[index].flag = !cells[index].flag;
    status.textContent = cells[index].flag ? 'Флаг установлен' : 'Флаг снят'; render();
  }
  function open(index) {
    if (phase === 'lost' || phase === 'won' || cells[index].flag || cells[index].open) return;
    if (!generated) {
      const flags = cells.map(cell => cell.flag);
      cells = createMinefield(width, height, mineCount, index);
      cells.forEach((cell, i) => { cell.flag = flags[i]; });
      generated = true; phase = 'playing'; startTimer();
    }
    if (cells[index].mine) {
      phase = 'lost'; stopTimer(); exploded = index; status.textContent = 'Мина. Попробуем ещё?'; render(); return;
    }
    revealMineArea(cells, index, width, height);
    const remaining = cells.filter(cell => !cell.mine && !cell.open).length;
    if (!remaining) {
      phase = 'won'; stopTimer(); cells.forEach(cell => { if (cell.mine) cell.flag = true; });
      status.textContent = 'Чистая работа. Победа!';
    } else status.textContent = `Осталось открыть: ${remaining}`;
    render();
  }
  function focusCell(index) {
    focused = Math.max(0, Math.min(buttons.length - 1, index));
    buttons.forEach((button, i) => { button.tabIndex = i === focused ? 0 : -1; });
    buttons[focused].focus({ preventScroll: true });
    buttons[focused].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function click(event) {
    if (event.target.closest('[data-rg-mines-reset]')) { reset(); return; }
    const modeButton = event.target.closest('[data-rg-mode]');
    if (modeButton) {
      mode = modeButton.dataset.rgMode;
      stage.querySelectorAll('[data-rg-mode]').forEach(button => button.setAttribute('aria-pressed', String(button === modeButton)));
      return;
    }
    const button = event.target.closest('[data-rg-cell]');
    if (!button) return;
    focused = Number(button.dataset.rgCell);
    if (mode === 'flag') flag(focused); else open(focused);
  }
  function contextMenu(event) {
    const button = event.target.closest('[data-rg-cell]');
    if (!button) return;
    event.preventDefault(); focused = Number(button.dataset.rgCell); flag(focused);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const button = event.target.closest('[data-rg-cell]');
    if (!button) return;
    const index = Number(button.dataset.rgCell), x = index % width, y = Math.floor(index / width);
    if (ARROW_DIRECTIONS[event.key]) {
      event.preventDefault(); event.stopPropagation();
      const delta = DIRECTIONS[ARROW_DIRECTIONS[event.key]];
      focusCell(Math.max(0, Math.min(height - 1, y + delta.y)) * width + Math.max(0, Math.min(width - 1, x + delta.x)));
    } else if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'а') {
      event.preventDefault(); event.stopPropagation(); if (!event.repeat) flag(index);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); event.stopPropagation(); focusCell(y * width + (event.key === 'Home' ? 0 : width - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) { if (mode === 'flag') flag(index); else open(index); }
    }
  }
  function focusin(event) {
    const button = event.target.closest('[data-rg-cell]');
    if (button) { focused = Number(button.dataset.rgCell); buttons.forEach((item, i) => { item.tabIndex = i === focused ? 0 : -1; }); }
  }
  stage.addEventListener('click', click); stage.addEventListener('contextmenu', contextMenu);
  stage.addEventListener('keydown', keydown); stage.addEventListener('focusin', focusin);
  reset();
  const stopActivity = observeGameActivity(container, value => {
    activityAllowed = value;
    if (value) startTimer(); else stopTimer();
  });
  return () => {
    stopTimer(); stopActivity();
    stage.removeEventListener('click', click); stage.removeEventListener('contextmenu', contextMenu);
    stage.removeEventListener('keydown', keydown); stage.removeEventListener('focusin', focusin);
  };
}
