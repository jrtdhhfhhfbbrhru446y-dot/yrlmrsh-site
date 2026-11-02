/** Optional, demand-rendered studio. This module is never imported in the 2D view. */
export async function createScene3D(options) {
  if (options.isSuspended?.()) throw new DOMException('The 3D view is not active.', 'AbortError');
  const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }, { removeLaptopLabels }, { createRadioModel }] = await Promise.all([
    import('./assets/vendor/three.module.js'),
    import('./assets/vendor/GLTFLoader.js'),
    import('./assets/vendor/OrbitControls.js'),
    import('./assets/vendor/RoomEnvironment.js'),
    import('./laptop-material.js?v=1'),
    import('./radio-model.js?v=studio-40-final')
  ]);
  if (options.isSuspended?.()) throw new DOMException('The 3D view is not active.', 'AbortError');
  const { canvas, anchor, tvAnchor, tvCanvas } = options;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const screen = { left: -.22408510, right: .22431661, top: .51288581, bottom: .14632967, z: -.20660 };
  const laptopOffset = new THREE.Vector3(-.26, 0, 0);
  const ratio = (screen.right - screen.left) / (screen.top - screen.bottom);
  const screenCenter = new THREE.Vector3((screen.left + screen.right) / 2, (screen.top + screen.bottom) / 2, screen.z).add(laptopOffset);
  const corners = [[screen.left, screen.top], [screen.right, screen.top], [screen.right, screen.bottom], [screen.left, screen.bottom]].map(([x, y]) => new THREE.Vector3(x, y, screen.z).add(laptopOffset));
  const tvScreen = { left: -.2535, right: .1227, top: .4004, bottom: .1180, z: .1930 };
  const tvRatio = (tvScreen.right - tvScreen.left) / (tvScreen.top - tvScreen.bottom);
  const tvCorners = [[tvScreen.left, tvScreen.top], [tvScreen.right, tvScreen.top], [tvScreen.right, tvScreen.bottom], [tvScreen.left, tvScreen.bottom]].map(([x, y]) => new THREE.Vector3(x, y, tvScreen.z));
  const projection = corners.map(() => new THREE.Vector3());
  const radioPosition = new THREE.Vector3(-.78, 0, .04), radioScale = .86;
  const stations = ['rain', 'noise', 'wind'];
  let width = innerWidth, height = innerHeight, logicalWidth = 800, logicalHeight = 800 / ratio;
  let mode = width < 680 ? 'work' : 'desk', expanded = false, suspended = false, motionDisabled = false;
  let entered = Boolean(options.getEntered?.() ?? options.entered);
  let ready = false, tvReady = false, tvLoading = false, tvFailed = false, disposed = false;
  let initialFramePending = false, initialReadyFired = false;
  let laptopModel, tvModel, tvTexture, radioObject, laptopScreenMaterial, desktopTexture, tween = null, frame = 0, lastFrame = 0;
  let idleHandle = null, idleTimer = null, pointerStart = null, radioDrag = null;
  let cameraDirty = true, interacting = false, totalFrames = 0, lastStats = -Infinity, latestMetrics = null;
  let baseDPR = 1, resolutionScale = 1, slowRenders = 0, qualityTimer = null;
  let lastControlUpdate = performance.now();
  const pointers = new Set(), unlisten = [];
  const systemFontWeight = document.documentElement.dataset.typography === 'baseline' ? 600 : 400;
  const systemFontFamily = document.documentElement.dataset.typography === 'baseline'
    ? '"IBM Plex Mono", "Courier New", monospace'
    : '"Departure Mono", "IBM Plex Mono", monospace';
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f7f4);
  scene.fog = new THREE.Fog(0xf7f7f4, 4, 10);
  const camera = new THREE.PerspectiveCamera(30, width / height, .01, 25);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = !reduced.matches;
  controls.dampingFactor = .18;
  controls.enablePan = false;
  controls.minDistance = .55; controls.maxDistance = 5.8;
  controls.maxPolarAngle = Math.PI * .49; controls.minPolarAngle = .18;
  // This OrbitControls release uses deltaTime only for autoRotate. Normalize its
  // actual damping coefficient ourselves; pointer drags follow the hand directly.
  const nativeControlsUpdate = controls.update.bind(controls);
  controls.update = deltaSeconds => {
    const now = performance.now();
    const delta = deltaSeconds ?? Math.min(.05, Math.max(.001, (now - lastControlUpdate) / 1000));
    lastControlUpdate = now;
    controls.dampingFactor = interacting ? 1 : 1 - Math.exp(-delta / .085);
    return nativeControlsUpdate(delta);
  };
  const environmentGenerator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  // The library's fromScene hardcodes a 256px cube. A 128px capture is sufficient
  // for rough vintage plastic and reduces the persistent environment allocation.
  const environmentCube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const environmentCamera = new THREE.CubeCamera(.1, 100, environmentCube);
  environmentCamera.update(renderer, room);
  const environmentTarget = environmentGenerator.fromCubemap(environmentCube.texture);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = .65;
  room.dispose(); environmentGenerator.dispose(); environmentCube.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc5c2b3, 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
  keyLight.position.set(-1.2, 2, 1.7); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  Object.assign(keyLight.shadow.camera, { left: -1.45, right: 1.45, top: 1.15, bottom: -1.15, near: .1, far: 6 });
  keyLight.shadow.bias = -.00015; keyLight.shadow.normalBias = .001;
  keyLight.shadow.radius = 3;
  scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0xffffff, .65);
  fill.position.set(1, .7, -.6); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.0012; floor.receiveShadow = true;
  scene.add(floor);
  radioObject = createRadioModel(THREE);
  radioObject.group.position.copy(radioPosition); radioObject.group.scale.setScalar(radioScale); radioObject.group.rotation.y = .07;
  radioObject.setState(options.getRadioState?.() || { powered: false, station: 'rain', volume: .25 });
  scene.add(radioObject.group);
  const desktopItems = [
    { key: 'experiments', label: 'Эксперименты', x: 290, y: 153 },
    { key: 'skills', label: 'Навыки', x: 510, y: 153 },
    { key: 'games', label: 'Игры', x: 290, y: 378 },
    { key: 'contact', label: 'Контакт', x: 510, y: 378 }
  ];
  // Compile the native SVG linework straight to Canvas paths. Parsing markup as
  // XML and then assigning xmlns does not change the children's namespace; an
  // Image can consequently decode a nominal SVG while painting no artwork.
  // Native paths avoid that asynchronous image/namespace boundary altogether.
  function compileDesktopIcon(original) {
    if (!original || original.localName?.toLowerCase() !== 'svg' || typeof Path2D !== 'function') return null;
    const viewBox = (original.getAttribute('viewBox') || '0 0 64 64').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0) return null;
    const value = (node, name, inherited) => node.hasAttribute(name) ? node.getAttribute(name) : inherited;
    const compile = (node, inherited) => {
      const style = {
        fill: node.classList?.contains('os-icon-face') ? '#f6f5ef' : value(node, 'fill', inherited.fill),
        stroke: value(node, 'stroke', inherited.stroke),
        width: Number(value(node, 'stroke-width', inherited.width)),
        cap: value(node, 'stroke-linecap', inherited.cap),
        join: value(node, 'stroke-linejoin', inherited.join),
        rule: value(node, 'fill-rule', inherited.rule),
        fillOpacity: Number(value(node, 'fill-opacity', inherited.fillOpacity)),
        strokeOpacity: Number(value(node, 'stroke-opacity', inherited.strokeOpacity))
      };
      const tag = node.localName?.toLowerCase();
      const number = name => Number(node.getAttribute(name) || 0);
      let path = null;
      if (tag === 'path' && node.hasAttribute('d')) path = new Path2D(node.getAttribute('d'));
      if (tag === 'rect') {
        path = new Path2D();
        const x = number('x'), y = number('y'), w = number('width'), h = number('height');
        const rx = Math.max(0, Math.min(number('rx') || number('ry'), w / 2)), ry = Math.max(0, Math.min(number('ry') || number('rx'), h / 2));
        if (!rx && !ry) path.rect(x, y, w, h);
        else {
          path.moveTo(x + rx, y); path.lineTo(x + w - rx, y); path.quadraticCurveTo(x + w, y, x + w, y + ry);
          path.lineTo(x + w, y + h - ry); path.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
          path.lineTo(x + rx, y + h); path.quadraticCurveTo(x, y + h, x, y + h - ry);
          path.lineTo(x, y + ry); path.quadraticCurveTo(x, y, x + rx, y); path.closePath();
        }
      }
      if (tag === 'circle' || tag === 'ellipse') {
        path = new Path2D(); path.ellipse(number('cx'), number('cy'), tag === 'circle' ? number('r') : number('rx'), tag === 'circle' ? number('r') : number('ry'), 0, 0, Math.PI * 2);
      }
      if (tag === 'line') { path = new Path2D(); path.moveTo(number('x1'), number('y1')); path.lineTo(number('x2'), number('y2')); }
      const transforms = [];
      for (const match of (node.getAttribute('transform') || '').matchAll(/([a-zA-Z]+)\s*\(([^)]+)\)/g)) {
        transforms.push([match[1], match[2].trim().split(/[\s,]+/).map(Number)]);
      }
      return { path, style, transforms, opacity: Number(node.getAttribute('opacity') ?? 1), children: [...node.children].map(child => compile(child, style)) };
    };
    try { return { viewBox, root: compile(original, { fill: '#161714', stroke: 'none', width: 1, cap: 'butt', join: 'miter', rule: 'nonzero', fillOpacity: 1, strokeOpacity: 1 }) }; }
    catch { return null; }
  }
  for (const item of desktopItems) {
    const markup = options.getDesktopIcon?.(item.key);
    const original = markup ? new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement : anchor.querySelector(`.os-desktop-item[data-go="${item.key}"] svg`);
    item.drawing = compileDesktopIcon(original);
  }
  const desktopCanvas = document.createElement('canvas');
  desktopCanvas.width = 800; desktopCanvas.height = 654;
  const desktopContext = desktopCanvas.getContext('2d', { alpha: false });
  function drawDesktopIcon(item) {
    if (!item.drawing) { fallbackDesktopIcon(item); return; }
    const ctx = desktopContext, [left, top, iconWidth, iconHeight] = item.drawing.viewBox;
    const paint = node => {
      ctx.save();
      for (const [name, values] of node.transforms) {
        if (name === 'matrix' && values.length === 6) ctx.transform(...values);
        else if (name === 'translate') ctx.translate(values[0] || 0, values[1] || 0);
        else if (name === 'scale') ctx.scale(values[0], values[1] ?? values[0]);
        else if (name === 'rotate') {
          const [angle, cx = 0, cy = 0] = values;
          ctx.translate(cx, cy); ctx.rotate(angle * Math.PI / 180); ctx.translate(-cx, -cy);
        } else if (name === 'skewX') ctx.transform(1, 0, Math.tan(values[0] * Math.PI / 180), 1, 0, 0);
        else if (name === 'skewY') ctx.transform(1, Math.tan(values[0] * Math.PI / 180), 0, 1, 0, 0);
      }
      ctx.globalAlpha *= node.opacity;
      if (node.path) {
        const alpha = ctx.globalAlpha, style = node.style;
        const color = value => value === 'currentColor' ? '#161714' : value;
        if (style.fill !== 'none') { ctx.globalAlpha = alpha * style.fillOpacity; ctx.fillStyle = color(style.fill); ctx.fill(node.path, style.rule); }
        if (style.stroke !== 'none' && style.width > 0) {
          ctx.globalAlpha = alpha * style.strokeOpacity; ctx.strokeStyle = color(style.stroke);
          ctx.lineWidth = style.width; ctx.lineCap = style.cap; ctx.lineJoin = style.join; ctx.stroke(node.path);
        }
        ctx.globalAlpha = alpha;
      }
      node.children.forEach(paint); ctx.restore();
    };
    ctx.save(); ctx.translate(item.x - 52, item.y - 5); ctx.scale(104 / iconWidth, 104 / iconHeight); ctx.translate(-left, -top);
    paint(item.drawing.root); ctx.restore();
  }
  function fallbackDesktopIcon(item) {
    const ctx = desktopContext, x = item.x - 44, y = item.y;
    ctx.save(); ctx.translate(x, y); ctx.lineWidth = 5; ctx.strokeStyle = '#161714'; ctx.fillStyle = '#f6f5ef';
    if (item.key === 'experiments') {
      ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, 5); ctx.lineTo(33, 5); ctx.lineTo(42, 18); ctx.lineTo(86, 18); ctx.lineTo(86, 85); ctx.lineTo(0, 85); ctx.closePath(); ctx.stroke();
      ctx.strokeRect(0, 27, 86, 58);
    } else if (item.key === 'skills') {
      ctx.beginPath(); ctx.moveTo(44, 13); ctx.lineTo(44, 76); ctx.moveTo(12, 44); ctx.lineTo(76, 44); ctx.stroke();
      for (const [cx, cy] of [[44, 44], [44, 8], [44, 80], [7, 44], [81, 44]]) { ctx.fillRect(cx - 10, cy - 10, 20, 20); ctx.strokeRect(cx - 10, cy - 10, 20, 20); }
    } else if (item.key === 'games') {
      ctx.strokeRect(1, 24, 86, 55); ctx.beginPath(); ctx.moveTo(43, 24); ctx.lineTo(43, 9); ctx.lineTo(58, 9); ctx.lineTo(58, -2); ctx.stroke();
      ctx.fillStyle = '#161714'; ctx.fillRect(17, 35, 10, 29); ctx.fillRect(7, 45, 30, 10);
      for (const [cx, cy] of [[64, 39], [74, 50], [64, 62], [53, 50]]) ctx.fillRect(cx, cy, 8, 8);
    } else {
      ctx.strokeRect(0, 18, 88, 62); ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(44, 57); ctx.lineTo(88, 18); ctx.moveTo(0, 80); ctx.lineTo(31, 48); ctx.moveTo(88, 80); ctx.lineTo(57, 48); ctx.stroke();
    }
    ctx.restore();
  }
  function drawDesktopLCD() {
    if (!desktopContext || disposed) return;
    const ctx = desktopContext;
    canvas.dataset.desktopIconCount = String(desktopItems.filter(item => item.drawing).length);
    ctx.fillStyle = '#f6f5ef'; ctx.fillRect(0, 0, 800, 654);
    if (!entered) {
      ctx.strokeStyle = '#777972'; ctx.fillStyle = '#161714'; ctx.lineWidth = 1;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.textAlign = 'center'; ctx.font = '600 49px "IBM Plex Mono", "Courier New", monospace'; ctx.fillText('YRLMRSH', 400, 284.5);
      const cutFace = (x, y, width, height, cut, color) => {
        ctx.beginPath(); ctx.moveTo(x + cut, y); ctx.lineTo(x + width - cut, y);
        ctx.lineTo(x + width, y + cut); ctx.lineTo(x + width, y + height - cut);
        ctx.lineTo(x + width - cut, y + height); ctx.lineTo(x + cut, y + height);
        ctx.lineTo(x, y + height - cut); ctx.lineTo(x, y + cut); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
      };
      cutFace(295, 338, 210, 58, 4, '#92928c');
      cutFace(295, 337, 210, 58, 4, '#393936');
      cutFace(296, 338, 208, 56, 3, '#f0f0eb');
      ctx.lineWidth = 1; ctx.strokeStyle = '#aeaea7'; ctx.strokeRect(299.5, 341.5, 201, 49);
      ctx.fillStyle = '#242424'; ctx.textAlign = 'left';
      ctx.font = `400 20px ${systemFontFamily}`; ctx.fillText('Войти', 315, 366);
      ctx.fillStyle = '#343434'; ctx.fillRect(455, 344, 44, 44);
      ctx.strokeStyle = '#64645e'; ctx.strokeRect(459.5, 348.5, 35, 35);
      ctx.save(); ctx.translate(464, 353); ctx.scale(1.1, 1.1);
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#f7f7f2'; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(19, 5); ctx.lineTo(19, 14); ctx.lineTo(5, 14);
      ctx.moveTo(10, 9); ctx.lineTo(5, 14); ctx.lineTo(10, 19); ctx.stroke(); ctx.restore();
      if (desktopTexture) desktopTexture.needsUpdate = true;
      return;
    }
    ctx.strokeStyle = '#777972'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 39); ctx.lineTo(800, 39); ctx.moveTo(0, 611); ctx.lineTo(800, 611); ctx.stroke();
    ctx.fillStyle = '#161714'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `${systemFontWeight} 22px ${systemFontFamily}`; ctx.fillText('YRLMRSH', 16, 21);
    ctx.font = `${systemFontWeight} 19px ${systemFontFamily}`;
    ctx.fillText('Файл', 152, 21); ctx.fillText('Вид', 232, 21); ctx.fillText('Переход', 299, 21);
    ctx.font = `${systemFontWeight} 17px ${systemFontFamily}`;
    ctx.fillText(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 725, 21);
    ctx.imageSmoothingEnabled = false;
    for (const item of desktopItems) {
      drawDesktopIcon(item);
      ctx.fillStyle = '#161714'; ctx.textAlign = 'center'; ctx.font = '600 24px "IBM Plex Mono", "Courier New", monospace';
      ctx.fillText(item.label, item.x, item.y + 126);
    }
    ctx.textAlign = 'center';
    if (options.desktopCaption) { ctx.font = '18px "IBM Plex Mono", "Courier New", monospace'; ctx.fillText(options.desktopCaption, 400, 566, 740); }
    ctx.font = `${systemFontWeight} 18px ${systemFontFamily}`;
    ctx.fillText('Радио', 120, 634); ctx.fillText('▣  Рабочий стол', 400, 634); ctx.fillText('Телевизор', 680, 634);
    ctx.beginPath(); ctx.moveTo(240, 611); ctx.lineTo(240, 654); ctx.moveTo(560, 611); ctx.lineTo(560, 654); ctx.stroke();
    if (desktopTexture) desktopTexture.needsUpdate = true;
  }
  function createDesktopLCD() {
    drawDesktopLCD();
    desktopTexture = new THREE.CanvasTexture(desktopCanvas);
    desktopTexture.colorSpace = THREE.SRGBColorSpace;
    desktopTexture.minFilter = THREE.LinearFilter; desktopTexture.generateMipmaps = false;
    if (document.fonts?.load) {
      Promise.all([document.fonts.load('400 20px "IBM Plex Mono"'), document.fonts.load('600 24px "IBM Plex Mono"'), document.fonts.load(`400 22px ${systemFontFamily}`)]).then(() => {
        if (disposed) return;
        drawDesktopLCD();
        if (mode === 'object') requestFrame();
      }).catch(() => { /* The local monospace fallback remains usable. */ });
    }
  }
  function syncLaptopLCD() {
    if (!laptopScreenMaterial) return;
    // A single physical texture replaces the transformed HTML only in free orbit.
    laptopScreenMaterial.color.set(mode === 'object' ? 0xffffff : 0x000000);
    if (mode === 'object') drawDesktopLCD();
  }

  function listen(target, type, handler, eventOptions) {
    target.addEventListener(type, handler, eventOptions);
    unlisten.push(() => target.removeEventListener(type, handler, eventOptions));
  }
  function canRender() { return !disposed && !suspended && !expanded && !document.hidden; }
  function desiredScreenWidth() { return width < 680 ? width * .91 : Math.min(width * .66, (height - 155) * ratio * .89); }
  function workPose() {
    const distance = (screen.right - screen.left) * height / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * desiredScreenWidth());
    const target = screenCenter.clone();
    return { target, position: target.clone().add(new THREE.Vector3(.002, distance * .012, distance)) };
  }
  function deskPose() {
    const distance = Math.max(1.65, 1.68 / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * (width / height) * .9), .67 * height / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * Math.max(250, height - 175)));
    const target = new THREE.Vector3(-.185, .255, -.07);
    return { target, position: target.clone().add(new THREE.Vector3(.02, distance * .105, distance)) };
  }
  function televisionPose() {
    if (!tvModel) return deskPose();
    const target = new THREE.Vector3((tvScreen.left + tvScreen.right) / 2, (tvScreen.top + tvScreen.bottom) / 2, tvScreen.z);
    let bodyBounds;
    if (width >= 680) {
      bodyBounds = tvModel.userData.archiveViewerBounds;
      if (!bodyBounds) {
        bodyBounds = new THREE.Box3();
        const inverse = tvModel.matrixWorld.clone().invert();
        tvModel.traverse(object => {
          if (!object.isMesh || !object.geometry) return;
          object.geometry.computeBoundingBox();
          const relative = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
          bodyBounds.union(object.geometry.boundingBox.clone().applyMatrix4(relative));
        });
        tvModel.userData.archiveViewerBounds = bodyBounds;
      }
      target.x = (bodyBounds.min.x + bodyBounds.max.x) / 2;
    }
    tvModel.localToWorld(target);
    const tangent = Math.tan(THREE.MathUtils.degToRad(15));
    const desiredWidth = width < 680 ? width * .89 : Math.min(width * .57, (height - 155) * tvRatio * .9);
    let distance = (tvScreen.right - tvScreen.left) * tvModel.scale.x * height / (2 * tangent * desiredWidth);
    if (bodyBounds) {
      // Fit the cabinet's nearest corners too, leaving five percent on each side.
      const cabinetWidth = (bodyBounds.max.x - bodyBounds.min.x) * tvModel.scale.x;
      const frontOffset = Math.max(0, bodyBounds.max.z - tvScreen.z) * tvModel.scale.x;
      distance = Math.max(distance, cabinetWidth / (2 * tangent * (width / height) * .9) + frontOffset);
    }
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(tvModel.quaternion);
    return { target, position: target.clone().addScaledVector(normal, distance).add(new THREE.Vector3(0, .002, 0)) };
  }
  function radioPose() {
    const wide = width > 1000;
    const desiredWidth = wide ? Math.min(width * .47, 650) : Math.min(width * .88, 510);
    const tangent = Math.tan(THREE.MathUtils.degToRad(15));
    const bounds = new THREE.Box3().setFromObject(radioObject.group);
    const radioHeight = bounds.max.y - bounds.min.y;
    const panelTop = document.getElementById('radio-panel')?.getBoundingClientRect().top || height * .6;
    const top = wide ? 72 : 66, bottom = wide ? height - 112 : Math.max(top + 170, panelTop - 22);
    const availableHeight = Math.max(170, bottom - top);
    const distance = Math.max(.4 * radioScale * height / (2 * tangent * desiredWidth), radioHeight * height / (2 * tangent * availableHeight));
    const centerY = (bounds.min.y + bounds.max.y) / 2;
    // Put the entire aerial above the controls at narrow widths, keeping the
    // same left/right arrangement on desktop. The lower panel stays untouched.
    const pixelCenter = (top + bottom) / 2;
    const target = radioPosition.clone().add(new THREE.Vector3(wide ? .17 * radioScale : 0, 0, .035 * radioScale));
    target.y = centerY + (pixelCenter - height / 2) * 2 * tangent * distance / height;
    return { target, position: target.clone().add(new THREE.Vector3(-.008, .065 * radioScale, distance)) };
  }
  function poseForMode() { return mode === 'radio' ? radioPose() : mode === 'tv' ? televisionPose() : mode === 'work' ? workPose() : deskPose(); }
  function applyPose(pose) {
    camera.position.copy(pose.position); controls.target.copy(pose.target); camera.lookAt(pose.target);
    cameraDirty = true;
  }
  function moveTo(pose, animate = true) {
    controls.enabled = false;
    const alreadyThere = camera.position.distanceToSquared(pose.position) < 1e-8 && controls.target.distanceToSquared(pose.target) < 1e-8;
    if (!animate || alreadyThere || reduced.matches || motionDisabled || !canRender()) {
      tween = null; applyPose(pose); controls.enabled = mode === 'object' && canRender();
    } else {
      tween = { start: performance.now(), duration: 800, from: camera.position.clone(), to: pose.position, fromTarget: controls.target.clone(), toTarget: pose.target };
    }
    requestFrame();
  }
  function syncVisibility() {
    const all = mode === 'desk' || mode === 'object';
    if (laptopModel) laptopModel.visible = all || mode === 'work';
    if (tvModel) tvModel.visible = all || mode === 'tv';
    radioObject.group.visible = all || mode === 'radio';
    syncLaptopLCD();
    renderer.shadowMap.needsUpdate = true;
    cameraDirty = true;
  }
  function mapQuad(p, w, h) {
    const [p0, p1, p2, p3] = p;
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = Math.abs(den) > 1e-8 ? (dx3 * dy2 - dx2 * dy3) / den : 0;
    const k = Math.abs(den) > 1e-8 ? (dx1 * dy3 - dx3 * dy1) / den : 0;
    const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + k * p3.x;
    const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + k * p3.y;
    return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${p0.x},${p0.y},0,1)`;
  }
  function projectQuad(points, element, w, h, object) {
    for (let i = 0; i < 4; i++) {
      projection[i].copy(points[i]); if (object) object.localToWorld(projection[i]);
      projection[i].project(camera);
      projection[i].x = (projection[i].x * .5 + .5) * width;
      projection[i].y = (-projection[i].y * .5 + .5) * height;
    }
    const transform = mapQuad(projection, w, h);
    if (element.style.transform !== transform) element.style.transform = transform;
  }
  function positionScreens() {
    if (!cameraDirty || !canRender()) return;
    const liveDesktop = mode === 'work' || mode === 'desk';
    anchor.style.visibility = camera.position.z > screen.z + .03 && liveDesktop ? 'visible' : 'hidden';
    if (liveDesktop) projectQuad(corners, anchor, logicalWidth, logicalHeight);
    if (tvModel && mode === 'tv') projectQuad(tvCorners, tvAnchor, 760, 760 / tvRatio, tvModel);
    cameraDirty = false;
  }
  function requestFrame(textureChanged = false) {
    if (!canRender()) return;
    if (textureChanged && tvTexture) tvTexture.needsUpdate = true;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function reportStats(now, force = false) {
    if (!latestMetrics || (!force && now - lastStats < 250)) return;
    lastStats = now;
    options.onFrameStats?.({ ...latestMetrics, frames: totalFrames, interaction: interacting });
  }
  function applyResolution() {
    renderer.setPixelRatio(baseDPR * resolutionScale); renderer.setSize(width, height, false);
  }
  function recoverQualityWhenIdle() {
    if (qualityTimer !== null || resolutionScale === 1) return;
    qualityTimer = setTimeout(() => {
      qualityTimer = null;
      if (!canRender() || interacting || mode !== 'object') return;
      resolutionScale = 1; slowRenders = 0; applyResolution(); requestFrame();
    }, 450);
  }
  function tick(now) {
    frame = 0;
    if (!canRender()) return;
    const frameMs = lastFrame && now - lastFrame < 200 ? now - lastFrame : 0;
    const deltaSeconds = Math.min(.05, frameMs ? frameMs / 1000 : 1 / 60);
    lastFrame = now;
    let moving = false;
    if (tween) {
      const p = Math.min(1, (now - tween.start) / tween.duration), eased = 1 - Math.pow(1 - p, 4);
      camera.position.lerpVectors(tween.from, tween.to, eased); controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      camera.lookAt(controls.target); cameraDirty = true; moving = true;
      if (p === 1) { tween = null; controls.enabled = mode === 'object' && canRender(); }
    }
    if (!tween && controls.enabled) {
      const changed = controls.update(deltaSeconds); moving = changed || moving; cameraDirty = changed || cameraDirty;
    }
    camera.updateMatrixWorld(); positionScreens();
    const renderStarted = performance.now(); renderer.render(scene, camera);
    const renderMs = performance.now() - renderStarted;
    // Reveal only a frame that has actually drawn the fitted initial composition.
    // If paused/hidden, this remains pending until a real frame can run again.
    if (initialFramePending && !initialReadyFired && !tween && (!televisionWanted() || tvReady || tvFailed)) {
      initialFramePending = false; initialReadyFired = true; options.onReady?.();
    }
    totalFrames++;
    latestMetrics = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height, mode, frameMs, renderMs };
    reportStats(now, !moving && !interacting);
    // Only adapt after repeated real submission stalls, never from an idle gap.
    // All geometry and textures remain intact; sharpness returns after the drag.
    if (mode === 'object' && interacting) {
      slowRenders = renderMs > 22 ? slowRenders + 1 : Math.max(0, slowRenders - 1);
      if (slowRenders >= 3 && resolutionScale > .65) {
        resolutionScale = Math.max(.65, resolutionScale * .88); slowRenders = 0; applyResolution();
      }
    } else if (!moving) recoverQualityWhenIdle();
    if (moving && !frame) frame = requestAnimationFrame(tick);
  }
  function stopFrames() {
    cancelAnimationFrame(frame); frame = 0; tween = null; lastFrame = 0;
    clearTimeout(qualityTimer); qualityTimer = null; reportStats(performance.now(), true);
  }
  function cancelDeferredTV() {
    if (idleHandle !== null) { cancelIdleCallback(idleHandle); idleHandle = null; }
    clearTimeout(idleTimer); idleTimer = null;
  }
  function televisionWanted() { return mode === 'tv' || mode === 'desk' || mode === 'object'; }
  function scheduleTelevision() {
    if (tvReady || tvLoading || tvFailed || !ready || !canRender() || !televisionWanted() || idleHandle !== null || idleTimer !== null) return;
    const load = () => {
      idleHandle = null; idleTimer = null;
      if (canRender() && televisionWanted()) void loadTelevision();
    };
    if (mode === 'tv' || initialFramePending) { void loadTelevision(); return; }
    if ('requestIdleCallback' in window) idleHandle = requestIdleCallback(load, { timeout: 1600 });
    else idleTimer = setTimeout(load, 350);
  }
  function disposeTree(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
  }
  function replaceTelevisionNameplate(mesh) {
    const geometry = mesh.geometry, index = geometry.index;
    if (!index) return;
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    // The original raised plaque's front face, not a new decal on the cabinet.
    const plate = { left: .1509524, right: .2732916, bottom: .4003129, top: .4290596, z: .1896712 };
    const selected = [], remaining = [];
    const onFace = vertex => Math.abs(positions.getZ(vertex) - plate.z) < .000015
      && positions.getX(vertex) >= plate.left - .000015 && positions.getX(vertex) <= plate.right + .000015
      && positions.getY(vertex) >= plate.bottom - .000015 && positions.getY(vertex) <= plate.top + .000015;
    for (let offset = 0; offset < index.count; offset += 3) {
      const triangle = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
      (triangle.every(onFace) ? selected : remaining).push(...triangle);
    }
    if (selected.length !== 6) return;
    const label = document.createElement('canvas'); label.width = 512; label.height = 120;
    const context = label.getContext('2d', { alpha: false });
    if (!context) return;
    const image = context.createImageData(label.width, label.height);
    let seed = 26091986;
    for (let pixel = 0; pixel < label.width * label.height; pixel++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const row = Math.floor(pixel / label.width), column = pixel % label.width;
      const grain = (seed >>> 27) / 11 - 1.4 + Math.sin(row * 1.71) * .7;
      const edge = Math.min(column, label.width - 1 - column, row, label.height - 1 - row);
      const shade = Math.round(Math.max(33, Math.min(49, 47 - row / (label.height - 1) * 11 + grain - Math.max(0, 3 - edge))));
      image.data[pixel * 4] = shade; image.data[pixel * 4 + 1] = shade;
      image.data[pixel * 4 + 2] = shade - 1; image.data[pixel * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    context.strokeStyle = '#8a8d88'; context.lineWidth = 1; context.globalAlpha = .18;
    context.strokeRect(3.5, 3.5, 505, 113); context.globalAlpha = 1;
    // PHILOLS: compact drawn manufacturer lettering, with upright stems and
    // rounded bowls. Quiet silver lettering sits on brushed graphite metal.
    const wordmark = [
      { width: 34, path: 'M0 0H20Q34 0 34 14.5Q34 29 20 29H11V44H0Z M11 10.5V18.5H20Q23 18.5 23 14.5Q23 10.5 20 10.5Z' },
      { width: 34, path: 'M0 0H11.5V16H22.5V0H34V44H22.5V28H11.5V44H0Z' },
      { width: 12, path: 'M0 0H12V44H0Z' },
      { width: 28, path: 'M0 0H11.5V32.5H28V44H0Z' },
      { width: 35, path: 'M13 0H22Q35 0 35 13V31Q35 44 22 44H13Q0 44 0 31V13Q0 0 13 0Z M15.5 11H19.5Q23.5 11 23.5 15V29Q23.5 33 19.5 33H15.5Q11.5 33 11.5 29V15Q11.5 11 15.5 11Z' },
      { width: 28, path: 'M0 0H11.5V32.5H28V44H0Z' },
      { width: 34, path: 'M32 2V13.5Q23 10 16 10Q11.5 10 11.5 13Q11.5 15.5 19 17L23 18Q34 21 34 31.5Q34 44 17 44Q8 44 1 41V29.5Q10 34 18 34Q22.5 34 22.5 31Q22.5 28.5 15 27L11 26Q0 23 0 12.5Q0 0 17 0Q25 0 32 2Z' }
    ];
    context.fillStyle = '#d1d2cd';
    const wordmarkWidth = 251;
    const wordmarkGap = (wordmarkWidth - wordmark.reduce((width, glyph) => width + glyph.width, 0)) / (wordmark.length - 1);
    let wordmarkX = (label.width - wordmarkWidth) / 2;
    for (const glyph of wordmark) {
      context.save(); context.translate(wordmarkX, (label.height - 44) / 2);
      context.fill(new Path2D(glyph.path), 'evenodd'); context.restore();
      wordmarkX += glyph.width + wordmarkGap;
    }
    // Quiet wear follows the printed face; the original metal edge remains intact.
    context.strokeStyle = '#252623'; context.globalAlpha = .18; context.lineWidth = .8;
    for (let scratch = 0; scratch < 15; scratch++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = 9 + (seed % 475), y = 9 + ((seed >>> 12) % 100);
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + 3 + (seed % 17), y + .25); context.stroke();
    }
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(label); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const facePositions = new Float32Array(18), faceNormals = new Float32Array(18), faceUV = new Float32Array(12);
    selected.forEach((vertex, offset) => {
      facePositions.set([positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)], offset * 3);
      faceNormals.set(normals ? [normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex)] : [0, 0, 1], offset * 3);
      faceUV.set([(positions.getX(vertex) - plate.left) / (plate.right - plate.left), (positions.getY(vertex) - plate.bottom) / (plate.top - plate.bottom)], offset * 2);
    });
    const face = new THREE.BufferGeometry();
    face.setAttribute('position', new THREE.BufferAttribute(facePositions, 3));
    face.setAttribute('normal', new THREE.BufferAttribute(faceNormals, 3));
    face.setAttribute('uv', new THREE.BufferAttribute(faceUV, 2));
    const IndexArray = index.array.constructor;
    geometry.setIndex(new THREE.BufferAttribute(new IndexArray(remaining), 1));
    const nameplate = new THREE.Mesh(face, new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: .72, metalness: .16 }));
    nameplate.name = 'archive_tv_nameplate_philols'; nameplate.userData.device = 'tv'; nameplate.receiveShadow = true;
    mesh.add(nameplate);
  }
  async function loadTelevision() {
    if (tvLoading || tvReady || tvFailed || !canRender()) return;
    tvLoading = true;
    try {
      const gltf = await new GLTFLoader().loadAsync('./assets/television/Television_01_2k.gltf');
      if (disposed) { disposeTree(gltf.scene); return; }
      tvModel = gltf.scene; tvModel.position.set(.34, 0, -.28); tvModel.scale.setScalar(.76); tvModel.rotation.y = -.07;
      tvTexture = new THREE.CanvasTexture(tvCanvas); tvTexture.colorSpace = THREE.SRGBColorSpace;
      tvTexture.minFilter = THREE.LinearFilter; tvTexture.generateMipmaps = false;
      const meshes = []; tvModel.traverse(object => { if (object.isMesh) meshes.push(object); });
      for (const mesh of meshes) {
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.device = 'tv';
        const geometry = mesh.geometry;
        if (geometry.index && geometry.index.count === 1918 * 3) {
          // Preserve the supplied model's curved glass, replacing only its screen material.
          const indices = geometry.index.array;
          const displayGeometry = geometry.clone(); displayGeometry.setIndex(new THREE.BufferAttribute(indices.slice(1756 * 3), 1));
          const positions = displayGeometry.getAttribute('position'), uv = new Float32Array(positions.count * 2);
          for (let i = 0; i < positions.count; i++) {
            uv[i * 2] = (positions.getX(i) + .257135) / (.126332 + .257135);
            uv[i * 2 + 1] = (positions.getY(i) - .114147) / (.404233 - .114147);
          }
          displayGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
          geometry.setIndex(new THREE.BufferAttribute(indices.slice(0, 1756 * 3), 1));
          const display = new THREE.Mesh(displayGeometry, new THREE.MeshBasicMaterial({ map: tvTexture, toneMapped: false, side: THREE.DoubleSide }));
          display.name = 'archive_tv_display'; display.userData.device = 'tv'; mesh.add(display);
          // Reuse the real curved glass for a restrained studio reflection.
          // No transmission pass, extra geometry, animation or texture download.
          const glass = new THREE.Mesh(displayGeometry, new THREE.MeshPhysicalMaterial({
            color: 0x080808, transparent: true, opacity: .065,
            roughness: .26, metalness: .025, clearcoat: .85, clearcoatRoughness: .18,
            envMapIntensity: .32, ior: 1.35, reflectivity: .2,
            depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            side: THREE.FrontSide, forceSinglePass: true
          }));
          glass.name = 'archive_tv_glass'; glass.userData.device = 'tv'; mesh.add(glass);
        }
        replaceTelevisionNameplate(mesh);
      }
      scene.add(tvModel); tvModel.updateMatrixWorld(true); tvReady = true;
      syncVisibility(); if (mode === 'tv') moveTo(televisionPose(), !initialFramePending);
      requestFrame(); options.onTVReady?.();
    } catch (error) { if (!disposed) { tvFailed = true; requestFrame(); options.onTVError?.(error); } }
    finally { tvLoading = false; }
  }
  function resize() {
    if (disposed) return;
    width = innerWidth; height = innerHeight;
    if (!canRender()) return;
    // Cap both DPR and total shaded pixels; 4K displays must not multiply the work.
    const pixelBudget = width < 680 ? 950000 : 2100000;
    baseDPR = Math.min(devicePixelRatio || 1, width < 680 ? 1 : 1.25, Math.sqrt(pixelBudget / (width * height)));
    resolutionScale = 1; slowRenders = 0; applyResolution();
    camera.aspect = width / height; camera.updateProjectionMatrix();
    logicalWidth = Math.round(Math.min(800, Math.max(300, desiredScreenWidth()))); logicalHeight = logicalWidth / ratio;
    anchor.style.width = `${logicalWidth}px`; anchor.style.height = `${logicalHeight}px`;
    tvAnchor.style.height = `${760 / tvRatio}px`;
    cameraDirty = true;
    if (ready) { tween = null; applyPose(poseForMode()); controls.enabled = mode === 'object' && canRender(); }
    requestFrame();
  }
  function deviceAt(event) {
    if (!canRender()) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(scene.children, true).find(hit => {
      if (!hit.object.userData.device) return false;
      for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
      return true;
    });
  }
  function clearPointer(event) { pointers.delete(event.pointerId); pointerStart = null; radioDrag = null; }
  function clearGestures() { pointers.clear(); pointerStart = null; radioDrag = null; interacting = false; }
  listen(canvas, 'pointerdown', event => {
    if (!canRender()) return;
    pointers.add(event.pointerId); pointerStart = pointers.size === 1 ? { x: event.clientX, y: event.clientY } : null;
    if (pointers.size > 1) { radioDrag = null; return; }
    if (mode === 'radio' && !tween) {
      const control = deviceAt(event)?.object.userData.radioControl;
      if (control === 'volume' || control === 'tuning') {
        const state = options.getRadioState?.() || {};
        radioDrag = { control, x: event.clientX, y: event.clientY, volume: state.volume || 0, station: Math.max(0, stations.indexOf(state.station)), moved: false };
        canvas.setPointerCapture(event.pointerId);
      }
    }
  });
  listen(canvas, 'pointermove', event => {
    if (!radioDrag || !canRender()) return;
    const delta = event.clientX - radioDrag.x - (event.clientY - radioDrag.y);
    if (Math.abs(delta) < 5 && !radioDrag.moved) return;
    radioDrag.moved = true;
    options.onRadioChange?.(radioDrag.control === 'volume' ? { volume: THREE.MathUtils.clamp(radioDrag.volume + delta / 190, 0, 1) } : { station: stations[((radioDrag.station + Math.round(delta / 65)) % 3 + 3) % 3] });
  });
  listen(canvas, 'pointercancel', clearPointer);
  listen(canvas, 'lostpointercapture', clearPointer);
  listen(canvas, 'pointerup', event => {
    const start = pointerStart, wasDragging = radioDrag?.moved;
    clearPointer(event);
    if (wasDragging || !start || pointers.size || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7 || tween || !canRender()) return;
    const hit = deviceAt(event);
    if (hit) options.onDevice?.({ device: hit.object.userData.device, control: hit.object.userData.radioControl, focused: mode === hit.object.userData.device });
  });
  listen(window, 'pointerup', clearPointer); listen(window, 'pointercancel', clearPointer); listen(window, 'blur', clearGestures);
  listen(canvas, 'keydown', event => {
    if (mode !== 'object' || !canRender() || tween || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') orbit.theta -= .15; if (event.key === 'ArrowRight') orbit.theta += .15;
    if (event.key === 'ArrowUp') orbit.phi -= .1; if (event.key === 'ArrowDown') orbit.phi += .1;
    if (event.key === '+' || event.key === '=') orbit.radius /= 1.12; if (event.key === '-') orbit.radius *= 1.12;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi, .18, Math.PI * .49); orbit.radius = THREE.MathUtils.clamp(orbit.radius, .55, 5.8);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit)); controls.update(); cameraDirty = true; requestFrame();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { stopFrames(); cancelDeferredTV(); clearGestures(); }
    else { resize(); scheduleTelevision(); }
  });
  listen(canvas, 'webglcontextlost', event => { event.preventDefault(); stopFrames(); options.onError?.(new Error('WebGL context lost')); });
  const changed = () => { cameraDirty = true; requestFrame(); };
  const interactionStarted = () => {
    interacting = true; clearTimeout(qualityTimer); qualityTimer = null; lastControlUpdate = performance.now();
    changed();
  };
  const interactionEnded = () => { interacting = false; lastStats = -Infinity; requestFrame(); };
  controls.addEventListener('change', changed); controls.addEventListener('start', interactionStarted); controls.addEventListener('end', interactionEnded);
  unlisten.push(() => {
    controls.removeEventListener('change', changed); controls.removeEventListener('start', interactionStarted); controls.removeEventListener('end', interactionEnded);
  });
  const controller = {
    get ready() { return ready; },
    get tvReady() { return tvReady; },
    setMode(next, { animate = true } = {}) {
      if (disposed) return;
      const changedMode = mode !== next; mode = next;
      if (!changedMode) { scheduleTelevision(); return; }
      clearGestures();
      if (resolutionScale !== 1) { resolutionScale = 1; slowRenders = 0; if (canRender()) applyResolution(); }
      if (!televisionWanted()) cancelDeferredTV();
      syncVisibility();
      moveTo(poseForMode(), animate);
      scheduleTelevision();
    },
    setExpanded(value) {
      if (disposed || expanded === Boolean(value)) return;
      expanded = Boolean(value); clearGestures();
      controls.enabled = mode === 'object' && canRender();
      if (expanded) { stopFrames(); cancelDeferredTV(); }
      else { resize(); applyPose(poseForMode()); requestFrame(); scheduleTelevision(); }
    },
    setSuspended(value) {
      if (disposed || suspended === Boolean(value)) return;
      suspended = Boolean(value); clearGestures(); controls.enabled = mode === 'object' && canRender();
      if (suspended) { stopFrames(); cancelDeferredTV(); }
      else { resize(); applyPose(poseForMode()); requestFrame(); scheduleTelevision(); }
    },
    setMotionDisabled(value) {
      motionDisabled = Boolean(value); controls.enableDamping = !(reduced.matches || motionDisabled);
      if (tween && (motionDisabled || reduced.matches)) { tween = null; applyPose(poseForMode()); requestFrame(); }
    },
    setRadioState(state) { if (!disposed) { radioObject.setState(state); requestFrame(); } },
    setEntered(value) {
      if (disposed || entered === Boolean(value)) return;
      entered = Boolean(value); drawDesktopLCD();
      if (mode === 'object') requestFrame();
    },
    resize, requestFrame: () => requestFrame(true),
    dispose() {
      if (disposed) return;
      disposed = true; stopFrames(); cancelDeferredTV(); clearGestures();
      unlisten.forEach(remove => remove()); controls.dispose();
      scene.remove(radioObject.group); radioObject.dispose();
      disposeTree(scene); environmentTarget.dispose(); keyLight.shadow.map?.dispose(); renderer.dispose();
    }
  };
  resize(); syncVisibility(); applyPose(deskPose()); requestFrame();
  void new GLTFLoader().loadAsync('./assets/laptop/classic_laptop_2k.gltf').then(gltf => {
    if (disposed) { disposeTree(gltf.scene); return; }
    laptopModel = gltf.scene; laptopModel.position.copy(laptopOffset);
    createDesktopLCD();
    laptopModel.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true; object.userData.device = 'computer';
      if (object.material?.name === 'classic_laptop_screen') {
        object.material.dispose();
        const positions = object.geometry.getAttribute('position'), uv = new Float32Array(positions.count * 2);
        object.geometry.computeBoundingBox(); const bounds = object.geometry.boundingBox;
        for (let i = 0; i < positions.count; i++) {
          uv[i * 2] = (positions.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x);
          uv[i * 2 + 1] = (positions.getY(i) - bounds.min.y) / (bounds.max.y - bounds.min.y);
        }
        object.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        laptopScreenMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, map: desktopTexture, toneMapped: false });
        object.material = laptopScreenMaterial;
      }
    });
    removeLaptopLabels(laptopModel, THREE.ShaderChunk); scene.add(laptopModel); ready = true;
    syncVisibility(); moveTo(poseForMode(), false); initialFramePending = !initialReadyFired;
    requestFrame(); scheduleTelevision();
  }).catch(error => { if (!disposed) options.onError?.(error); });
  return controller;
}
