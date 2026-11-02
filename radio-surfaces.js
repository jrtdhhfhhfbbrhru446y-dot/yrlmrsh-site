/** Static, seeded PBR artwork. Wear is baked once; it never adds scene meshes. */
export function createRadioSurfaceTools(THREE, canvas, texture, random) {
  const clamp = value => Math.max(0, Math.min(255, value));
  function field(columns, rows) {
    const values = Float32Array.from({ length: (columns + 1) * (rows + 1) }, () => random() * 2 - 1);
    return (u, v) => {
      const x = u * columns, y = v * rows, ix = Math.min(columns - 1, Math.floor(x)), iy = Math.min(rows - 1, Math.floor(y));
      let a = x - ix, b = y - iy;
      a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b);
      const p = iy * (columns + 1) + ix;
      return (values[p] * (1 - a) + values[p + 1] * a) * (1 - b)
        + (values[p + columns + 1] * (1 - a) + values[p + columns + 2] * a) * b;
    };
  }
  function surface(width, height, options = {}) {
    const art = canvas(width, height), rough = canvas(width, height), relief = canvas(width, height);
    const rgb = options.color || [181, 181, 171];
    const image = art.ctx.createImageData(width, height), rImage = rough.ctx.createImageData(width, height), hImage = relief.ctx.createImageData(width, height);
    const broad = field(9, 6), fine = field(48, 30);
    const grain = options.grain ?? 3, mottle = options.mottle ?? 9, baseRoughness = (options.roughness ?? .66) * 255;
    for (let y = 0; y < height; y++) {
      const brushed = (random() - .5) * (options.brush ?? 0);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, u = x / width, v = y / height;
        const macro = broad(u, v), micro = fine(u, v), speck = (random() - .5) * 2;
        const tone = macro * mottle + micro * mottle * .35 + speck * grain + brushed;
        for (let channel = 0; channel < 3; channel++) image.data[i + channel] = clamp(rgb[channel] + tone);
        const rr = clamp(baseRoughness + macro * 15 + micro * 10 + speck * 6 + brushed * 2);
        const hh = clamp(128 + speck * (options.relief ?? 4) + micro * 4 + brushed * .55);
        for (let channel = 0; channel < 3; channel++) {
          rImage.data[i + channel] = rr; hImage.data[i + channel] = hh;
        }
        image.data[i + 3] = rImage.data[i + 3] = hImage.data[i + 3] = 255;
      }
    }
    art.ctx.putImageData(image, 0, 0); rough.ctx.putImageData(rImage, 0, 0); relief.ctx.putImageData(hImage, 0, 0);
    return { ...art, rough, relief, width, height };
  }
  function stain(s, x, y, rx, ry, opacity = .15, color = '91,79,57') {
    for (const [target, center, edge] of [
      [s, `rgba(${color},${opacity})`, `rgba(${color},0)`],
      [s.rough, `rgba(244,244,244,${opacity * 2})`, 'rgba(244,244,244,0)']
    ]) {
      const c = target.ctx;
      c.save(); c.translate(x, y); c.scale(rx, ry);
      const g = c.createRadialGradient(0, 0, .02, 0, 0, 1);
      g.addColorStop(0, center); g.addColorStop(1, edge);
      c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
    }
  }
  function scratch(s, x, y, length, angle, opacity = .22, thickness = .7) {
    const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length;
    const line = (c, color, offset = 0, width = thickness) => {
      c.strokeStyle = color; c.lineWidth = width;
      c.beginPath(); c.moveTo(x, y + offset); c.lineTo(x + dx * .47, y + dy * .46 + offset);
      c.lineTo(x + dx, y + dy + offset); c.stroke();
    };
    line(s.ctx, `rgba(54,52,44,${opacity})`);
    line(s.ctx, `rgba(255,253,237,${opacity * 1.6})`, .8);
    line(s.rough.ctx, 'rgba(238,238,238,.7)', 0, thickness + .7);
    line(s.relief.ctx, 'rgba(62,62,62,.7)');
  }
  function scuffs(s, count, length = 30, opacity = .16) {
    for (let i = 0; i < count; i++) {
      const x = random() * s.width, y = random() * s.height;
      scratch(s, x, y, (3 + random() * length), -.45 + random() * .9, opacity * (.4 + random()), .35 + random() * .5);
    }
  }
  function edgeWear(s, amount = 1) {
    const { ctx: c, width: w, height: h } = s;
    // Uneven dirt at the assembled perimeter; the middle remains clean.
    for (const [x, y, rx, ry] of [[w * .22, 0, w * .3, 23], [w * .8, 0, w * .3, 30],
      [w * .25, h, w * .4, 25], [w * .83, h, w * .24, 30], [0, h * .35, 22, h * .4], [w, h * .7, 22, h * .4]]) {
      stain(s, x, y, rx, ry, .3 * amount);
    }
    // Short exposed edge rubs and nicks, rather than a continuous decorative border.
    for (let i = 0; i < 160 * amount; i++) {
      const horizontal = random() > .3;
      const x = horizontal ? random() * w : random() > .5 ? 3 + random() * 7 : w - 3 - random() * 7;
      const y = horizontal ? random() > .5 ? 3 + random() * 7 : h - 3 - random() * 7 : random() * h;
      scratch(s, x, y, 1 + random() * 11, horizontal ? (random() - .5) * .12 : Math.PI / 2, .12 + random() * .25, .5 + random());
      if (i % 5 === 0) {
        c.fillStyle = 'rgba(99,94,78,.24)'; c.fillRect(x, y, 1 + random() * 2.5, 1 + random() * 1.5);
      }
    }
  }
  function latheSeam(s) {
    // The top of a CanvasTexture is v=1: all angles meet at the face centre.
    // Fade the pole to its row mean and make the u seam periodic on all maps.
    for (const target of [s, s.rough, s.relief]) {
      const pixels = target.ctx.getImageData(0, 0, s.width, s.height), a = pixels.data, w = s.width;
      for (let y = 0; y < s.height; y++) {
        const fade = Math.min(1, y / (s.height * .14));
        const means = [0, 0, 0];
        if (fade < 1) for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) means[k] += a[(y * w + x) * 4 + k] / w;
        if (fade < 1) for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) {
          const i = (y * w + x) * 4 + k; a[i] = means[k] * (1 - fade) + a[i] * fade;
        }
        for (let x = 0; x < 12; x++) for (let k = 0; k < 3; k++) {
          const left = (y * w + x) * 4 + k, right = (y * w + w - 1 - x) * 4 + k;
          const mean = (a[left] + a[right]) / 2, blend = 1 - x / 12;
          a[left] += (mean - a[left]) * blend; a[right] += (mean - a[right]) * blend;
        }
      }
      target.ctx.putImageData(pixels, 0, 0);
    }
  }
  function maps(s, strength = 1.5, { lathe = false } = {}) {
    const { width: w, height: h } = s;
    const heights = s.relief.ctx.getImageData(0, 0, w, h).data;
    const normal = canvas(w, h), pixels = normal.ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const left = (y * w + (x + w - 1) % w) * 4, right = (y * w + (x + 1) % w) * 4;
      const aboveY = lathe ? Math.max(0, y - 1) : (y + h - 1) % h;
      const belowY = lathe ? Math.min(h - 1, y + 1) : (y + 1) % h;
      const above = (aboveY * w + x) * 4, below = (belowY * w + x) * 4;
      const pole = lathe ? Math.min(1, y / (h * .12)) : 1;
      const nx = (heights[left] - heights[right]) / 255 * strength * pole;
      // Canvas y points down; the glTF/OpenGL tangent normal's y points up.
      const ny = (heights[below] - heights[above]) / 255 * strength * pole;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      pixels.data[i] = (nx * inv * .5 + .5) * 255;
      pixels.data[i + 1] = (ny * inv * .5 + .5) * 255;
      pixels.data[i + 2] = (inv * .5 + .5) * 255; pixels.data[i + 3] = 255;
    }
    normal.ctx.putImageData(pixels, 0, 0);
    const map = texture(s.element), roughnessMap = texture(s.rough.element), normalMap = texture(normal.element);
    roughnessMap.colorSpace = normalMap.colorSpace = THREE.NoColorSpace;
    return { map, roughnessMap, normalMap };
  }
  return { surface, stain, scratch, scuffs, edgeWear, latheSeam, maps };
}
