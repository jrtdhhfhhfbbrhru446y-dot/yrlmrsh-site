const bleed = 20;
const circleCurve = .5523;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function capsule(width, height) {
  const left = bleed + .55, right = bleed + width - .55;
  const top = bleed + .55, bottom = bleed + height - .55;
  const centerY = bleed + height / 2, radius = centerY - top;
  const start = left + radius, end = right - radius, corner = radius * circleCurve;
  const segments = Math.max(1, Math.ceil((end - start) / 56));
  const curves = [];

  function straight(from, to, y) {
    const step = (to - from) / segments;
    for (let i = 0; i < segments; i++) {
      const x = from + i * step;
      curves.push([[x + step / 3, y], [x + step * 2 / 3, y], [x + step, y]]);
    }
  }

  straight(start, end, top);
  curves.push([[end + corner, top], [right, centerY - corner], [right, centerY]],
    [[right, centerY + corner], [end + corner, bottom], [end, bottom]]);
  straight(end, start, bottom);
  curves.push([[start - corner, bottom], [left, centerY + corner], [left, centerY]],
    [[left, centerY - corner], [start - corner, top], [start, top]]);
  return { start: [start, top], curves, centerY, radius };
}

// Warp the anchors and their tangents together. The straight edges and
// rounded ends then meet smoothly at every pointer position.
function outline(bounds, horizontal, vertical, energy) {
  const { width, height, reach, rise, shape } = bounds;
  const xShift = horizontal * reach, yShift = vertical * rise;
  const center = bleed + width * (.5 + horizontal * .42);
  const spread = Math.max(height * .95, width * .24);
  const bulge = energy * 3.2 / shape.radius;

  function warp([x, y]) {
    const offset = (x - center) / spread;
    const weight = Math.exp(-.5 * offset * offset);
    const slope = -offset * weight / spread;
    const lift = yShift * .72 + bulge * (y - shape.centerY);
    return { x: x + xShift * (.18 + .72 * weight), y: y + yShift * .12 + lift * weight,
      dx: 1 + xShift * .72 * slope, slope: lift * slope, dy: 1 + bulge * weight };
  }

  const pair = (x, y) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  function handle([x, y], [anchorX, anchorY], point) {
    const dx = x - anchorX, dy = y - anchorY;
    return pair(point.x + dx * point.dx, point.y + dx * point.slope + dy * point.dy);
  }

  let anchor = shape.start, point = warp(anchor);
  let path = `M${pair(point.x, point.y)}`;
  for (const [out, into, end] of shape.curves) {
    const next = warp(end);
    path += ` C${handle(out, anchor, point)} ${handle(into, end, next)} ${pair(next.x, next.y)}`;
    anchor = end; point = next;
  }
  return `${path} Z`;
}

