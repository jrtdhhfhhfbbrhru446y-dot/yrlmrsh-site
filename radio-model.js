import { createRadioSurfaceTools } from './radio-surfaces.js?v=studio-19-final';
import { smoothRadioNormals } from './radio-geometry.js?v=studio-20-final';

/** A small, self-contained receiver. All artwork and surface detail are local. */
export function createRadioModel(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = 'PONY';
  group.userData.device = 'radio';
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const knobs = { volume: new THREE.Group(), tuning: new THREE.Group() };
  const stationButtons = new Map();
  const geometry = value => (geometries.add(value), value);
  const material = value => (materials.add(value), value);
  const standard = options => material(new THREE.MeshStandardMaterial(options));
  const canvas = (width, height) => {
    const element = options.createCanvas ? options.createCanvas(width, height) : document.createElement('canvas');
    element.width = width; element.height = height;
    // Static PBR artwork is read back for normal maps; keep those pixels local
    // rather than repeatedly round-tripping a GPU-backed 2D surface.
    return { element, ctx: element.getContext('2d', { willReadFrequently: true }) };
  };
  const texture = element => {
    const result = new THREE.CanvasTexture(element);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    textures.add(result);
    return result;
  };
  // Constant seed: every mark belongs to the object and stays still during use.
  let seed = 26071986;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const surfaces = createRadioSurfaceTools(THREE, canvas, texture, random);
  const shell = surfaces.surface(512, 512, { color: [182, 175, 155], grain: 3, mottle: 12, roughness: .76, relief: 5 });
  surfaces.edgeWear(shell, .75); surfaces.scuffs(shell, 110, 35, .14);
  for (let i = 0; i < 18; i++) surfaces.stain(shell, random() * 512, random() * 512, 15 + random() * 70, 10 + random() * 45, .04 + random() * .06);
  const shellMaps = surfaces.maps(shell, 1.4);
  for (const t of Object.values(shellMaps)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const ivory = standard({ ...shellMaps, color: 0xffffff, roughness: 1, metalness: .025 });
  const sidePlastic = standard({ ...shellMaps, color: 0xd6d7cf, roughness: 1, metalness: .015 });
  const trim = surfaces.surface(512, 256, { color: [50, 51, 46], grain: 4, mottle: 9, roughness: .8, relief: 4 });
  surfaces.edgeWear(trim, .6); surfaces.scuffs(trim, 80, 26, .2);
  const dark = standard({ ...surfaces.maps(trim), roughness: 1, metalness: .05 });
  const foot = surfaces.surface(128, 128, { color: [55, 54, 47], grain: 8, mottle: 10, roughness: .96, relief: 8 });
  surfaces.edgeWear(foot, .4);
  const rubber = standard({ ...surfaces.maps(foot), roughness: 1 });
  const metal = surfaces.surface(512, 256, { color: [158, 157, 145], grain: 3, mottle: 15, roughness: .5, relief: 3, brush: 9 });
  surfaces.scuffs(metal, 160, 70, .24); surfaces.edgeWear(metal, .7);
  for (let i = 0; i < 12; i++) surfaces.stain(metal, random() * 512, random() * 256, 8 + random() * 40, 4 + random() * 12, .1);
  surfaces.latheSeam(metal);
  const nickel = standard({ ...surfaces.maps(metal, 1.2, { lathe: true }), roughness: 1, metalness: .72 });
  const blackInk = standard({ color: 0x33382e, roughness: .64 });

  function roundedShape(w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2), x = -w / 2, y = -h / 2;
    const s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function rounded(w, h, d, radius, bevel = .001, boxUV = false) {
    const shape = roundedShape(w - bevel * 2, h - bevel * 2, Math.max(.0001, radius - bevel));
    const shellPart = w >= .3 && h >= .18;
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(.0001, d - bevel * 2), bevelEnabled: bevel > 0,
      bevelSegments: shellPart ? 6 : 3, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: shellPart ? 16 : 8
    });
    result.translate(0, 0, -d / 2 + bevel);
    const p = result.attributes.position, uv = result.attributes.uv;
    // Artwork follows the face rather than the default world-unit extrude UVs.
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
    if (boxUV) {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), normal = new THREE.Vector3();
      // ExtrudeGeometry is non-indexed: use one projection per triangle, even
      // across bevels, so the side's tangent frame never collapses to a line.
      for (let i = 0; i < p.count; i += 3) {
        a.set(p.getX(i + 1) - p.getX(i), p.getY(i + 1) - p.getY(i), p.getZ(i + 1) - p.getZ(i));
        b.set(p.getX(i + 2) - p.getX(i), p.getY(i + 2) - p.getY(i), p.getZ(i + 2) - p.getZ(i));
        normal.crossVectors(a, b);
        const x = Math.abs(normal.x), y = Math.abs(normal.y), z = Math.abs(normal.z);
        for (let j = i; j < i + 3; j++) {
          if (z >= x && z >= y) uv.setXY(j, p.getX(j) / .24 + .5, p.getY(j) / .24 + .5);
          else if (x >= y) uv.setXY(j, -Math.sign(normal.x) * p.getZ(j) / .24 + .5, p.getY(j) / .24 + .5);
          else uv.setXY(j, p.getX(j) / .24 + .5, -Math.sign(normal.y) * p.getZ(j) / .24 + .5);
        }
      }
    }
    smoothRadioNormals(result);
    return geometry(result);
  }
  function mesh(g, mat, position, parent = group, control) {
    const object = new THREE.Mesh(g, mat);
    object.position.set(...position);
    object.castShadow = true; object.receiveShadow = true;
    object.userData.device = 'radio';
    if (control) object.userData.radioControl = control;
    parent.add(object);
    return object;
  }
  function instanced(g, mat, transforms, parent = group) {
    const object = new THREE.InstancedMesh(g, mat, transforms.length);
    const dummy = new THREE.Object3D();
    transforms.forEach(({ p, s = [1, 1, 1], r = [0, 0, 0] }, i) => {
      dummy.position.set(...p); dummy.scale.set(...s); dummy.rotation.set(...r);
      dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix);
    });
    object.instanceMatrix.needsUpdate = true;
    object.castShadow = true; object.receiveShadow = true;
    object.userData.device = 'radio'; parent.add(object);
    return object;
  }
  function assembly(parts) {
    // Fixed antenna parts share a draw, with their original smooth normals/UVs.
    const expanded = parts.map(g => g.index ? g.toNonIndexed() : g);
    const result = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const itemSize = name === 'uv' ? 2 : 3;
      const count = expanded.reduce((sum, g) => sum + g.attributes[name].array.length, 0);
      const values = new Float32Array(count);
      let offset = 0;
      for (const g of expanded) { values.set(g.attributes[name].array, offset); offset += g.attributes[name].array.length; }
      result.setAttribute(name, new THREE.BufferAttribute(values, itemSize));
    }
    for (let i = 0; i < parts.length; i++) {
      if (expanded[i] !== parts[i]) expanded[i].dispose();
      parts[i].dispose();
    }
    return geometry(result);
  }
  function ring(w, h, thickness, radius, mat, z) {
    const shape = roundedShape(w, h, radius);
    const inner = roundedShape(w - thickness * 2, h - thickness * 2, Math.max(.001, radius - thickness));
    const hole = new THREE.Path(inner.getPoints(64).reverse());
    shape.holes.push(hole);
    return mesh(geometry(new THREE.ShapeGeometry(shape, 16)), mat, [0, .13, z]);
  }

  // The shadow seam and inset metal lip make the shell read as an assembled object.
  mesh(rounded(.4, .236, .11, .023, .003, true), sidePlastic, [0, .13, -.012]);
  ring(.384, .220, .0026, .014, dark, .0435);
  ring(.380, .216, .0015, .012, nickel, .0453);

  // A rear-mounted telescopic aerial: swivel joint, three nested tubes and
  // small stop collars. It leans away from the laptop and clears the faceplate.
  const aerialParts = [], aerialRubber = [];
  const aerialBase = new THREE.Vector3(-.150, .259, -.038);
  const aerialDirection = new THREE.Vector3(-.32, .947, .02).normalize();
  const aerialRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), aerialDirection);
  const tube = (top, bottom, length, center, tilted = true) => {
    const g = new THREE.CylinderGeometry(top, bottom, length, 24, 1);
    if (tilted) g.applyQuaternion(aerialRotation);
    g.translate(center.x, center.y, center.z);
    return g;
  };
  const along = distance => aerialBase.clone().addScaledVector(aerialDirection, distance);
  aerialRubber.push(tube(.010, .010, .0025, new THREE.Vector3(-.150, .249, -.038), false));
  aerialParts.push(tube(.0072, .0088, .007, new THREE.Vector3(-.150, .253, -.038), false));
  const joint = new THREE.SphereGeometry(.0063, 24, 12);
  joint.translate(aerialBase.x, aerialBase.y, aerialBase.z); aerialParts.push(joint);
  let extension = 0;
  for (const [length, radius] of [[.086, .0025], [.078, .0018], [.071, .0012]]) {
    aerialParts.push(tube(radius, radius * 1.025, length, along(extension + length / 2)));
    aerialParts.push(tube(radius + .00055, radius + .00055, .0028, along(extension + length - .0014)));
    extension += length - .003;
  }
  const tip = new THREE.SphereGeometry(.0021, 16, 8), tipPosition = along(extension + .003);
  tip.translate(tipPosition.x, tipPosition.y, tipPosition.z); aerialRubber.push(tip);
  const chrome = standard({ map: nickel.map, roughnessMap: nickel.roughnessMap, color: 0xe6e8e5, roughness: .6, metalness: .94 });
  mesh(assembly(aerialParts), chrome, [0, 0, 0]);
  mesh(assembly(aerialRubber), rubber, [0, 0, 0]);

  const face = surfaces.surface(1536, 900, { color: [190, 180, 156], grain: 2.5, mottle: 10, roughness: .7, relief: 3.5 }), c = face.ctx;
  surfaces.edgeWear(face, 1.1); surfaces.scuffs(face, 210, 42, .14);
  // Local handling marks and dust around hardware, rather than all-over dirt.
  for (const [x, y, rx, ry, opacity] of [[112, 72, 70, 55, .16], [1480, 70, 55, 45, .18],
    [111, 837, 65, 48, .19], [1480, 838, 60, 45, .19], [1225, 570, 180, 145, .1],
    [997, 555, 60, 80, .13], [1230, 818, 225, 40, .16], [525, 835, 430, 35, .12]]) {
    surfaces.stain(face, x, y, rx, ry, opacity);
  }
  for (let i = 0; i < 18; i++) {
    const x = 25 + random() * 1490, y = 20 + random() * 860;
    surfaces.stain(face, x, y, 12 + random() * 38, 6 + random() * 20, .04 + random() * .06);
  }
  c.save(); c.scale(1.5, 1.5);
  const fx = x => (x / .376 + .5) * 1024;
  const fy = y => (.5 - (y - .13) / .212) * 600;
  const label = (text, x, y, size = 17, align = 'left', color = '#353a30') => {
    c.fillStyle = color; c.font = `${size >= 22 ? 700 : 500} ${size}px "Courier New", monospace`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillText(text, fx(x), fy(y));
  };
  // A compact printed maker's mark: four broad, high-contrast serif Latin capitals.
  // Its left edge clears the fixing screw by .0155 world units, not a text glyph guess.
  const brand = { left: -.158, right: -.114, centerY: .2213, height: .0088 };
  function wordmark() {
    c.save();
    c.translate(fx(brand.left), fy(brand.centerY) - brand.height / .212 * 600 / 2);
    c.scale((brand.right - brand.left) / .376 * 1024 / 430, brand.height / .212 * 600 / 100);
    c.fillStyle = '#171717';
    const polygon = points => {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    };
    // P: deep bowl, narrow counter and long horizontal feet.
    c.beginPath(); c.moveTo(0, 0); c.lineTo(53, 0);
    c.bezierCurveTo(83, 0, 95, 8, 95, 28); c.bezierCurveTo(95, 48, 77, 58, 43, 58);
    c.lineTo(40, 58); c.lineTo(40, 90); c.lineTo(51, 90); c.lineTo(51, 100);
    c.lineTo(0, 100); c.lineTo(0, 90); c.lineTo(15, 90); c.lineTo(15, 10); c.lineTo(0, 10); c.closePath();
    c.moveTo(40, 13); c.lineTo(49, 13); c.bezierCurveTo(65, 13, 70, 18, 70, 28);
    c.bezierCurveTo(70, 40, 63, 45, 47, 45); c.lineTo(40, 45); c.closePath(); c.fill('evenodd');
    // O: generous width and thin crown contrast with the heavy vertical curves.
    c.beginPath(); c.ellipse(155, 50, 48, 50, 0, 0, Math.PI * 2);
    c.ellipse(155, 50, 23, 37, 0, 0, Math.PI * 2); c.fill('evenodd');
    // N: sturdy diagonal with finer uprights and extended squared serifs.
    c.save(); c.translate(211, 0);
    c.fillRect(12, 8, 15, 84); c.fillRect(87, 8, 16, 84);
    polygon([[17, 8], [43, 8], [103, 81], [103, 100], [80, 100], [17, 27]]);
    for (const [x, y] of [[0, 0], [74, 0], [0, 90], [74, 90]]) c.fillRect(x, y, 41, 10);
    c.restore();
    // Y: a broad fork and a heavy lower stem; no stock typeface is involved.
    c.save(); c.translate(333, 0);
    polygon([[3, 8], [29, 8], [62, 52], [44, 68]]);
    polygon([[76, 8], [91, 8], [59, 62], [44, 62]]);
    c.fillRect(42, 52, 24, 40); c.fillRect(26, 90, 56, 10);
    c.fillRect(0, 0, 40, 10); c.fillRect(70, 0, 27, 10);
    c.restore(); c.restore();
  }
  wordmark();
  label('AM / FM', .051, .217, 12);
  label('TUNING', .059, .091, 11, 'center');
  label('VOLUME', .135, .063, 12, 'center');
  // The volume numerals and tiny ticks are printed, not floating geometry.
  for (let i = 0; i <= 10; i++) {
    const a = (-130 + i * 26) * Math.PI / 180;
    const x = .135 + Math.sin(a) * .0478, y = .112 + Math.cos(a) * .0478;
    c.beginPath(); c.strokeStyle = '#53564a'; c.lineWidth = 1;
    c.moveTo(fx(.135 + Math.sin(a) * .045), fy(.112 + Math.cos(a) * .045));
    c.lineTo(fx(x), fy(y)); c.stroke();
    if (i % 2 === 0) label(String(i), .135 + Math.sin(a) * .0525, .112 + Math.cos(a) * .0525, 11, 'center');
  }
  c.restore();
  const faceMat = standard({ ...surfaces.maps(face, 1.7), roughness: 1, metalness: .02 });
  mesh(rounded(.376, .212, .009, .010, .001), faceMat, [0, .13, .0465]);

  // Woven cloth sits behind seventeen horizontal moulded ribs.
  const cloth = surfaces.surface(768, 512, { color: [36, 37, 33], grain: 5, mottle: 16, roughness: .95, relief: 5 }), cc = cloth.ctx;
  for (let y = 0; y < 512; y += 3) {
    cc.fillStyle = y % 6 ? 'rgba(106,101,84,.28)' : 'rgba(6,8,6,.5)'; cc.fillRect(0, y, 768, 1);
    cloth.relief.ctx.fillStyle = '#afafaf'; cloth.relief.ctx.fillRect(0, y, 768, 1);
  }
  for (let x = 0; x < 768; x += 3) {
    cc.fillStyle = 'rgba(140,132,112,.17)'; cc.fillRect(x, 0, 1, 512);
  }
  for (let i = 0; i < 1300; i++) {
    cc.fillStyle = `rgba(161,150,126,${.07 + random() * .17})`;
    cc.fillRect(random() * 768, random() * 512, .5 + random() * 1.8, .5 + random() * 1.2);
  }
  const clothMat = standard({ ...surfaces.maps(cloth, .65), roughness: 1 });
  mesh(rounded(.221, .162, .004, .005, .0006), dark, [-.075, .124, .0525]);
  mesh(geometry(new THREE.PlaneGeometry(.215, .156)), clothMat, [-.075, .124, .055]);
  // One atlas spans all ribs: each one wears differently while staying instanced.
  const ribGeometry = rounded(.217, .0035, .0044, .00175, .00045);
  const ribs = new THREE.InstancedBufferAttribute(Float32Array.from({ length: 17 }, (_, i) => i / 17), 1);
  ribGeometry.setAttribute('wearRow', ribs);
  const ribArt = surfaces.surface(1024, 512, { color: [190, 181, 156], grain: 3, mottle: 14, roughness: .72, relief: 4 });
  for (let i = 0; i < 17; i++) {
    const y = i / 17 * 512;
    surfaces.stain(ribArt, 110 + random() * 800, y, 100 + random() * 180, 10, .18);
    for (let j = 0; j < 7; j++) surfaces.scratch(ribArt, random() * 1024, y + random() * 25, 4 + random() * 45, .01, .23, .7);
  }
  const ribMat = standard({ ...surfaces.maps(ribArt, 1.3), roughness: 1, metalness: .025 });
  configureRadioRibMaterial(ribMat);
  instanced(ribGeometry, ribMat, Array.from({ length: 17 }, (_, i) => ({ p: [-.075, .049 + i * .0093, .057] })));

  mesh(rounded(.138, .041, .004, .004, .0007), dark, [.118, .193, .053]);
  const dial = surfaces.surface(768, 220, { color: [20, 31, 22], grain: 2, mottle: 6, roughness: .26, relief: .4 }), d = dial.ctx;
  const dialGradient = d.createLinearGradient(0, 0, 0, 220);
  dialGradient.addColorStop(0, 'rgba(8,14,10,.38)');
  dialGradient.addColorStop(.4, 'rgba(104,123,86,.09)');
  dialGradient.addColorStop(1, 'rgba(8,14,10,.31)');
  d.fillStyle = dialGradient; d.fillRect(0, 0, 768, 220);
  d.fillStyle = '#c9cfb2'; d.font = '600 23px "Courier New", monospace'; d.textAlign = 'left';
  d.fillText('FM', 25, 40); d.fillText('AM', 25, 170);
  d.strokeStyle = '#8c9b80'; d.lineWidth = 2;
  d.beginPath(); d.moveTo(92, 92); d.lineTo(739, 92); d.moveTo(92, 132); d.lineTo(739, 132); d.stroke();
  for (let i = 0; i <= 64; i++) {
    const x = 96 + i * 10, major = i % 8 === 0;
    d.strokeStyle = major ? '#c4ccb0' : '#9fae91';
    d.lineWidth = major ? 3 : 2;
    d.beginPath(); d.moveTo(x, 85); d.lineTo(x, major ? 54 : i % 4 === 0 ? 64 : 73); d.stroke();
  }
  d.font = '500 23px "Courier New", monospace'; d.textAlign = 'center';
  ['88', '92', '96', '100', '104', '108'].forEach((s, i) => d.fillText(s, 105 + i * 122, 39));
  ['RAIN', 'NOISE', 'WIND'].forEach((s, i) => d.fillText(s, 165 + i * 245, 174));
  surfaces.edgeWear(dial, .45); surfaces.scuffs(dial, 90, 28, .1);
  surfaces.stain(dial, 130, 30, 190, 37, .12, '54,57,43');
  // Thin reflections and fine scratches belong to the acrylic, not extra planes.
  const glassReflection = d.createLinearGradient(0, 0, 190, 220);
  glassReflection.addColorStop(0, 'rgba(255,255,238,.045)'); glassReflection.addColorStop(.6, 'rgba(255,255,238,0)');
  d.fillStyle = glassReflection; d.fillRect(0, 0, 768, 220);
  const dialMaps = surfaces.maps(dial, .65), dialTexture = dialMaps.map;
  const dialMat = material(new THREE.MeshPhysicalMaterial({ ...dialMaps, color: 0xffffff, roughness: 1, metalness: .05, clearcoat: .65, clearcoatRoughness: .23, emissive: 0x82936b, emissiveMap: dialTexture, emissiveIntensity: 0 }));
  const display = mesh(geometry(new THREE.PlaneGeometry(.131, .034)), dialMat, [.118, .193, .0554], group, 'tuning');
  display.castShadow = false;
  const pointer = mesh(geometry(new THREE.BoxGeometry(.0008, .027, .0006)), standard({ color: 0xb9602e, roughness: .4, metalness: .15 }), [.118, .193, .0561], group, 'tuning');

  // A turned profile gives the knob a shallow dished face and a rounded rim.
  const knobShape = geometry(new THREE.LatheGeometry([
    new THREE.Vector2(0, -.008), new THREE.Vector2(.035, -.008),
    new THREE.Vector2(.0397, -.006), new THREE.Vector2(.0405, .003),
    new THREE.Vector2(.0394, .008), new THREE.Vector2(.036, .0092),
    new THREE.Vector2(.031, .0089), new THREE.Vector2(0, .0082)
  ], 48));
  // Lathe UV: u runs around the knob, v follows its turned profile. Dirt is
  // concentrated at the rim; the shallow centre has a smoother finger polish.
  const knobArt = surfaces.surface(512, 512, { color: [186, 177, 150], grain: 2.5, mottle: 9, roughness: .68, relief: 3 });
  for (let x = 0; x < 512; x++) {
    const brightness = 102 + Math.round(random() * 35);
    knobArt.ctx.strokeStyle = `rgba(81,76,59,${.03 + random() * .1})`;
    knobArt.ctx.beginPath(); knobArt.ctx.moveTo(x, 130); knobArt.ctx.lineTo(x, 300); knobArt.ctx.stroke();
    knobArt.relief.ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
    if (x % 11 === 0) knobArt.relief.ctx.fillRect(x, 150, 1, 135);
  }
  surfaces.stain(knobArt, 120, 220, 200, 55, .17);
  surfaces.stain(knobArt, 410, 270, 170, 45, .21);
  for (const y of [145, 282, 322]) {
    knobArt.ctx.fillStyle = 'rgba(81,77,61,.13)'; knobArt.ctx.fillRect(0, y, 512, 2);
    knobArt.rough.ctx.fillStyle = '#dedede'; knobArt.rough.ctx.fillRect(0, y - 5, 512, 12);
  }
  surfaces.scuffs(knobArt, 100, 18, .13);
  surfaces.latheSeam(knobArt);
  const knobMat = standard({ ...surfaces.maps(knobArt, 1.2, { lathe: true }), roughness: 1, metalness: .025 });
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 32));
  const collar = mesh(cylinder, nickel, [.135, .112, .0545], group, 'volume');
  collar.rotation.x = Math.PI / 2; collar.scale.set(.043, .003, .043);
  knobs.volume.position.set(.135, .112, .066);
  knobs.volume.userData.device = 'radio'; knobs.volume.userData.radioControl = 'volume';
  group.add(knobs.volume);
  const knob = mesh(knobShape, knobMat, [0, 0, 0], knobs.volume, 'volume'); knob.rotation.x = Math.PI / 2;
  const ridges = instanced(geometry(new THREE.BoxGeometry(.001, .0014, .011)), sidePlastic,
    Array.from({ length: 48 }, (_, i) => {
      const a = i * Math.PI * 2 / 48;
      return { p: [Math.sin(a) * .04035, Math.cos(a) * .04035, .0008], r: [0, 0, -a] };
    }), knobs.volume);
  ridges.userData.radioControl = 'volume';
  mesh(geometry(new THREE.BoxGeometry(.00115, .008, .00055)), blackInk, [0, .0285, .0093], knobs.volume, 'volume');
  knobs.tuning.position.set(.059, .118, .061);
  knobs.tuning.userData.device = 'radio'; knobs.tuning.userData.radioControl = 'tuning';
  group.add(knobs.tuning);
  const tuner = mesh(knobShape, nickel, [0, 0, 0], knobs.tuning, 'tuning');
  tuner.rotation.x = Math.PI / 2; tuner.scale.setScalar(.36);
  mesh(geometry(new THREE.BoxGeometry(.0008, .004, .0003)), blackInk, [0, .0095, .0035], knobs.tuning, 'tuning');

  function key(labelText, x, width, control) {
    const art = surfaces.surface(256, 128, { color: [188, 179, 151], grain: 2.5, mottle: 8, roughness: .64, relief: 3 }), k = art.ctx;
    const g = k.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,253,235,.17)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(68,71,55,.22)');
    k.fillStyle = g; k.fillRect(0, 0, 256, 128);
    surfaces.edgeWear(art, .5); surfaces.scuffs(art, 25, 20, .13);
    surfaces.stain(art, 200, 110, 88, 25, .13);
    const polish = k.createRadialGradient(110, 50, 0, 110, 50, 80);
    polish.addColorStop(0, 'rgba(255,253,232,.12)'); polish.addColorStop(1, 'rgba(255,253,232,0)');
    k.fillStyle = polish; k.fillRect(0, 0, 256, 128);
    k.fillStyle = '#36392f'; k.textAlign = 'center'; k.textBaseline = 'middle';
    k.font = `600 ${control === 'power' ? 31 : 28}px "Courier New", monospace`;
    k.fillText(labelText, 128, 66);
    const mat = standard({ ...surfaces.maps(art, 1.1), roughness: 1, metalness: .025 });
    const object = mesh(rounded(width, .022, .010, .0022, .0007), mat,
      [x, control === 'power' ? .159 : .043, .057], group, control);
    object.userData.restZ = object.position.z;
    return object;
  }
  const powerKey = key('I / O', .171, .020, 'power');
  const indicatorShape = geometry(new THREE.ShapeGeometry(roundedShape(.0076, .002, .001), 6));
  const indicatorMaterial = material(new THREE.MeshBasicMaterial({ color: 0xd48132, toneMapped: false }));
  [['rain', 'Дождь', .061], ['noise', 'Шум', .106], ['wind', 'Ветер', .151]].forEach(([id, title, x]) => {
    const button = key(title, x, .039, `station:${id}`);
    const indicator = new THREE.Mesh(indicatorShape, indicatorMaterial);
    indicator.name = 'station-indicator';
    indicator.position.set(0, -.0064, .0051);
    indicator.visible = false;
    button.add(indicator);
    stationButtons.set(id, button);
  });

  instanced(rounded(.045, .014, .033, .005, .0012), rubber,
    [-.142, .142].flatMap(x => [-.041, .033].map(z => ({ p: [x, .007, z] }))));
  // Slotted fixing screws: one combined texture/material for the four heads.
  const screwArt = canvas(128, 128), sc = screwArt.ctx;
  sc.scale(2, 2);
  const screwGradient = sc.createRadialGradient(22, 18, 0, 32, 32, 32);
  screwGradient.addColorStop(0, '#d1d0bc'); screwGradient.addColorStop(1, '#7f8172');
  sc.fillStyle = screwGradient; sc.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 180; i++) {
    sc.fillStyle = random() > .5 ? 'rgba(54,49,31,.22)' : 'rgba(248,239,207,.3)';
    sc.fillRect(random() * 64, random() * 64, .4 + random(), .4 + random());
  }
  sc.fillStyle = '#4d5146'; sc.fillRect(14, 28, 36, 6);
  sc.fillStyle = 'rgba(30,29,23,.6)'; sc.fillRect(16, 28, 32, 2);
  sc.fillStyle = 'rgba(248,240,211,.6)'; sc.fillRect(14, 34, 36, 1);
  const screwMat = standard({ map: texture(screwArt.element), roughness: .48, metalness: .6 });
  const screwGeometry = geometry(new THREE.CircleGeometry(.0025, 16));
  instanced(screwGeometry, screwMat,
    [-.176, .176].flatMap(x => [.035, .226].map(y => ({ p: [x, y, .052], r: [0, 0, random() * Math.PI] }))));
  // Rear ventilation and a recessed service plate remain visible during orbit.
  mesh(rounded(.338, .182, .002, .008, .0004), ivory, [0, .13, -.0675]);
  instanced(rounded(.111, .002, .0015, .001, .0002), dark,
    Array.from({ length: 12 }, (_, i) => ({ p: [-.075, .087 + i * .0072, -.069] })));

  return createRadioController(THREE, {
    group, knobs, pointer, dialMat, powerKey, stationButtons, geometries, materials, textures
  });
}

