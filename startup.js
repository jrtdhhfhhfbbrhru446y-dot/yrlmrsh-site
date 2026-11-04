import { startStartupLoader } from './startup-loader.js?v=studio-68-final';

const loading = startStartupLoader();
// Discover desktop dependencies while the unchanged eye is already running.
// The narrow/coarse layout does not need a WebGL engine or its modules.
if (!matchMedia('(max-width: 760px), (max-width: 1024px) and (any-pointer: coarse)').matches) {
  void import('./scene-3d.js?v=studio-68-final')
    .then(({ preloadScene3D }) => preloadScene3D())
    .catch(() => { /* The normal scene path handles a failed dependency. */ });
}
void import('./computer.js?v=studio-68-final').catch(error => {
  console.warn('Portfolio startup failed.', error);
  loading.fail();
});
