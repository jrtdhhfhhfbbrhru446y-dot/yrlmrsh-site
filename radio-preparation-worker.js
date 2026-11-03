import * as THREE from './assets/vendor/three.module.js';
import { createRadioModel } from './radio-model.js?v=studio-63-final';
import { packRadioModel } from './radio-preparation.js?v=studio-63-final';

let model, prepared;
try {
  const started = performance.now();
  if (typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') throw new Error('Offscreen preparation is unavailable.');
  model = createRadioModel(THREE, { createCanvas: (width, height) => new OffscreenCanvas(width, height) });
  prepared = await packRadioModel(model);
  self.postMessage({ packet: prepared.packet, workerMs: performance.now() - started }, prepared.transfer);
} catch (error) {
  prepared?.packet.images.forEach(({ bitmap }) => bitmap.close?.());
  self.postMessage({ error: error.message || 'Radio preparation failed.' });
} finally {
  model?.dispose();
  self.close();
}
