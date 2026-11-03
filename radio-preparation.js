import { createRadioModel, createRadioController, configureRadioRibMaterial } from './radio-model.js?v=studio-66-final';

// Geometry arrays and bitmaps transfer ownership; no large JSON pixel arrays or
// geometry regeneration are needed on the UI thread.
export async function packRadioModel(model, makeBitmap = globalThis.createImageBitmap) {
  // Object3D.toJSON serializes matrices, not the pending position/quaternion
  // fields. The worker has no renderer to update them before serialization.
  model.group.updateMatrixWorld(true);
  const meta = { geometries: {}, materials: {}, textures: {}, images: {}, shapes: {}, skeletons: {}, animations: {}, nodes: {} };
  const geometries = [], images = [], transfer = new Set();
  model.group.traverse(object => {
    const geometry = object.geometry;
    if (!geometry || meta.geometries[geometry.uuid]) return;
    meta.geometries[geometry.uuid] = { uuid: geometry.uuid };
    const attribute = value => {
      transfer.add(value.array.buffer);
      return { array: value.array, itemSize: value.itemSize, normalized: value.normalized,
        instanced: Boolean(value.isInstancedBufferAttribute), meshPerAttribute: value.meshPerAttribute };
    };
    geometries.push({ uuid: geometry.uuid, attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, value]) => [name, attribute(value)])),
      index: geometry.index ? attribute(geometry.index) : null, groups: geometry.groups, drawRange: geometry.drawRange });
  });
  try {
    for (const texture of model.resources.textures) {
      const source = texture.source;
      if (meta.images[source.uuid]) continue;
      // WebGL ignores texture.flipY/premultiplyAlpha for ImageBitmap. Apply the
      // CanvasTexture upload orientation and alpha policy when creating it.
      const bitmap = await makeBitmap(source.data, {
        imageOrientation: texture.flipY ? 'flipY' : 'none',
        premultiplyAlpha: texture.premultiplyAlpha ? 'premultiply' : 'none', colorSpaceConversion: 'none'
      });
      images.push({ uuid: source.uuid, bitmap }); transfer.add(bitmap);
      meta.images[source.uuid] = { uuid: source.uuid };
    }
    const object = model.group.toJSON(meta).object;
    const ribMaterial = [...model.resources.materials].find(material => material.customProgramCacheKey() === 'radio-rib-wear-atlas-v1')?.uuid;
    return { packet: { object, geometries, images, materials: Object.values(meta.materials), textures: Object.values(meta.textures),
      references: model.preparation, ribMaterial }, transfer: [...transfer] };
  } catch (error) {
    images.forEach(({ bitmap }) => bitmap.close?.());
    throw error;
  }
}

export function restoreRadioModel(THREE, packet) {
  const images = Object.fromEntries(packet.images.map(({ uuid, bitmap }) => [uuid, new THREE.Source(bitmap)]));
  const geometries = {};
  for (const data of packet.geometries) {
    const geometry = new THREE.BufferGeometry(); geometry.uuid = data.uuid;
    const attribute = value => value.instanced
      ? new THREE.InstancedBufferAttribute(value.array, value.itemSize, value.normalized, value.meshPerAttribute)
      : new THREE.BufferAttribute(value.array, value.itemSize, value.normalized);
    for (const [name, value] of Object.entries(data.attributes)) geometry.setAttribute(name, attribute(value));
    if (data.index) geometry.setIndex(attribute(data.index));
    geometry.groups = data.groups; geometry.setDrawRange(data.drawRange.start, data.drawRange.count);
    geometries[data.uuid] = geometry;
  }
  const loader = new THREE.ObjectLoader();
  const textures = loader.parseTextures(packet.textures, images);
  const materials = loader.parseMaterials(packet.materials, textures);
  if (packet.ribMaterial) configureRadioRibMaterial(materials[packet.ribMaterial]);
  const group = loader.parseObject(packet.object, geometries, materials, textures, {});
  const objects = {}; group.traverse(object => { objects[object.uuid] = object; });
  const refs = packet.references;
  return createRadioController(THREE, {
    group, knobs: { volume: objects[refs.volume], tuning: objects[refs.tuning] }, pointer: objects[refs.pointer], lamp: objects[refs.lamp],
    dialMat: materials[refs.dialMaterial], powerKey: objects[refs.powerKey],
    stationButtons: new Map(refs.stations.map(([id, uuid]) => [id, objects[uuid]])),
    geometries: new Set(Object.values(geometries)), materials: new Set(Object.values(materials)), textures: new Set(Object.values(textures)),
    images: packet.images.map(({ bitmap }) => bitmap)
  });
}

export async function prepareRadioModel(THREE) {
  const started = performance.now();
  const unsupported = ['Worker', 'OffscreenCanvas', 'createImageBitmap'].filter(name => typeof globalThis[name] !== 'function');
  let fallbackReason = unsupported.length ? `Unavailable: ${unsupported.join(', ')}` : '';
  if (!unsupported.length) {
    let worker, phase = 'worker';
    try {
      const result = await new Promise((resolve, reject) => {
        worker = new Worker(new URL('./radio-preparation-worker.js?v=studio-66-final', import.meta.url), { type: 'module' });
        let settled = false;
        const settle = action => value => { if (settled) return; settled = true; clearTimeout(timer); action(value); };
        const fail = settle(reject);
        const timer = setTimeout(() => { worker.terminate(); fail(new Error('Radio preparation timed out.')); }, 12000);
        worker.onmessage = event => {
          if (settled) { event.data.packet?.images.forEach(({ bitmap }) => bitmap.close?.()); return; }
          if (event.data.error) fail(new Error(event.data.error));
          else settle(resolve)(event.data);
        };
        worker.onerror = event => { event.preventDefault?.(); fail(new Error(event.message || 'Radio preparation failed.')); };
        worker.onmessageerror = () => fail(new Error('Radio preparation could not be transferred.'));
      });
      phase = 'restore';
      const restoreStarted = performance.now();
      try {
        const model = restoreRadioModel(THREE, result.packet);
        model.preparationStats = { mode: 'worker', elapsedMs: performance.now() - started,
          workerMs: result.workerMs, mainThreadMs: performance.now() - restoreStarted, fallbackReason: '' };
        return model;
      } catch (error) {
        result.packet.images.forEach(({ bitmap }) => bitmap.close?.());
        throw error;
      }
    } catch (error) {
      fallbackReason = `${phase}: ${String(error?.message || error || 'Preparation failed').slice(0, 240)}`;
      // Older engines, blocked module workers and bounded failures retain the
      // original generator and appearance. Give the loader a paint opportunity.
    } finally { worker?.terminate(); }
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  const fallbackStarted = performance.now(), model = createRadioModel(THREE);
  model.preparationStats = { mode: 'main-fallback', elapsedMs: performance.now() - started, mainThreadMs: performance.now() - fallbackStarted, fallbackReason };
  return model;
}