// Shared by the generator and its worker-prepared reconstruction.
export function configureRadioRibMaterial(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float wearRow;');
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.y = vMapUv.y * (1.0 / 17.0 - 4.0 / 512.0) + wearRow + 2.0 / 512.0;\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv.y = vNormalMapUv.y * (1.0 / 17.0 - 4.0 / 512.0) + wearRow + 2.0 / 512.0;\n#endif\n#ifdef USE_ROUGHNESSMAP\nvRoughnessMapUv.y = vRoughnessMapUv.y * (1.0 / 17.0 - 4.0 / 512.0) + wearRow + 2.0 / 512.0;\n#endif');
  };
  material.customProgramCacheKey = () => 'radio-rib-wear-atlas-v1';
}

export function createRadioController(THREE, { group, knobs, pointer, dialMat, powerKey, stationButtons, geometries, materials, textures, images = [] }) {
  const state = { powered: false, source: null, recording: false, noiseEnabled: false, volume: .35, station: 'rain' };
  const stationPositions = { rain: .22, noise: .5, wind: .79 };
  let disposed = false;
  function setState(next = {}) {
    if (disposed) return;
    if ('powered' in next) state.powered = Boolean(next.powered);
    if ('source' in next && [null, 'noise', 'recording', 'mixed'].includes(next.source)) state.source = next.source;
    if ('recording' in next) state.recording = Boolean(next.recording);
    if ('noiseEnabled' in next) state.noiseEnabled = Boolean(next.noiseEnabled);
    if (Number.isFinite(next.volume)) state.volume = THREE.MathUtils.clamp(next.volume, 0, 1);
    if (Object.hasOwn(stationPositions, next.station)) state.station = next.station;
    knobs.volume.rotation.z = THREE.MathUtils.degToRad(130 - state.volume * 260);
    knobs.tuning.rotation.z = -stationPositions[state.station] * Math.PI * 2;
    pointer.position.x = .0525 + stationPositions[state.station] * .131;
    dialMat.emissiveIntensity = state.powered ? .22 : 0;
    powerKey.position.z = powerKey.userData.restZ - (state.recording ? .002 : 0);
    for (const [id, button] of stationButtons) {
      const pressed = state.noiseEnabled && id === state.station;
      button.position.z = button.userData.restZ - (pressed ? .0031 : 0);
      button.material.color.setHex(pressed ? 0xc9c6bb : 0xffffff);
      const indicator = button.getObjectByName('station-indicator');
      if (indicator) indicator.visible = pressed;
    }
  }
  setState(state);
  return {
    group, knobs, pointer, setState,
    resources: { geometries, materials, textures },
    preparation: {
      volume: knobs.volume.uuid, tuning: knobs.tuning.uuid, pointer: pointer.uuid,
      dialMaterial: dialMat.uuid, powerKey: powerKey.uuid,
      stations: [...stationButtons].map(([id, button]) => [id, button.uuid])
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      images.forEach(image => image.close?.());
      group.removeFromParent();
    }
  };
}
