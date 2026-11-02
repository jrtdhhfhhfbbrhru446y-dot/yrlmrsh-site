// A plain hit target owns dragging; the browser's internal range thumb does not.
// The input remains the accessible, keyboard-operated control and visual thumb.
export function bindRangeDrag(input, { onInput = () => {}, onStart = () => {}, onEnd = () => {}, thumbSize = 14 } = {}) {
  const win = input.ownerDocument.defaultView;
  const doc = input.ownerDocument;
  const styles = ['touch-action', 'pointer-events', 'width'].map(name => [name, input.style.getPropertyValue(name), input.style.getPropertyPriority(name)]);
  const hitTarget = doc.createElement('div');
  hitTarget.className = 'media-range-hit-target';
  for (const [name, value] of Object.entries({
    display: 'block', position: 'relative', flex: '1 1 0%', 'min-width': '0',
    width: '100%', 'touch-action': 'none', 'user-select': 'none', cursor: 'pointer'
  })) hitTarget.style.setProperty(name, value);
  input.parentNode.insertBefore(hitTarget, input);
  hitTarget.appendChild(input);
  input.style.setProperty('touch-action', 'none');
  input.style.setProperty('pointer-events', 'none');
  input.style.setProperty('width', '100%');
  let pointerId = null, disposed = false;

  function valueAt(clientX) {
    const min = input.min === '' ? 0 : Number(input.min);
    const max = input.max === '' ? 100 : Number(input.max);
    const rect = input.getBoundingClientRect();
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || rect.width <= 0) return null;
    // Thumb dimensions scale with the surrounding device, just like the track.
    const scale = input.offsetWidth > 0 ? rect.width / input.offsetWidth : 1;
    const inset = Math.min(rect.width / 2, Math.max(0, thumbSize * scale / 2));
    const width = Math.max(1, rect.width - inset * 2);
    let fraction = Math.max(0, Math.min(1, (clientX - rect.left - inset) / width));
    if (win.getComputedStyle(input).direction === 'rtl') fraction = 1 - fraction;
    let value = min + fraction * (max - min);
    if (input.step !== 'any') {
      const supplied = Number(input.step);
      const step = Number.isFinite(supplied) && supplied > 0 ? supplied : 1;
      value = min + Math.round((value - min) / step) * step;
    }
    return Math.max(min, Math.min(max, Number(value.toFixed(12))));
  }
  function apply(clientX) {
    if (disposed || input.disabled || !Number.isFinite(clientX)) return;
    const value = valueAt(clientX);
    if (value === null) return;
    input.value = String(value);
    onInput(Number(input.value));
  }
  function finish() {
    if (pointerId === null) return;
    const releasedId = pointerId;
    pointerId = null;
    win.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', up, true);
    win.removeEventListener('pointercancel', cancel, true);
    win.removeEventListener('blur', cancel);
    doc.removeEventListener('visibilitychange', visibility);
    try { if (hitTarget.hasPointerCapture(releasedId)) hitTarget.releasePointerCapture(releasedId); } catch {}
    onEnd();
  }
  function consume(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }
  function move(event) {
    if (event.pointerId !== pointerId) return;
    consume(event);
    if (input.disabled) { finish(); return; }
    apply(event.clientX);
  }
  function up(event) {
    if (event.pointerId !== pointerId) return;
    consume(event);
    apply(event.clientX);
    finish();
  }
  function cancel(event) {
    if (event?.pointerId !== undefined && event.pointerId !== pointerId) return;
    finish();
  }
  function lostCapture(event) {
    // UA-shadow capture events can bubble through the input. Only a loss by
    // our ordinary wrapper ends this gesture.
    if (event.target === hitTarget) cancel(event);
  }
  function visibility() { if (doc.hidden) finish(); }
  function down(event) {
    if (disposed || input.disabled || pointerId !== null || event.isPrimary === false || event.button !== 0 || valueAt(event.clientX) === null) return;
    consume(event);
    pointerId = event.pointerId;
    input.focus({ preventScroll: true });
    try { hitTarget.setPointerCapture(pointerId); } catch {}
    win.addEventListener('pointermove', move, { capture: true, passive: false });
    win.addEventListener('pointerup', up, true);
    win.addEventListener('pointercancel', cancel, true);
    win.addEventListener('blur', cancel);
    doc.addEventListener('visibilitychange', visibility);
    onStart();
    apply(event.clientX);
  }
  hitTarget.addEventListener('pointerdown', down, { passive: false });
  hitTarget.addEventListener('lostpointercapture', lostCapture);
  return {
    get dragging() { return pointerId !== null; },
    cancel: finish,
    dispose() {
      if (disposed) return;
      finish(); disposed = true;
      hitTarget.removeEventListener('pointerdown', down);
      hitTarget.removeEventListener('lostpointercapture', lostCapture);
      if (hitTarget.parentNode) hitTarget.replaceWith(input);
      for (const [name, value, priority] of styles) {
        if (value) input.style.setProperty(name, value, priority);
        else input.style.removeProperty(name);
      }
    }
  };
}
