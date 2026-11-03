import { createEyeLoader } from './loading-eye.js?v=studio-66-final';

let initialSession = null;

// The small entry starts the loader while the rest of the portfolio downloads.
// The application adopts this same instance, so the animation never restarts.
export function startStartupLoader() {
  const cover = document.querySelector('#loading-cover');
  const session = { eye: null, onReveal: null };
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
    onReveal: () => session.onReveal?.()
  });
  initialSession = session;
  return {
    fail() {
      session.eye.dispose(); initialSession = null;
      const message = document.createElement('p');
      message.textContent = 'Не удалось открыть портфолио.';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Попробовать ещё раз';
      retry.addEventListener('click', () => location.reload());
      cover.replaceChildren(message, retry);
      retry.focus();
    }
  };
}

export function takeStartupLoader() {
  const session = initialSession;
  initialSession = null;
  return session;
}
