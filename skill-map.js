import { PM_STAGES, PM_LENSES, PM_LINKS } from './skill-map-data.js?v=studio-14-final';
import { getProject } from './portfolio-data.js?v=studio-64-final';
import { createSkillWebPhysics } from './skill-web-physics.js?v=studio-16-final';

const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const NODES = PM_STAGES.flatMap(stage => stage.nodes.map(node => ({ ...node, stageId: stage.id, stageTitle: stage.title })));
const BY_ID = new Map(NODES.map(node => [node.id, node]));
const LENSES = [['all', 'Весь цикл'], ['launch', 'Запуск'], ['growth', 'Рост'], ['content', 'Контент']];
const GROUP_W = 220, GROUP_H = 188, NODE_W = 196, NODE_H = 30;
const WEB_NODE_W = 184, WEB_NODE_H = 64;
const CYCLE_LINKS = NODES.map((node, index) => ({ from: node.id, to: NODES[(index + 1) % NODES.length].id, reason: 'Последовательность работы' }));
const WEB_LINKS = [...CYCLE_LINKS, ...PM_LINKS];
const NEIGHBORS = new Map(NODES.map(node => [node.id, new Set()]));
for (const link of WEB_LINKS) { NEIGHBORS.get(link.from).add(link.to); NEIGHBORS.get(link.to).add(link.from); }
let instanceId = 0;

/** A deterministic, bounded pass that establishes the live graph's resting anchors. */
export function createSkillWebLayout() {
  const points = NODES.map((node, index) => {
    const stage = Math.floor(index / 4), within = index % 4;
    const angle = -Math.PI * .75 + stage * Math.PI / 4;
    const cx = 650 + Math.cos(angle) * 438, cy = 440 + Math.sin(angle) * 270;
    const x = cx + (within % 2 ? 102 : -102), y = cy + (within < 2 ? -47 : 47);
    return { id: node.id, stageId: node.stageId, x, y, ax: x, ay: y };
  });
  const lookup = new Map(points.map((point, index) => [point.id, index]));
  for (let iteration = 0; iteration < 160; iteration++) {
    const delta = points.map(point => ({ x: (point.ax - point.x) * .025, y: (point.ay - point.y) * .025 }));
    for (const link of WEB_LINKS) {
      const a = lookup.get(link.from), b = lookup.get(link.to), dx = points[b].x - points[a].x, dy = points[b].y - points[a].y;
      const distance = Math.max(1, Math.hypot(dx, dy)), desired = points[a].stageId === points[b].stageId ? 170 : 340;
      const spring = (distance - desired) * .0025 / distance;
      delta[a].x += dx * spring; delta[a].y += dy * spring; delta[b].x -= dx * spring; delta[b].y -= dy * spring;
    }
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y;
      const overlapX = WEB_NODE_W + 23 - Math.abs(dx), overlapY = WEB_NODE_H + 17 - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;
      if (overlapX < overlapY) {
        const push = (dx >= 0 ? 1 : -1) * overlapX * .35; delta[a].x -= push; delta[b].x += push;
      } else {
        const push = (dy >= 0 ? 1 : -1) * overlapY * .35; delta[a].y -= push; delta[b].y += push;
      }
    }
    points.forEach((point, index) => { point.x += clamp(delta[index].x, -9, 9); point.y += clamp(delta[index].y, -9, 9); });
  }
  const minX = Math.min(...points.map(point => point.x)) - WEB_NODE_W / 2 - 32;
  const minY = Math.min(...points.map(point => point.y)) - 32;
  const maxX = Math.max(...points.map(point => point.x)) + WEB_NODE_W / 2 + 32;
  const maxY = Math.max(...points.map(point => point.y)) + WEB_NODE_H + 32;
  const nodes = new Map(points.map(point => [point.id, { x: point.x - minX - WEB_NODE_W / 2, y: point.y - minY, width: WEB_NODE_W, height: WEB_NODE_H, stageId: point.stageId }]));
  return { width: maxX - minX, height: maxY - minY, nodes, columns: 0, stages: [], type: 'web' };
}

