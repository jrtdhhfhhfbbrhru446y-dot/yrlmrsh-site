import { startStartupLoader } from './startup-loader.js?v=studio-66-final';

const loading = startStartupLoader();
void import('./computer.js?v=studio-66-final').catch(error => {
  console.warn('Portfolio startup failed.', error);
  loading.fail();
});
