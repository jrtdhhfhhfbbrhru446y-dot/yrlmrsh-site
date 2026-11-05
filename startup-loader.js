import { createEyeLoader } from './loading-eye.js?v=studio-71-final';

let initialSession = null;

// The small entry starts the loader while the rest of the portfolio downloads.
// The application adopts this same instance, so the animation never restarts.
export function startStartupLoader() {
  const guard = globalThis.__yrlmrshStartupGuard;
  // A module arriving after recovery must not cover the readable page again.
  if (guard?.failed) return { cancelled: true, fail() {} };
  const cover = document.querySelector('#loading-cover');
  const session = { eye: null, onReveal: null };
  let failed = false;
  const dispose = () => {
    if (failed) return;
    failed = true; session.eye?.dispose();
    if (initialSession === session) initialSession = null;
  };
  guard?.onFailure(dispose);
  let motionDisabled = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    const saved = JSON.parse(localStorage.getItem('archive26:view:1') || 'null');
    if (saved?.motion === false) motionDisabled = true;
  } catch { /* The loader also works when storage is unavailable. */ }
  document.body.classList.add('is-loading');
  for (const selector of ['#experience', '.view-controls', '.identity']) {
    const element = document.querySelector(selector);
    if (element) element.inert = true;
  }
  session.eye = createEyeLoader(document.querySelector('#loading-eye'), {
    reducedMotion: motionDisabled,
    onReveal: () => { if (!failed && !guard?.failed) session.onReveal?.(); }
  });
  initialSession = session;
  return {
    fail() {
      if (failed) return;
      if (guard) { guard.fail('application'); return; }
      dispose();
      const fallback = document.querySelector('#seo-fallback');
      document.body.classList.remove('is-loading', 'intro-revealing');
      document.body.classList.add('fallback-readable');
      cover.classList.add('is-loaded');
      const message = document.createElement('div');
      message.className = 'fallback-notice';
      message.setAttribute('role', 'status');
      message.textContent = 'Интерактивная версия не загрузилась. Содержание портфолио доступно ниже.';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Попробовать ещё раз';
      retry.addEventListener('click', () => location.reload());
      message.append(document.createElement('br'), retry);
      if (fallback) { fallback.inert = false; fallback.prepend(message); }
      else cover.replaceChildren(message);
      retry.focus();
    }
  };
}

export function takeStartupLoader() {
  const session = initialSession;
  initialSession = null;
  return session;
}