/** Local DOM/SVG graph. Only the active web view has a small, pausable motion loop. */
export function mountSkillMap(container, { onProject = () => {}, onContact = () => {} } = {}) {
  const uid = `pm-map-${++instanceId}`;
  let disposed = false, active = true, lens = 'all', selected = null, view = 'map';
  let scale = 1, tx = 0, ty = 0, layout = null, initialized = false, measuredWidth = 0, measuredHeight = 0, manualView = false;
  let pan = null, pinch = null, dragged = false, suppressClickUntil = 0, webLayout = null;
  let webPhysics = null, webRAF = 0, webLast = 0, webFrameCount = 0;
  let hoverPoint = null, hoveredNode = null, nodeDrag = null;
  let hoverVelocity = { x: 0, y: 0 }, hoverTime = 0, hoverSequence = 0;
  let webElements = new Map(), webEdges = [];
  const pointers = new Map(), expanded = new Set([PM_STAGES[0].id]);
  container.innerHTML = `<section class="pm-map" aria-label="Карта навыков и продуктового цикла" data-view="map"><header class="pm-topbar"><nav class="pm-lenses" aria-label="Задача">${LENSES.map(([id, title]) => `<button type="button" data-pm-lens="${id}" aria-pressed="${id === 'all'}">${title}</button>`).join('')}</nav><div class="pm-display" role="group" aria-label="Представление"><button type="button" data-pm-action="map" aria-pressed="true">Схема</button><button type="button" data-pm-action="web" aria-pressed="false">Паутина</button><button type="button" data-pm-action="list" aria-pressed="false">Список</button></div><div class="pm-zoom" role="group" aria-label="Масштаб схемы"><button type="button" data-pm-action="zoom-out" aria-label="Уменьшить">−</button><output class="pm-scale" aria-label="Масштаб">100%</output><button type="button" data-pm-action="zoom-in" aria-label="Увеличить">+</button><button type="button" data-pm-action="fit">Вся карта</button></div></header><div class="pm-content"><div class="pm-viewport" tabindex="0" role="region" aria-label="Схема. Можно перемещать мышью и стрелками, менять масштаб кнопками"><div class="pm-world"></div></div><div class="pm-list" hidden aria-label="Навыки по этапам"></div><aside class="pm-detail" hidden aria-labelledby="${uid}-detail-title"></aside></div></section>`;
  const root = container.querySelector('.pm-map');
  const viewport = root.querySelector('.pm-viewport');
  const world = root.querySelector('.pm-world');
  const list = root.querySelector('.pm-list');
  const detail = root.querySelector('.pm-detail');
  const osHost = root.closest('.retro-os');
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const small = () => root.clientWidth < 520;
  const columnsForSize = () => small() && root.querySelector('.pm-content').clientHeight > root.clientWidth ? 2 : 4;
  const defaultView = () => small() || root.clientHeight < 360 ? 'list' : 'map';

  function motionReason() {
    if (disposed) return 'disposed';
    if (!active) return 'inactive';
    if (document.hidden) return 'hidden';
    if (motionQuery.matches || document.body?.classList.contains('motion-off') || osHost?.classList.contains('os-reduce-motion')) return 'reduced';
    if (view !== 'web' || !webPhysics) return 'other-view';
    return 'running';
  }
  function paintWebMotion() {
    if (!webPhysics) return;
    for (const point of webPhysics.points) {
      const cached = webElements.get(point.id); if (!cached) continue;
      cached.node.style.transform = `translate3d(${point.x.toFixed(2)}px,${point.y.toFixed(2)}px,0)`;
      cached.node.style.setProperty('--pm-pulse', point.pulse.toFixed(3));
      if (cached.dot) cached.dot.style.transform = `scale(${(1 + point.pulse * .16).toFixed(3)})`;
    }
    for (const edge of webEdges) {
      const a = edge.from, b = edge.to;
      edge.node.setAttribute('d', `M${(a.ax + a.x).toFixed(2)} ${(a.ay + a.y).toFixed(2)}L${(b.ax + b.x).toFixed(2)} ${(b.ay + b.y).toFixed(2)}`);
    }
    root.dataset.webFrame = String(++webFrameCount);
    root.dataset.webResponse = (Math.max(0, ...webPhysics.points.map(point => Math.hypot(point.x, point.y))) * scale).toFixed(1);
  }
  function stopWebMotion({ reset = false } = {}) {
    cancelAnimationFrame(webRAF); webRAF = 0; webLast = 0;
    if (reset && webPhysics) { webPhysics.reset(); paintWebMotion(); }
  }
  function webFrame(now) {
    webRAF = 0;
    if (motionReason() !== 'running') { syncWebMotion(); return; }
    const delta = webLast ? Math.min((now - webLast) / 1000, 1 / 30) : 1 / 60;
    webLast = now;
    const pointer = hoverPoint && !pan ? { x: (hoverPoint.x - tx) / scale, y: (hoverPoint.y - ty) / scale, vx: hoverVelocity.x, vy: hoverVelocity.y } : null;
    webPhysics.step(delta, { pointer, hoveredId: hoveredNode, selectedId: selected, pointerRadius: clamp(235 / scale, 250, 480) });
    const decay = Math.exp(-delta * 11); hoverVelocity.x *= decay; hoverVelocity.y *= decay;
    paintWebMotion(); webRAF = requestAnimationFrame(webFrame);
  }
  function syncWebMotion() {
    const reason = motionReason(); root.dataset.webMotion = reason;
    if (reason === 'running') { if (!webRAF) { webLast = 0; webRAF = requestAnimationFrame(webFrame); } }
    else stopWebMotion({ reset: reason === 'reduced' });
  }
  function prepareWebMotion() {
    webPhysics = createSkillWebPhysics(layout, WEB_LINKS);
    webElements = new Map([...world.querySelectorAll('.pm-web-node')].map(node => [node.dataset.pmNode, { node, dot: node.querySelector('.pm-web-dot') }]));
    const points = new Map(webPhysics.points.map(point => [point.id, point]));
    webEdges = [...world.querySelectorAll('.pm-web-link')].map(node => ({ node, from: points.get(node.dataset.pmFrom), to: points.get(node.dataset.pmTo) }));
    paintWebMotion();
  }
  function localPointer(event) {
    const bounds = viewport.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * viewport.clientWidth / Math.max(1, bounds.width), y: (event.clientY - bounds.top) * viewport.clientHeight / Math.max(1, bounds.height) };
  }
  function clearHover() {
    hoverPoint = null; hoveredNode = null; hoverTime = 0; hoverVelocity.x = hoverVelocity.y = 0;
    root.dataset.webPointer = 'none'; delete root.dataset.webPointerWorld;
  }
  function trackHover(event, cursor) {
    const now = Number.isFinite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : performance.now();
    const delta = (now - hoverTime) / 1000;
    if (hoverPoint && delta > 0 && delta < .25) {
      const dt = Math.max(delta, 1 / 120);
      const vx = clamp((cursor.x - hoverPoint.x) / dt / scale, -2400, 2400);
      const vy = clamp((cursor.y - hoverPoint.y) / dt / scale, -2400, 2400);
      hoverVelocity.x = hoverVelocity.x * .35 + vx * .65; hoverVelocity.y = hoverVelocity.y * .35 + vy * .65;
    } else { hoverVelocity.x = hoverVelocity.y = 0; }
    hoverPoint = cursor; hoverTime = now; hoveredNode = event.target.closest('.pm-web-node')?.dataset.pmNode || null;
    root.dataset.webPointer = event.buttons ? 'pressed' : 'hover';
    root.dataset.webHoverSeq = String(++hoverSequence);
    root.dataset.webPointerWorld = `${((cursor.x - tx) / scale).toFixed(1)},${((cursor.y - ty) / scale).toFixed(1)}`;
  }

  function makeLayout() {
    const columns = columnsForSize(), rows = Math.ceil(PM_STAGES.length / columns);
    const width = 64 + columns * GROUP_W + (columns - 1) * 32;
    const height = 76 + rows * GROUP_H + (rows - 1) * 74;
    const stages = PM_STAGES.map((stage, index) => {
      const row = Math.floor(index / columns), position = index % columns;
      const column = row % 2 ? columns - 1 - position : position;
      return { ...stage, x: 32 + column * 252, y: 38 + row * 262, row, column };
    });
    const nodes = new Map();
    for (const stage of stages) stage.nodes.forEach((node, index) => nodes.set(node.id, { x: stage.x + 12, y: stage.y + 38 + index * 38, stageId: stage.id }));
    return { width, height, stages, nodes, columns, type: 'map' };
  }
  function edgePath(from, to, route) {
    return `<path class="pm-connection" data-pm-from="${from}" data-pm-to="${to}" d="${route}"/>`;
  }
  function graphMarkup() {
    const paths = [];
    for (let index = 0; index < layout.stages.length; index++) {
      const stage = layout.stages[index];
      for (let n = 0; n < stage.nodes.length - 1; n++) {
        const from = layout.nodes.get(stage.nodes[n].id), to = layout.nodes.get(stage.nodes[n + 1].id);
        paths.push(edgePath(stage.nodes[n].id, stage.nodes[n + 1].id, `M${from.x + NODE_W / 2} ${from.y + NODE_H}V${to.y}`));
      }
      const lastId = stage.nodes.at(-1).id, from = layout.nodes.get(lastId), startX = from.x + NODE_W / 2, startY = from.y + NODE_H;
      const next = layout.stages[(index + 1) % layout.stages.length], firstId = next.nodes[0].id, to = layout.nodes.get(firstId);
      let route;
      if (index === layout.stages.length - 1) route = `M${startX} ${startY}V${layout.height - 12}H12V${to.y + NODE_H / 2}H${to.x}`;
      else if (stage.row === next.row) {
        const rightward = next.x > stage.x, aisle = rightward ? next.x - 12 : next.x + GROUP_W + 12;
        route = `M${startX} ${startY}V${stage.y + GROUP_H + 18}H${aisle}V${to.y + NODE_H / 2}H${rightward ? to.x : to.x + NODE_W}`;
      } else {
        const right = stage.column === layout.columns - 1, aisle = stage.x + (right ? GROUP_W + 12 : -12);
        route = `M${startX} ${startY}V${stage.y + GROUP_H + 18}H${aisle}V${to.y + NODE_H / 2}H${right ? to.x + NODE_W : to.x}`;
      }
      paths.push(`<g class="pm-stage-connection" data-pm-stage-from="${stage.id}" data-pm-stage-to="${next.id}">${edgePath(lastId, firstId, route).replace('/>', ` marker-end="url(#${uid}-arrow)"/>`)}</g>`);
    }
    const overviewPaths = layout.stages.map((stage, index) => {
      const next = layout.stages[(index + 1) % layout.stages.length]; let route;
      if (index === layout.stages.length - 1) route = `M${stage.x} ${stage.y + GROUP_H / 2}H12V${next.y + GROUP_H / 2}H${next.x}`;
      else if (stage.row !== next.row) route = `M${stage.x + GROUP_W / 2} ${stage.y + GROUP_H}V${next.y}`;
      else {
        const rightward = next.x > stage.x;
        route = `M${stage.x + (rightward ? GROUP_W : 0)} ${stage.y + GROUP_H / 2}H${next.x + (rightward ? 0 : GROUP_W)}`;
      }
      return `<path class="pm-overview-connection" data-pm-stage-from="${stage.id}" data-pm-stage-to="${next.id}" d="${route}" marker-end="url(#${uid}-arrow)"/>`;
    });
    return `<svg class="pm-wires" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true"><defs><marker id="${uid}-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 4 2.5 0 5" fill="none" stroke="context-stroke" stroke-width="1"/></marker></defs>${paths.join('')}${overviewPaths.join('')}</svg>${layout.stages.map(stage => `<section class="pm-stage" data-pm-stage="${stage.id}" style="left:${stage.x}px;top:${stage.y}px;width:${GROUP_W}px;height:${GROUP_H}px"><button type="button" class="pm-stage-label" data-pm-stage-zoom="${stage.id}">${esc(stage.title)}</button>${stage.nodes.map(node => `<button type="button" class="pm-node" data-pm-node="${node.id}" aria-pressed="false"><span>${esc(node.title)}</span></button>`).join('')}</section>`).join('')}`;
  }
  function webMarkup() {
    const lines = WEB_LINKS.map(link => {
      const from = layout.nodes.get(link.from), to = layout.nodes.get(link.to);
      return `<path class="pm-web-link" data-pm-from="${link.from}" data-pm-to="${link.to}" d="M${from.x + WEB_NODE_W / 2} ${from.y + 4}L${to.x + WEB_NODE_W / 2} ${to.y + 4}"><title>${esc(link.reason)}</title></path>`;
    }).join('');
    return `<svg class="pm-wires" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${lines}</svg>${NODES.map(node => { const point = layout.nodes.get(node.id); return `<button type="button" class="pm-web-node" data-pm-node="${node.id}" data-pm-stage="${node.stageId}" style="left:${point.x}px;top:${point.y}px;width:${WEB_NODE_W}px;height:${WEB_NODE_H}px" aria-label="${esc(node.title)}" aria-pressed="false"><i class="pm-web-dot" aria-hidden="true"></i><span>${esc(node.title)}</span></button>`; }).join('')}`;
  }
  function renderWorld() {
    stopWebMotion(); webPhysics = null; webElements = new Map(); webEdges = []; clearHover();
    layout = view === 'web' ? (webLayout ||= createSkillWebLayout()) : makeLayout();
    world.style.width = `${layout.width}px`; world.style.height = `${layout.height}px`;
    world.innerHTML = view === 'web' ? webMarkup() : graphMarkup(); applyLens(); paintSelection();
    if (view === 'web') prepareWebMotion();
    syncWebMotion();
  }
  function usableRect() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!selected || detail.hidden) return { x: 0, y: 0, width, height };
    // Both are siblings in pm-content: offsets stay correct under the laptop's 3D projection.
    if (detail.offsetWidth > width * .7) return { x: 0, y: 0, width, height: clamp(detail.offsetTop - 12, 45, height) };
    return { x: 0, y: 0, width: clamp(detail.offsetLeft - 16, 110, width), height };
  }
  function paintTransform() {
    if (disposed || !layout) return;
    world.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    world.style.setProperty('--pm-scale', String(scale));
    root.dataset.overview = String(view === 'map' && scale < .68);
    root.dataset.webOverview = String(view === 'web' && scale < .45);
    root.querySelector('.pm-scale').textContent = `${Math.round(scale * 100)}%`;
  }
  function boundPan() {
    const area = usableRect(), marginX = Math.min(48, area.width / 4), marginY = Math.min(40, area.height / 4);
    // Each world edge may reach the unoccluded area, including the far-right edge behind a card.
    tx = clamp(tx, area.x + marginX - layout.width * scale, area.x + area.width - marginX);
    ty = clamp(ty, area.y + marginY - layout.height * scale, area.y + area.height - marginY);
  }
  function fit() {
    if (!layout || !viewport.clientWidth || !viewport.clientHeight) return;
    const area = usableRect();
    scale = clamp(Math.min((area.width - 16) / layout.width, (area.height - 16) / layout.height), .2, 1);
    tx = area.x + (area.width - layout.width * scale) / 2; ty = area.y + (area.height - layout.height * scale) / 2;
    paintTransform();
  }
  function zoomTo(value, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
    const next = clamp(value, .24, 1.8), ratio = next / scale;
    tx = x - (x - tx) * ratio; ty = y - (y - ty) * ratio; scale = next;
    boundPan(); paintTransform();
  }
  function zoomStage(id) {
    const stage = layout.stages.find(item => item.id === id); if (!stage) return;
    scale = clamp(Math.min((viewport.clientWidth - 40) / GROUP_W, (viewport.clientHeight - 30) / GROUP_H), .75, 1.35);
    tx = (viewport.clientWidth - GROUP_W * scale) / 2 - stage.x * scale;
    ty = (viewport.clientHeight - GROUP_H * scale) / 2 - stage.y * scale;
    paintTransform();
  }
  function ensureVisible(id) {
    if (view === 'list') return;
    const point = layout.nodes.get(id); if (!point) return;
    if (view === 'map' && scale < .68) zoomStage(point.stageId);
    const area = usableRect(), width = point.width || NODE_W, height = point.height || NODE_H;
    const offset = view === 'web' ? webPhysics?.getOffset(id) : null;
    const pointX = point.x + (offset?.x || 0), pointY = point.y + (offset?.y || 0);
    const left = pointX * scale + tx, top = pointY * scale + ty;
    const right = left + width * scale, bottom = top + height * scale;
    if (width * scale > area.width - 24) tx = area.x + area.width / 2 - (pointX + width / 2) * scale;
    else if (left < area.x + 12) tx += area.x + 12 - left;
    else if (right > area.x + area.width - 12) tx -= right - area.x - area.width + 12;
    if (height * scale > area.height - 20) ty = area.y + area.height / 2 - (pointY + height / 2) * scale;
    else if (top < area.y + 10) ty += area.y + 10 - top;
    else if (bottom > area.y + area.height - 10) ty -= bottom - area.y - area.height + 10;
    paintTransform();
  }
  function applyLens() {
    const stages = new Set(PM_LENSES[lens]);
    root.querySelectorAll('[data-pm-lens]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pmLens === lens)));
    world.querySelectorAll('[data-pm-stage]').forEach(group => group.classList.toggle('is-muted', !stages.has(group.dataset.pmStage)));
    world.querySelectorAll('.pm-connection').forEach(path => {
      const from = BY_ID.get(path.dataset.pmFrom), to = BY_ID.get(path.dataset.pmTo);
      path.classList.toggle('is-muted', !stages.has(from.stageId) || !stages.has(to.stageId));
    });
    world.querySelectorAll('.pm-overview-connection').forEach(path => path.classList.toggle('is-muted', !stages.has(path.dataset.pmStageFrom) || !stages.has(path.dataset.pmStageTo)));
    world.querySelectorAll('.pm-web-link').forEach(path => path.classList.toggle('is-muted', !stages.has(BY_ID.get(path.dataset.pmFrom).stageId) || !stages.has(BY_ID.get(path.dataset.pmTo).stageId)));
    list.querySelectorAll('[data-pm-list-stage]').forEach(group => { group.hidden = !stages.has(group.dataset.pmListStage); });
  }
  function listMarkup() {
    return PM_STAGES.map(stage => `<section class="pm-list-stage" data-pm-list-stage="${stage.id}"><button type="button" class="pm-list-heading" data-pm-list-toggle="${stage.id}" aria-expanded="${expanded.has(stage.id)}">${esc(stage.title)}<span aria-hidden="true">${expanded.has(stage.id) ? '−' : '+'}</span></button><div class="pm-list-nodes" ${expanded.has(stage.id) ? '' : 'hidden'}>${stage.nodes.map(node => `<button type="button" class="pm-list-node" data-pm-node="${node.id}" aria-pressed="false">${esc(node.title)}<span aria-hidden="true">↗</span></button>`).join('')}</div></section>`).join('');
  }
  function paintSelection() {
    root.querySelectorAll('[data-pm-node]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pmNode === selected)));
    world.querySelectorAll('.pm-connection').forEach(path => path.classList.toggle('is-near', Boolean(selected && (path.dataset.pmFrom === selected || path.dataset.pmTo === selected))));
    world.querySelectorAll('.pm-web-link').forEach(path => {
      const near = Boolean(selected && (path.dataset.pmFrom === selected || path.dataset.pmTo === selected));
      path.classList.toggle('is-near', near); path.classList.toggle('is-away', Boolean(selected && !near));
    });
    world.querySelectorAll('.pm-web-node').forEach(button => {
      const near = Boolean(selected && NEIGHBORS.get(selected).has(button.dataset.pmNode));
      button.classList.toggle('is-neighbor', near);
      button.classList.toggle('is-away', Boolean(selected && button.dataset.pmNode !== selected && !near));
    });
  }
  function neighborMarkup(id) {
    if (view !== 'web') return '';
    return `<section class="pm-related pm-related-skills"><h3>Связанные задачи</h3>${[...NEIGHBORS.get(id)].map(other => `<button type="button" data-pm-related-node="${other}">${esc(BY_ID.get(other).title)}<span aria-hidden="true">↗</span></button>`).join('')}</section>`;
  }
  function showDetail(id, focus = false) {
    const node = BY_ID.get(id); if (!node) return;
    selected = id; detail.hidden = false; root.classList.add('has-detail');
    detail.innerHTML = `<header class="pm-detail-heading"><div><p>${esc(node.stageTitle)}</p><h2 id="${uid}-detail-title" tabindex="-1">${esc(node.title)}</h2></div><button type="button" data-pm-action="close" aria-label="Закрыть описание">×</button></header><div class="pm-detail-body"><p class="pm-detail-action">${esc(node.action)}</p><dl><dt>На выходе</dt><dd>${esc(node.artifact)}</dd><dt>Как работаю</dt><dd>${node.methods.map(esc).join(' · ')}</dd></dl>${node.projectIds.length ? `<section class="pm-related"><h3>В архиве</h3>${node.projectIds.map(projectId => { const project = getProject(projectId); return project ? `<button type="button" data-pm-project="${projectId}">${esc(project.title)}<span aria-hidden="true">↗</span></button>` : ''; }).join('')}</section>` : ''}${neighborMarkup(id)}<button type="button" class="pm-contact" data-pm-action="contact">Обсудить задачу <span aria-hidden="true">↗</span></button></div>`;
    if (view === 'web' && scale < .45) {
      const point = layout.nodes.get(id);
      zoomTo(.64, tx + (point.x + point.width / 2) * scale, ty + (point.y + 4) * scale);
    }
    paintSelection(); ensureVisible(id); if (focus) detail.querySelector('h2').focus({ preventScroll: true });
  }
  function closeDetail({ focus = true } = {}) {
    const id = selected; selected = null; detail.hidden = true; root.classList.remove('has-detail'); paintSelection();
    if (focus && id) (view !== 'list' ? world : list).querySelector(`[data-pm-node="${id}"]`)?.focus({ preventScroll: true });
  }
  function setView(value) {
    resetGesture();
    view = value; root.dataset.view = value; viewport.hidden = value === 'list'; list.hidden = value !== 'list';
    root.querySelectorAll('[data-pm-action="map"],[data-pm-action="web"],[data-pm-action="list"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pmAction === view)));
    closeDetail({ focus: false });
    if (view !== 'list' && layout?.type !== view) renderWorld();
    if (view !== 'list') fit();
    syncWebMotion();
  }
  function rebuild() {
    if (disposed || !active || !root.clientWidth) return;
    const columns = columnsForSize();
    const changedLayout = !layout || layout.type !== (view === 'web' ? 'web' : 'map') || (view !== 'web' && columns !== layout.columns);
    const changedSize = root.clientWidth !== measuredWidth || root.clientHeight !== measuredHeight;
    measuredWidth = root.clientWidth; measuredHeight = root.clientHeight;
    if (changedSize) clearHover();
    if (changedLayout) {
      renderWorld();
    }
    if (!initialized) { initialized = true; setView(defaultView()); }
    else if (!manualView && view !== defaultView()) setView(defaultView());
    else if (view !== 'list' && (changedSize || changedLayout)) fit();
  }
  function click(event) {
    if (!active || disposed) return;
    if (performance.now() < suppressClickUntil && event.target.closest('.pm-viewport')) { event.preventDefault(); return; }
    const lensButton = event.target.closest('[data-pm-lens]');
    if (lensButton) { lens = lensButton.dataset.pmLens; applyLens(); return; }
    const node = event.target.closest('[data-pm-node]');
    if (node) { showDetail(node.dataset.pmNode, event.detail === 0); return; }
    const relatedNode = event.target.closest('[data-pm-related-node]');
    if (relatedNode) { showDetail(relatedNode.dataset.pmRelatedNode, true); return; }
    const stage = event.target.closest('[data-pm-stage-zoom]');
    if (stage) { zoomStage(stage.dataset.pmStageZoom); return; }
    const group = event.target.closest('[data-pm-list-toggle]');
    if (group) {
      const id = group.dataset.pmListToggle; if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      group.setAttribute('aria-expanded', String(expanded.has(id))); group.querySelector('span').textContent = expanded.has(id) ? '−' : '+';
      group.nextElementSibling.hidden = !expanded.has(id); return;
    }
    const project = event.target.closest('[data-pm-project]');
    if (project) { onProject(project.dataset.pmProject); return; }
    const action = event.target.closest('[data-pm-action]')?.dataset.pmAction;
    if (action === 'map' || action === 'web' || action === 'list') { manualView = true; setView(action); }
    if (action === 'zoom-in') zoomTo(scale * 1.2);
    if (action === 'zoom-out') zoomTo(scale / 1.2);
    if (action === 'fit') fit();
    if (action === 'close') closeDetail();
    if (action === 'contact') onContact();
  }
  function focusIn(event) {
    if (event.target.matches('[data-pm-node]:focus-visible') && event.target.closest('.pm-world')) ensureVisible(event.target.dataset.pmNode);
  }
  function keydown(event) {
    if (!active) return;
    if ((event.key === 'Escape' || event.key === 'Backspace') && selected) { event.preventDefault(); event.stopPropagation(); closeDetail(); return; }
    const node = event.target.closest('[data-pm-node]');
    if (node && event.target.closest('.pm-world') && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const index = NODES.findIndex(item => item.id === node.dataset.pmNode);
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 4 : -4;
      const next = NODES[clamp(index + step, 0, NODES.length - 1)];
      world.querySelector(`[data-pm-node="${next.id}"]`)?.focus({ preventScroll: true }); return;
    }
    if (event.target !== viewport) return;
    const keys = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] };
    if (keys[event.key]) { event.preventDefault(); event.stopPropagation(); tx += keys[event.key][0]; ty += keys[event.key][1]; boundPan(); paintTransform(); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomTo(scale * 1.2); }
    if (event.key === '-') { event.preventDefault(); zoomTo(scale / 1.2); }
    if (event.key === '0') { event.preventDefault(); fit(); }
  }
  function pointerDown(event) {
    if (!active || view === 'list' || event.button > 0) return;
    const cursor = localPointer(event);
    pointers.set(event.pointerId, cursor);
    const node = view === 'web' ? event.target.closest('.pm-web-node') : null;
    if (node && event.pointerType !== 'touch' && motionReason() === 'running') {
      const id = node.dataset.pmNode, offset = webPhysics.getOffset(id);
      nodeDrag = { id, pointerId: event.pointerId, x: (cursor.x - tx) / scale, y: (cursor.y - ty) / scale, offset };
      pan = null; dragged = false; return;
    }
    if (pointers.size === 2) {
      const points = [...pointers.values()];
      pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale, x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      pan = null; dragged = true; return;
    }
    if (pointers.size === 1) { pan = { id: event.pointerId, x: cursor.x, y: cursor.y, tx, ty }; dragged = false; }
  }
  function pointerMove(event) {
    if (!active || view === 'list') return;
    const cursor = localPointer(event);
    if (view === 'web' && event.pointerType !== 'touch') trackHover(event, cursor);
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, cursor);
    if (nodeDrag?.pointerId === event.pointerId) {
      const x = (cursor.x - tx) / scale - nodeDrag.x, y = (cursor.y - ty) / scale - nodeDrag.y;
      if (Math.hypot(x, y) * scale > 4) { dragged = true; viewport.setPointerCapture?.(event.pointerId); root.dataset.webDragging = 'true'; }
      if (dragged) { webPhysics.setDrag(nodeDrag.id, nodeDrag.offset.x + x, nodeDrag.offset.y + y); event.preventDefault(); }
      return;
    }
    if (pinch && pointers.size === 2) {
      const points = [...pointers.values()], distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      zoomTo(pinch.scale * distance / Math.max(1, pinch.distance), pinch.x, pinch.y); event.preventDefault(); return;
    }
    if (!pan || pan.id !== event.pointerId) return;
    const x = cursor.x - pan.x, y = cursor.y - pan.y;
    if (Math.hypot(x, y) > 4) { dragged = true; viewport.classList.add('is-panning'); viewport.setPointerCapture?.(event.pointerId); }
    if (dragged) { tx = pan.tx + x; ty = pan.ty + y; boundPan(); paintTransform(); event.preventDefault(); }
  }
  function pointerEnd(event) {
    if (nodeDrag?.pointerId === event.pointerId) { webPhysics?.releaseDrag(); nodeDrag = null; root.dataset.webDragging = 'false'; }
    pointers.delete(event.pointerId);
    if (dragged) suppressClickUntil = performance.now() + 220;
    if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (!pointers.size) { pan = pinch = null; viewport.classList.remove('is-panning'); }
    else if (pointers.size === 1) {
      const [id, point] = pointers.entries().next().value; pinch = null; pan = { id, x: point.x, y: point.y, tx, ty };
    }
  }
  function lostCapture(event) { if (event.target === viewport) pointerEnd(event); }
  function pointerLeave() { clearHover(); }
  function wheel(event) {
    if (!active || view === 'list') return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const cursor = localPointer(event); zoomTo(scale * Math.exp(-event.deltaY * .002), cursor.x, cursor.y);
    } else { tx -= event.shiftKey ? event.deltaY : event.deltaX; ty -= event.shiftKey ? event.deltaX : event.deltaY; boundPan(); paintTransform(); }
  }
  function resetGesture() {
    for (const id of pointers.keys()) if (viewport.hasPointerCapture?.(id)) viewport.releasePointerCapture(id);
    pointers.clear(); pan = pinch = nodeDrag = null; dragged = false; clearHover();
    webPhysics?.releaseDrag(); root.dataset.webDragging = 'false'; viewport.classList.remove('is-panning');
  }
  function visibility() { if (document.hidden) resetGesture(); syncWebMotion(); }
  function motionChanged() { resetGesture(); syncWebMotion(); }
  list.innerHTML = listMarkup();
  root.addEventListener('click', click); root.addEventListener('keydown', keydown); root.addEventListener('focusin', focusIn);
  viewport.addEventListener('pointerdown', pointerDown); viewport.addEventListener('pointermove', pointerMove);
  viewport.addEventListener('pointerleave', pointerLeave);
  viewport.addEventListener('pointerup', pointerEnd); viewport.addEventListener('pointercancel', pointerEnd); viewport.addEventListener('lostpointercapture', lostCapture);
  viewport.addEventListener('wheel', wheel, { passive: false }); document.addEventListener('visibilitychange', visibility);
  motionQuery.addEventListener?.('change', motionChanged);
  const motionObserver = typeof MutationObserver === 'function' ? new MutationObserver(motionChanged) : null;
  if (document.body) motionObserver?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (osHost && osHost !== document.body) motionObserver?.observe(osHost, { attributes: true, attributeFilter: ['class'] });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(rebuild) : null;
  observer?.observe(root); if (!observer) window.addEventListener('resize', rebuild);
  rebuild();
  return {
    setActive(value) { const next = Boolean(value); if (next === active) return; active = next; if (!active) resetGesture(); else rebuild(); syncWebMotion(); },
    dispose() {
      if (disposed) return; disposed = true; resetGesture(); stopWebMotion(); observer?.disconnect(); motionObserver?.disconnect();
      webPhysics = null; webElements.clear(); webEdges = [];
      if (!observer) window.removeEventListener('resize', rebuild);
      document.removeEventListener('visibilitychange', visibility);
      motionQuery.removeEventListener?.('change', motionChanged);
      root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); root.removeEventListener('focusin', focusIn);
      viewport.removeEventListener('pointerdown', pointerDown); viewport.removeEventListener('pointermove', pointerMove);
      viewport.removeEventListener('pointerleave', pointerLeave);
      viewport.removeEventListener('pointerup', pointerEnd); viewport.removeEventListener('pointercancel', pointerEnd); viewport.removeEventListener('lostpointercapture', lostCapture); viewport.removeEventListener('wheel', wheel);
      container.replaceChildren();
    }
  };
}
