/**
 * Smooth an extruded radio part without welding its actual vertices. UV seams,
 * material groups and the non-indexed layout remain intact. Each distinct face
 * direction gets one vote, so a large cap or its triangulation cannot outweigh
 * the small faces around a bevel.
 */
export function smoothRadioNormals(geometry) {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize < 3 || !position.count) return geometry;

  let normal = geometry.getAttribute('normal');
  if (!normal || normal.count !== position.count) {
    geometry.computeVertexNormals();
    normal = geometry.getAttribute('normal');
  }
  if (!normal) return geometry;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  if (!Number.isFinite(extent)) return geometry;
  // Much smaller than the smallest moulded detail; enough for Float32 seams.
  const tolerance = Math.max(extent * 1e-7, 1e-10);
  const inverseTolerance = 1 / tolerance;
  const buckets = new Map(), welded = new Array(position.count);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const key = `${Math.round((x - minX) * inverseTolerance)},${Math.round((y - minY) * inverseTolerance)},${Math.round((z - minZ) * inverseTolerance)}`;
    let vertex = buckets.get(key);
    if (!vertex) {
      vertex = { directions: [], x: 0, y: 0, z: 0 };
      buckets.set(key, vertex);
    }
    welded[i] = vertex;
  }

  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const addDirection = (vertex, x, y, z) => {
    for (const direction of vertex.directions) {
      if (direction[0] * x + direction[1] * y + direction[2] * z > 0.999999) return;
    }
    vertex.directions.push([x, y, z]);
    vertex.x += x; vertex.y += y; vertex.z += z;
  };

  for (let i = 0; i + 2 < count; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    const abX = position.getX(b) - position.getX(a);
    const abY = position.getY(b) - position.getY(a);
    const abZ = position.getZ(b) - position.getZ(a);
    const acX = position.getX(c) - position.getX(a);
    const acY = position.getY(c) - position.getY(a);
    const acZ = position.getZ(c) - position.getZ(a);
    let x = abY * acZ - abZ * acY;
    let y = abZ * acX - abX * acZ;
    let z = abX * acY - abY * acX;
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length <= tolerance * tolerance) continue;
    x /= length; y /= length; z /= length;
    addDirection(welded[a], x, y, z);
    addDirection(welded[b], x, y, z);
    addDirection(welded[c], x, y, z);
  }

  for (const vertex of buckets.values()) {
    const length = Math.hypot(vertex.x, vertex.y, vertex.z);
    if (length > 1e-12) {
      vertex.x /= length; vertex.y /= length; vertex.z /= length;
    } else if (vertex.directions.length) {
      [vertex.x, vertex.y, vertex.z] = vertex.directions[0];
    } else {
      vertex.x = 0; vertex.y = 0; vertex.z = 1;
    }
  }
  for (let i = 0; i < normal.count; i++) {
    const vertex = welded[i];
    normal.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  normal.needsUpdate = true;
  return geometry;
}
