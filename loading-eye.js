// A typographic eye intro with a quiet, opacity-only handoff.
// Ordinary text rows avoid Canvas2D/WebGL flush stalls during scene startup.
const COLUMNS = 121;
const ROWS = 43;
const WIDTH = 720;
const HEIGHT = 344;
const INK = '#171916';
const RAMP = ' .,:;irsXA253hMHGS#9B&@';
const LINE_FILL_TIME = 580;
const LINE_END = 700;
const OPENING_END = 1250;
const FIRST_BLINK = 1570;
const BLINK_LENGTH = 320;
const MINIMUM_TIME = 2050;
const EYE_FADE_TIME = 260;
const PAPER_HOLD = 50;
const SITE_REVEAL_TIME = 760;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, amount) => a + (b - a) * amount;

function irisDensity(x, y, pupil) {
  const radius = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  const edge = .247 + Math.sin(angle * 19) * .0016;
  if (radius > edge) return -1;
  const fibre = Math.sin(angle * 73 + radius * 22) * .5
    + Math.sin(angle * 137 - radius * 31) * .28
    + Math.sin(angle * 211 + Math.sin(angle * 17) * 1.7) * .16;
  const collarette = Math.exp(-(((radius - .122 - Math.sin(angle * 29) * .006) / .014) ** 2));
  const ring = smooth((radius - .216) / .03);
  let density = .40 + fibre * .15 + collarette * .20 + ring * .32;
  density += Math.sin(radius * 280 + angle * 2) * .025;
  if (radius < pupil) density = 1;
  else if (radius < pupil + .012) density = mix(.94, density, (radius - pupil) / .012);
  const reflection = Math.hypot((x + .064) / .034, (y + .085) / .026);
  const glint = Math.hypot((x - .024) / .012, (y + .059) / .010);
  density *= smooth((reflection - .65) / .55);
  density *= smooth((glint - .45) / .8);
  return clamp(density);
}

function lidCurves(x, closure, emergence = 1) {
  const core = Math.max(0, 1 - Math.abs(x) ** 1.72);
  const upper = -.287 * core ** .68 + .023 * x;
  const lower = .211 * Math.max(0, 1 - x * x) ** .71 + .023 * x;
  const closed = .075 * (1 - x * x) + .023 * x;
  const localClosure = clamp(closure + Math.sin(closure * Math.PI) * x * .025);
  return {
    upper: mix(upper, closed, localClosure) * emergence,
    lower: mix(lower, closed, localClosure) * emergence,
    crease: (upper - .073 * core) * emergence
  };
}

function lineDistance(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((x - x1) * dx + (y - y1) * dy) / Math.max(.000001, dx * dx + dy * dy));
  return Math.hypot(x - x1 - dx * t, y - y1 - dy * t);
}

