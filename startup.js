import { startStartupLoader } from './startup-loader.js?v=studio-76-final';

// The inline guard remains available even if this module or its imports fail.
if (!globalThis.__yrlmrshStartupGuard?.failed) {
  const loading = startStartupLoader();
  const textVersion = new URLSearchParams(location.search).get('view') === 'text';
  // Discover desktop dependencies while the unchanged eye is already running.
  if (!textVersion && !matchMedia('(max-width: 760px), (max-width: 1024px) and (any-pointer: coarse)').matches) {
    void import('./scene-3d.js?v=studio-80-final')
      .then(({ preloadScene3D }) => preloadScene3D())
      .catch(() => { /* The normal scene path handles a failed dependency. */ });
  }
  if (!loading.cancelled) void import('./computer.js?v=studio-97-final').catch(error => {
    if (!globalThis.__yrlmrshStartupGuard?.failed) console.warn('Portfolio startup failed.', error);
    loading.fail();
  });
}
