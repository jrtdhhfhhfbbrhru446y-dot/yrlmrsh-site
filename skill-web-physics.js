const limit = (value, min, max) => Math.max(min, Math.min(max, value));

/** Small offsets around the established layout; the original anchors never change. */
export function createSkillWebPhysics(layout, links, { maxOffset = 44 } = {}) {
  const points = [...layout.nodes].map(([id, point], index) => ({
    id, ax: point.x + point.width / 2, ay: point.y + 4,
    width: point.width, height: point.height,
    x: 0, y: 0, vx: 0, vy: 0,
    phase: index * 2.3999632297, frequency: .36 + (index % 5) * .047,
    pulse: 0,
  }));
  const byId = new Map(points.map(point => [point.id, point]));
  const springs = links.map(link => [byId.get(link.from), byId.get(link.to)]).filter(pair => pair.every(Boolean));
  let time = 0, drag = null;

  function bounded(x, y) {
    const distance = Math.hypot(x, y), ratio = distance > maxOffset ? maxOffset / distance : 1;
    return { x: x * ratio, y: y * ratio };
  }
  function step(delta, { pointer = null, hoveredId = null, selectedId = null, pointerRadius = 360 } = {}) {
    const dt = limit(Number.isFinite(delta) ? delta : 0, 0, 1 / 30);
    if (!dt) return points;
    time += dt;
    const forces = new Map();
    for (const point of points) {
      const held = point.id === hoveredId || point.id === selectedId;
      const amplitude = held ? .65 : 5.8;
      const targetX = Math.sin(time * point.frequency + point.phase) * amplitude + Math.sin(time * .71 + point.phase * .37) * amplitude * .24;
      const targetY = Math.cos(time * point.frequency * .83 + point.phase) * amplitude * .72;
      const spring = held ? 28 : 18;
      const force = { x: (targetX - point.x) * spring - point.vx * 8.8, y: (targetY - point.y) * spring - point.vy * 8.8 };
      if (pointer && !held && point.id !== drag?.id) {
        let dx = point.ax + point.x - pointer.x, dy = point.ay + point.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < pointerRadius) {
          if (distance < .1) { dx = Math.cos(point.phase); dy = Math.sin(point.phase); }
          const influence = (1 - distance / pointerRadius) ** 1.35;
          const push = 1320 * influence / Math.max(1, Math.hypot(dx, dy));
          force.x += dx * push; force.y += dy * push;
          // A short wake makes a free-moving cursor tug the connected field, without a click.
          force.x += limit(Number.isFinite(pointer.vx) ? pointer.vx : 0, -2400, 2400) * .46 * influence;
          force.y += limit(Number.isFinite(pointer.vy) ? pointer.vy : 0, -2400, 2400) * .46 * influence;
        }
      }
      forces.set(point.id, force);
      point.pulse = .5 + .5 * Math.sin(time * .98 + point.phase);
    }
    // Links pass a small movement on to neighbours without pulling the balanced map into a knot.
    for (const [a, b] of springs) {
      const fx = (b.x - a.x) * 1.5, fy = (b.y - a.y) * 1.5;
      forces.get(a.id).x += fx; forces.get(a.id).y += fy;
      forces.get(b.id).x -= fx; forces.get(b.id).y -= fy;
    }
    // Keep nearby label rectangles apart while a node is being nudged.
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      const p = points[a], q = points[b], dx = q.ax + q.x - p.ax - p.x, dy = q.ay + q.y - p.ay - p.y;
      const overlapX = (p.width + q.width) / 2 + 7 - Math.abs(dx);
      const overlapY = (p.height + q.height) / 2 + 8 - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;
      const force = Math.min(520, Math.min(overlapX, overlapY) * 24);
      if (overlapX < overlapY) {
        const direction = dx >= 0 ? 1 : -1;
        forces.get(p.id).x -= direction * force; forces.get(q.id).x += direction * force;
      } else {
        const direction = dy >= 0 ? 1 : -1;
        forces.get(p.id).y -= direction * force; forces.get(q.id).y += direction * force;
      }
    }
    for (const point of points) {
      if (drag?.id === point.id) {
        point.x = drag.x; point.y = drag.y; point.vx = point.vy = 0; continue;
      }
      const force = forces.get(point.id);
      point.vx = limit(point.vx + force.x * dt, -115, 115);
      point.vy = limit(point.vy + force.y * dt, -115, 115);
      const next = bounded(point.x + point.vx * dt, point.y + point.vy * dt);
      if (Math.hypot(next.x, next.y) >= maxOffset - .01) { point.vx *= .65; point.vy *= .65; }
      point.x = next.x; point.y = next.y;
    }
    return points;
  }
  return {
    points,
    step,
    getOffset(id) { const point = byId.get(id); return point ? { x: point.x, y: point.y } : { x: 0, y: 0 }; },
    setDrag(id, x, y) { if (byId.has(id)) drag = { id, ...bounded(x, y) }; },
    releaseDrag() { drag = null; },
    reset() {
      drag = null;
      for (const point of points) { point.x = point.y = point.vx = point.vy = point.pulse = 0; }
    },
  };
}
