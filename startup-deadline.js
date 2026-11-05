// Limit foreground waiting without treating time in another tab as a slow visit.
export function createStartupDeadline({
  delayMs = 8000,
  onSlow = () => {},
  document = globalThis.document,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
  now = () => performance.now()
} = {}) {
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError('A startup deadline must be a finite non-negative duration.');
  let remaining = delayMs, startedAt = null, timer = null, generation = 0, finished = false;

  function cancelTimer() {
    ++generation;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function consumeVisibleTime() {
    if (startedAt !== null) remaining = Math.max(0, remaining - Math.max(0, now() - startedAt));
    startedAt = null;
  }
  function finish() {
    if (finished) return;
    finished = true;
    cancelTimer();
    startedAt = null;
    document?.removeEventListener?.('visibilitychange', visibilityChanged);
  }
  function arm() {
    if (finished || document?.hidden || timer !== null) return;
    startedAt = now();
    const ticket = ++generation;
    timer = setTimeout(() => {
      if (finished || ticket !== generation) return;
      timer = null;
      if (document?.hidden) {
        // A hidden transition may be observable before its event is delivered.
        // Its exact boundary is unknown here; do not charge that segment.
        startedAt = null;
        return;
      }
      consumeVisibleTime();
      if (remaining > 0) { arm(); return; }
      finish();
      onSlow();
    }, remaining);
  }
  function visibilityChanged() {
    if (finished) return;
    if (document?.hidden) {
      consumeVisibleTime();
      cancelTimer();
    } else arm();
  }

  document?.addEventListener?.('visibilitychange', visibilityChanged);
  arm();
  return { finish, dispose: finish };
}