function attachSelectionSpring(switcher) {
  const buttons = [...switcher.querySelectorAll(':scope > button')];
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => !body.classList.contains('motion-off') && !reduce.matches;
  const isCompact = () => body.classList.contains('flat-mode');
  const selection = () => {
    const index = buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true');
    return index < 0 ? 1 : index;
  };
  let compact = isCompact(), target = selection(), position = target, velocity = 0, frame = 0, lastTime = 0;
  let pointer;
  let ignoreTouchClickUntil = 0;

  function paint() {
    const inside = clamp(position, 0, buttons.length - 1 - Number(compact)), spill = position - inside;
    // Leave a small elastic overshoot without letting the lens hit the outer rim.
    const visible = inside + spill / (1 + 64 * Math.abs(spill));
    switcher.style.setProperty('--glass-spring-position', `${visible * 100}%`);
  }

  function snap(next) {
    cancelAnimationFrame(frame);
    frame = lastTime = velocity = 0;
    position = target = next;
    paint();
  }

  function animate(time) {
    frame = 0;
    if (!canAnimate()) { snap(selection()); return; }
    const dt = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    // Unit mass with the reference's stiffness 500 and damping 30.
    const frequency = Math.sqrt(500 - 15 ** 2);
    const sine = Math.sin(frequency * dt), cosine = Math.cos(frequency * dt);
    const displacement = position - target, slope = (velocity + 15 * displacement) / frequency;
    const wave = displacement * cosine + slope * sine, decay = Math.exp(-15 * dt);
    position = target + decay * wave;
    velocity = decay * (frequency * (slope * cosine - displacement * sine) - 15 * wave);
    if (Math.abs(position - target) < .001 && Math.abs(velocity) < .015) { snap(target); return; }
    paint();
    frame = requestAnimationFrame(animate);
  }

  function glideTo(next) {
    if (!canAnimate()) { snap(next); return; }
    target = next;
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function finishDrag(destination) {
    const gesture = pointer;
    pointer = null;
    if (!gesture?.dragging) return;
    if (gesture.touch) ignoreTouchClickUntil = performance.now() + 450;
    switcher.removeAttribute('data-glass-dragging');
    if (destination && !destination.disabled && destination !== buttons[selection()]) destination.click();
    glideTo(selection());
  }

  switcher.addEventListener('pointerdown', event => {
    const touch = event.pointerType === 'touch';
    if (touch ? !body.classList.contains('mobile-mode') : event.pointerType !== 'mouse') return;
    if (event.isPrimary === false || event.button !== 0 || pointer) return;
    ignoreTouchClickUntil = 0;
    const active = buttons[selection()];
    if (!active.contains(event.target)) return;
    const step = active.getBoundingClientRect().width;
    if (step > 0) pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, step, touch };
  });

  switcher.addEventListener('click', event => {
    // A touch drag may be followed by a native click on its starting button.
    if (!event.detail || performance.now() >= ignoreTouchClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  addEventListener('pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    const dx = event.clientX - pointer.x;
    if (!pointer.dragging) {
      const slop = pointer.touch ? 8 : 5;
      const dy = Math.abs(event.clientY - pointer.y);
      if (dy > slop && dy > Math.abs(dx)) {
        if (pointer.touch) ignoreTouchClickUntil = performance.now() + 450;
        finishDrag();
        return;
      }
      if (Math.abs(dx) < slop) return;
      // Capture only after a drag, so an ordinary press keeps its native click.
      switcher.setPointerCapture(event.pointerId);
      cancelAnimationFrame(frame);
      frame = lastTime = velocity = 0;
      pointer.origin = position;
      pointer.dragging = true;
      switcher.setAttribute('data-glass-dragging', '');
    }
    position = clamp(pointer.origin + dx / pointer.step, 0, buttons.length - 1 - Number(compact));
    paint();
  }, { passive: true });

  addEventListener('pointerup', event => {
    if (event.pointerId !== pointer?.id || event.button !== 0) return;
    const { top, bottom } = switcher.getBoundingClientRect();
    const inRow = event.clientY >= top - 24 && event.clientY <= bottom + 24;
    finishDrag(inRow ? buttons[Math.round(position)] : null);
  });

  function cancelPointer(event) {
    if (event.pointerId === pointer?.id) finishDrag();
  }
  addEventListener('pointercancel', cancelPointer);
  switcher.addEventListener('lostpointercapture', event => {
    // Touch initially captures the button, then hands the gesture to the row.
    if (event.target === switcher) cancelPointer(event);
  });
  addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !pointer?.dragging) return;
    event.preventDefault();
    finishDrag();
  });
  addEventListener('blur', () => finishDrag());
  addEventListener('resize', () => finishDrag());

  const observer = new MutationObserver(() => {
    const next = selection(), layout = isCompact();
    if (layout !== compact) { compact = layout; finishDrag(); snap(next); return; }
    if (next === target) return;
    finishDrag();
    glideTo(next);
  });
  for (const button of buttons) observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] });
  reduce.addEventListener('change', () => snap(selection()));
  paint();
  switcher.setAttribute('data-glass-spring', '');
}