// Emergence moves the contours themselves from a straight line to an open eye.
// The iris is uncovered by the lids rather than cross-faded onto the line.
export function renderEyeAscii({ closure = 0, gazeX = 0, gazeY = 0, pupil = .078, emergence = 1 } = {}) {
  closure = clamp(closure); emergence = clamp(emergence);
  const lashes = [];
  for (let index = 0; index < 18; index++) {
    const x = -.91 + index * .105;
    const { upper } = lidCurves(x, closure, emergence);
    const length = (.040 + .029 * Math.abs(x) + .009 * Math.sin(index * 2.4)) * (1 - closure * .25) * emergence;
    lashes.push([x, upper - .003, x + (x * .035 - .006) * emergence, upper - length]);
  }
  const rows = [];
  for (let row = 0; row < ROWS; row++) {
    const y = (row / (ROWS - 1) - .5) * 1.105;
    let text = '';
    for (let column = 0; column < COLUMNS; column++) {
      const x = (column / (COLUMNS - 1) - .5) * 2.30;
      let density = 0, contour = '';
      if (Math.abs(x) < 1.035) {
        const safeX = clamp(x, -.999, .999);
        const { upper, lower, crease } = lidCurves(safeX, closure, emergence);
        const topDistance = y - upper, bottomDistance = lower - y;
        if (Math.abs(x) < 1 && topDistance >= 0 && bottomDistance >= 0) {
          density = .025 + Math.abs(x) ** 5 * .24;
          density += .16 * Math.exp(-topDistance / .041);
          density += .06 * Math.exp(-bottomDistance / .033);
          const iris = irisDensity(x - gazeX, y - gazeY, pupil);
          if (iris >= 0) density = iris + .13 * Math.exp(-topDistance / .046);
          if (bottomDistance < .012 && Math.abs(x) < .54) density *= .35;
        }
        const upperStroke = 1 - Math.abs(topDistance) / (.0115 + .008 * (1 - Math.abs(safeX)));
        const lowerStroke = 1 - Math.abs(bottomDistance) / .011;
        if (Math.abs(x) <= 1.018 && upperStroke > 0) {
          density = Math.max(density, .73 * upperStroke + .14);
          if (upperStroke > .30 && closure > .86) contour = Math.abs(x) < .57 ? '_' : (x < 0 ? '\\' : '/');
        }
        if (closure < .94 && Math.abs(x) < 1 && lowerStroke > 0) density = Math.max(density, lowerStroke * .40);
        const creaseStrength = (1 - Math.abs(y - crease) / .011) * .25 * (1 - Math.abs(safeX)) * (1 - closure * .65) * emergence;
        density = Math.max(density, creaseStrength);
        if (emergence > .15 && y < upper + .004 && y > upper - .095) {
          for (const lash of lashes) {
            if (Math.abs(x - lash[0]) > .052) continue;
            const lashStrength = (1 - lineDistance(x, y, ...lash) / .007) * .63;
            density = Math.max(density, lashStrength);
            if (lashStrength > .22 && y < upper - .020) contour = x < -.15 ? '\\' : '/';
          }
        }
        const tear = Math.hypot((x + .967) / .049, (y + .015 * emergence) / (.030 * emergence + .001));
        if (tear < 1) density = Math.max(density, (1 - tear) * .38);
        if (emergence < .035 && Math.abs(x) < 1.01 && Math.abs(y) < .010) contour = '-';
      }
      text += contour || RAMP[Math.round(clamp(density) * (RAMP.length - 1))];
    }
    rows.push(text);
  }
  return rows;
}

function blinkPhase(elapsed) {
  if (elapsed < FIRST_BLINK) return -1;
  if (elapsed < FIRST_BLINK + BLINK_LENGTH) return elapsed - FIRST_BLINK;
  return elapsed < 4140 ? -1 : (elapsed - 4140) % 4300;
}
function blinkAt(elapsed) {
  const phase = blinkPhase(elapsed);
  if (phase < 0 || phase > BLINK_LENGTH) return 0;
  if (phase < 95) return smooth(phase / 95);
  if (phase < 135) return 1;
  return 1 - smooth((phase - 135) / (BLINK_LENGTH - 135));
}
function gazeAt(elapsed, still) {
  return {
    gazeX: still ? .014 : .015 + .030 * Math.sin(elapsed / 2100)
      + .017 * smooth((elapsed - 1130) / 90) - .025 * smooth((elapsed - 2460) / 100),
    gazeY: still ? -.006 : -.006 + .008 * Math.sin(elapsed / 2900),
    pupil: .077 + (still ? 0 : Math.sin(elapsed / 1900) * .003)
  };
}

export function createEyeLoader(element, { reducedMotion = false, onReveal = () => {} } = {}) {
  const started = performance.now();
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let still = reducedMotion || !!motionQuery?.matches;
  let disposed = false, done = false, revealed = false, requested = false;
  let raf = 0, startTimer = 0, revealTimer = 0, completeTimer = 0;
  let finishPromise, finishResolve, previousFrame = -Infinity, previousKey = '';
  // Count presented animation time, not time spent preparing the 3D scene.
  // A blocked main thread or a background tab must not consume the line/opening.
  let elapsed = 0, previousTick = null;
  let viewWidth = WIDTH, viewHeight = HEIGHT, eyeWidth = WIDTH, eyeHeight = HEIGHT;
  let drawingConfigured = false, fadingStarted = null, restingRows = [], lastDiagnostic = -Infinity, lastTransitionProgress = -1;
  const surface = element?.parentElement;
  const rowText = Array(ROWS).fill('');
  const rowElements = element ? Array.from({ length: ROWS }, () => {
    const row = document.createElement('span');
    row.className = 'loading-eye-row'; row.setAttribute('aria-hidden', 'true');
    return row;
  }) : [];
  element?.replaceChildren(...rowElements);
  const phase = value => { if (element?.dataset) element.dataset.phase = value; };
  const clear = () => {
    rowElements.forEach((row, index) => {
      if (rowText[index]) { row.textContent = ''; rowText[index] = ''; }
    });
  };
  const drawRows = lines => {
    if (!element) return;
    for (let row = 0; row < ROWS; row++) {
      // Leading spaces retain the font's exact column advance. Unchanged rows
      // keep their text nodes and need no repeated text shaping or DOM writes.
      const text = lines[row].trimEnd();
      if (text !== rowText[row]) { rowElements[row].textContent = text; rowText[row] = text; }
    }
  };
  const cleanup = () => {
    cancelAnimationFrame(raf); raf = 0;
    clearTimeout(startTimer); clearTimeout(revealTimer); clearTimeout(completeTimer);
    observer?.disconnect();
    globalThis.removeEventListener?.('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    motionQuery?.removeEventListener?.('change', motionChanged);
  };
  const complete = () => {
    if (done) return;
    done = true;
    cleanup(); clear();
    element?.classList.remove('is-eye-fading');
    if (!disposed) phase('done');
    restingRows = [];
    finishResolve?.(); finishResolve = null;
  };
  const reveal = () => {
    if (revealed || disposed || done) return;
    revealed = true;
    cancelAnimationFrame(raf); raf = 0;
    clear(); phase('reveal');
    if (element?.dataset) element.dataset.transitionProgress = '1';
    // Reserve the complete CSS cross-fade interval. No eye is redrawn beneath it.
    if (!still && element) completeTimer = setTimeout(complete, SITE_REVEAL_TIME);
    try { onReveal(); } catch (error) { console.warn('Intro reveal callback failed.', error); }
    if (still || !element) complete();
  };
  const paint = (now, force = false) => {
    if (!element || disposed || done) return;
    if (revealed) { clear(); return; }
    if (fadingStarted !== null) {
      const progress = clamp((now - fadingStarted) / EYE_FADE_TIME);
      if (element?.dataset && (now - lastDiagnostic >= 100 || (progress === 1 && lastTransitionProgress !== 1))) {
        lastDiagnostic = now;
        lastTransitionProgress = progress;
        element.dataset.transitionProgress = progress.toFixed(3);
      }
      return;
    }
    let lines, key;
    if (!still && elapsed < LINE_END) {
      phase('line');
      const progress = smooth(elapsed / LINE_FILL_TIME);
      const firstColumn = Math.ceil(COLUMNS * .064);
      const total = Math.floor(COLUMNS * .872);
      const length = Math.floor(total * progress);
      const center = ' '.repeat(firstColumn) + '-'.repeat(length) + '.'.repeat(total - length);
      lines = Array.from({ length: ROWS }, (_, index) => index === 21 ? center : '');
      key = `line:${length}`;
    } else {
      const emergence = still ? 1 : smooth((elapsed - LINE_END) / (OPENING_END - LINE_END));
      const closure = still || emergence < 1 ? 0 : blinkAt(elapsed);
      phase(emergence < 1 ? 'opening' : closure > 0 ? 'blink' : 'eye');
      const gaze = gazeAt(elapsed, still);
      key = `${Math.round(emergence * 45)}:${Math.round(closure * 35)}:${Math.round(gaze.gazeX * 600)}:${Math.round(gaze.gazeY * 600)}`;
      if (!force && key === previousKey) return;
      lines = renderEyeAscii({ emergence, closure, ...gaze });
    }
    if (!force && key === previousKey) return;
    previousKey = key;
    drawRows(lines);
  };
  const frame = now => {
    raf = 0;
    if (disposed || done || revealed || document.hidden || (still && fadingStarted === null)) return;
    if (previousTick !== null) elapsed += Math.min(50, Math.max(0, now - previousTick));
    previousTick = now;
    const interval = 1000 / 30;
    if (now - previousFrame >= interval) {
      previousFrame = Number.isFinite(previousFrame) ? now - ((now - previousFrame) % interval) : now;
      paint(now);
    }
    if (requested && fadingStarted === null && elapsed >= MINIMUM_TIME) {
      const blink = blinkPhase(elapsed);
      if (blink < 0 || blink > BLINK_LENGTH) beginFade();
    }
    schedule();
  };
  const schedule = () => {
    if (element && !disposed && !done && !revealed && !document.hidden && (!still || fadingStarted !== null) && !raf) raf = requestAnimationFrame(frame);
  };
  const beginFade = () => {
    startTimer = 0;
    if (disposed || done || fadingStarted !== null || revealed) return;
    if (still || !element) { reveal(); return; }
    // A late resource may finish during a blink. armFinish waits for its end,
    // then the open eye rests in the exact same size and position while fading.
    restingRows = renderEyeAscii(gazeAt(elapsed, false));
    drawRows(restingRows);
    fadingStarted = performance.now(); phase('fading');
    element.classList.add('is-eye-fading');
    revealTimer = setTimeout(reveal, EYE_FADE_TIME + PAPER_HOLD);
    if (!document.hidden) paint(fadingStarted, true);
    schedule();
  };
  const armFinish = () => {
    clearTimeout(startTimer);
    if (still || !element) {
      startTimer = setTimeout(beginFade, Math.max(0, 120 - (performance.now() - started)));
      return;
    }
    // Finish only after the visible line, opening and first blink have played.
    schedule();
  };
  const resize = () => {
    if (!element || disposed || done) return;
    const rect = surface?.getBoundingClientRect();
    viewWidth = Math.max(1, rect?.width || globalThis.innerWidth || WIDTH);
    viewHeight = Math.max(1, rect?.height || globalThis.innerHeight || HEIGHT);
    const nextWidth = Math.min(WIDTH, viewWidth * .90, viewHeight * 1.45);
    const nextHeight = nextWidth * HEIGHT / WIDTH;
    const drawingChanged = !drawingConfigured || eyeWidth !== nextWidth || eyeHeight !== nextHeight;
    eyeWidth = nextWidth; eyeHeight = nextHeight;
    element.style.width = `${eyeWidth}px`; element.style.height = `${eyeHeight}px`;
    element.style.left = `${(viewWidth - eyeWidth) / 2}px`;
    element.style.top = `${viewHeight * .49 - eyeHeight / 2}px`;
    if (!drawingChanged) return;
    element.style.fontSize = `${eyeWidth / COLUMNS / .6001}px`;
    // A zero-height line box centers its font metrics on the former Canvas
    // `middle` baseline; each row keeps the same (row + .5) * lineHeight center.
    rowElements.forEach((row, index) => { row.style.top = `${(index + .5) * eyeHeight / ROWS}px`; });
    drawingConfigured = true;
    if (fadingStarted !== null) drawRows(restingRows);
    else paint(performance.now(), true);
  };
  const visibility = () => {
    previousTick = null;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else { paint(performance.now(), true); schedule(); }
  };
  const motionChanged = event => {
    previousTick = null;
    clearTimeout(startTimer);
    still = reducedMotion || event.matches;
    if (still) {
      cancelAnimationFrame(raf); raf = 0;
      if (fadingStarted !== null || revealed) { reveal(); complete(); return; }
      paint(performance.now(), true);
    } else schedule();
    if (requested) armFinish();
  };
  const observer = element && surface && typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (element) {
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Шкала загрузки превращается в моргающий глаз из символов ASCII');
    element.style.color = INK;
    if (element.dataset) element.dataset.transitionProgress = '0';
    element.classList.remove('is-eye-fading');
  }
  if (element) {
    resize(); observer?.observe(surface);
    if (!observer) globalThis.addEventListener?.('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    motionQuery?.addEventListener?.('change', motionChanged);
    schedule();
  } else phase('line');
  return {
    finish() {
      if (finishPromise) return finishPromise;
      if (disposed || done) return Promise.resolve();
      finishPromise = new Promise(resolve => { finishResolve = resolve; });
      requested = true; armFinish();
      return finishPromise;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      complete(); cleanup(); restingRows = [];
    }
  };
}