export function attachGlassDock(dock) {
  attachSelectionSpring(dock.querySelector('.view-switch'));
  if (!CSS.supports('clip-path', 'path("M0 0H1V1Z")') || typeof ResizeObserver !== 'function') return;
  const hover = matchMedia('(hover: hover)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // Use SVG backdrop displacement on Chromium. Other engines keep the CSS glass.
  const canRefract = /(?:Chrome|Chromium)\/\d+/.test(navigator.userAgent)
    && CSS.supports('backdrop-filter', 'url("#dock-optics") blur(2px)');
  const body = document.body;
  const canAnimate = () => !reduce.matches && !body.classList.contains('motion-off');
  const measures = [];
  const observer = new ResizeObserver(() => measures.forEach(measure => measure()));

  [...dock.querySelectorAll('.view-switch, .expand-button')].forEach((glass, index) => {
    const material = document.createElement('span');
    const gradient = `glass-edge-${index}`;
    const bevel = `glass-bevel-${index}`;
    const contour = `glass-contour-${index}`;
    const gleam = `glass-gleam-${index}`;
    const optics = `glass-optics-${index}`;
    material.className = 'glass-material';
    material.setAttribute('aria-hidden', 'true');
    material.innerHTML = `<span class="glass-face"></span>
      <svg class="glass-outline" fill="none" focusable="false">
        <defs>
          <linearGradient id="${gradient}" x2="0" y2="1">
            <stop stop-color="var(--glass-edge-light)"/>
            <stop offset=".5" stop-color="var(--glass-rim)"/>
            <stop offset="1" stop-color="var(--glass-edge-low)"/>
          </linearGradient>
          <linearGradient id="${bevel}" x2="0" y2="1">
            <stop stop-color="var(--glass-bevel-light)"/>
            <stop offset=".33" stop-color="var(--glass-bevel-shadow)"/>
            <stop offset=".72" stop-color="var(--glass-bevel-shadow)"/>
            <stop offset="1" stop-color="var(--glass-bevel-light)"/>
          </linearGradient>
          <radialGradient id="${gleam}" gradientUnits="userSpaceOnUse">
            <stop stop-color="var(--glass-specular)"/>
            <stop offset=".46" stop-color="var(--glass-specular)" stop-opacity=".42"/>
            <stop offset="1" stop-color="var(--glass-specular)" stop-opacity="0"/>
          </radialGradient>
          <clipPath id="${contour}"><path fill="black"/></clipPath>
          ${canRefract ? `<filter id="${optics}" x="-5%" y="-25%" width="110%" height="150%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".035 .062" numOctaves="1" seed="1" result="ripples"/>
            <feGaussianBlur in="ripples" stdDeviation="1.7" result="smoothed"/>
            <feDisplacementMap in="SourceGraphic" in2="smoothed" scale="18" xChannelSelector="R" yChannelSelector="B"/>
          </filter>` : ''}
        </defs>
        <path class="glass-bevel" stroke="url(#${bevel})" clip-path="url(#${contour})"/>
        <path class="glass-edge" stroke="url(#${gradient})"/>
        <path class="glass-reflection" stroke="url(#${gleam})" clip-path="url(#${contour})"/>
        <path class="glass-glint" stroke="url(#${gleam})" clip-path="url(#${contour})"/>
      </svg>`;
    glass.prepend(material);
    const face = material.querySelector('.glass-face'), svg = material.querySelector('svg');
    if (canRefract) face.style.setProperty('--glass-backdrop', `url("#${optics}") blur(2px)`);
    const edges = svg.querySelectorAll('path');
    const glint = svg.querySelector('radialGradient');
    const axes = Array.from({ length: 2 }, () => ({ value: 0, target: 0, speed: 0 }));
    let bounds, frame = 0, lastTime = 0, light, energy = 0, hovering = false, touchId = null;

    function paint() {
      const path = outline(bounds, axes[0].value, axes[1].value, energy);
      face.style.clipPath = `path("${path}")`;
      for (const edge of edges) edge.setAttribute('d', path);
      material.style.setProperty('--glass-energy', energy);
      if (light) {
        glint.setAttribute('cx', light.x);
        glint.setAttribute('cy', light.y);
      }
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = lastTime = energy = 0;
      hovering = false;
      touchId = null;
      for (const axis of axes) axis.value = axis.target = axis.speed = 0;
      if (bounds) paint();
      light = null;
    }

    function measure() {
      const { left, top, right, width, height } = glass.getBoundingClientRect();
      if (!width || !height) {
        bounds = null;
        glass.removeAttribute('data-glass-ready');
        reset();
        return;
      }
      if (bounds && bounds.width === width && bounds.height === height && bounds.left === left && bounds.top === top) return;
      bounds = { left, top, width, height, shape: capsule(width, height),
        reach: clamp(Math.min(left, innerWidth - right) * .68, 0, 8.5),
        rise: clamp((innerHeight - top - height) * .54, 0, 7) };
      material.style.width = `${width + 2 * bleed}px`;
      material.style.height = `${height + 2 * bleed}px`;
      svg.setAttribute('viewBox', `0 0 ${width + 2 * bleed} ${height + 2 * bleed}`);
      glint.setAttribute('r', Math.min(72, width * .3));
      reset();
      glass.setAttribute('data-glass-ready', '');
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(animate);
    }

    function animate(time) {
      frame = 0;
      if (!canAnimate()) { reset(); return; }
      const step = lastTime ? Math.min(.025, (time - lastTime) / 1000) : 1 / 60;
      lastTime = time;
      let moving = false;
      for (const axis of axes) {
        axis.speed += ((axis.target - axis.value) * 290 - axis.speed * 24) * step;
        axis.value += axis.speed * step;
        if (Math.abs(axis.target - axis.value) > .006 || Math.abs(axis.speed) > .05) moving = true;
        else { axis.value = axis.target; axis.speed = 0; }
      }
      const brightness = Number(hovering);
      energy += (brightness - energy) * (1 - Math.exp(-step * (hovering ? 26 : 19)));
      if (Math.abs(brightness - energy) > .003) moving = true;
      else energy = brightness;
      paint();
      if (moving) schedule();
      else lastTime = 0;
    }

    function followPointer(event) {
      const touch = event.pointerType === 'touch';
      if (!canAnimate() || (touch ? event.pointerId !== touchId : !hover.matches || touchId !== null)) return;
      if (!bounds || event.type === 'pointerenter') measure();
      if (!bounds) return;
      const x = clamp(event.clientX - bounds.left, 0, bounds.width);
      const y = clamp(event.clientY - bounds.top, 0, bounds.height);
      light = { x: bleed + x, y: bleed + y };
      axes[0].target = x / bounds.width * 2 - 1;
      axes[1].target = y / bounds.height * 2 - 1;
      hovering = true;
      schedule();
    }

    function startTouch(event) {
      if (event.pointerType !== 'touch' || event.isPrimary === false || touchId !== null || !canAnimate()) return;
      if (!body.classList.contains('mobile-mode')) return;
      measure();
      if (!bounds) return;
      touchId = event.pointerId;
      followPointer(event);
    }

    function finishTouch(event) {
      if (event.pointerId !== touchId) return;
      touchId = null;
      settle();
    }

    function settle() {
      if (!hovering) return;
      hovering = false;
      for (const axis of axes) axis.target = 0;
      schedule();
    }

    glass.addEventListener('pointerenter', followPointer, { passive: true });
    glass.addEventListener('pointerdown', startTouch, { passive: true });
    glass.addEventListener('pointermove', followPointer, { passive: true });
    glass.addEventListener('pointerup', finishTouch);
    glass.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'touch' && touchId === null) settle();
    });
    glass.addEventListener('pointercancel', event => {
      if (event.pointerType === 'touch') finishTouch(event);
      else settle();
    });
    glass.addEventListener('lostpointercapture', event => {
      if (event.target === glass) finishTouch(event);
    });
    addEventListener('resize', measure, { passive: true });
    addEventListener('blur', reset);
    hover.addEventListener('change', reset);
    reduce.addEventListener('change', reset);
    measures.push(measure);
    observer.observe(glass, { box: 'border-box' });
  });
}
