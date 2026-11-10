import { initOS, getBrowserPageView } from './os-ui.js?v=studio-81-final';
import { createEyeLoader, createStartupTimingRecorder } from './loading-eye.js?v=studio-71-final';
import { takeStartupLoader } from './startup-loader.js?v=studio-76-final';
import { createTelevision } from './television.js?v=studio-81-final';
import { createRadio } from './radio.js?v=studio-79-final';
import { attachGlassDock } from './glass-dock.js?v=studio-82-final';

import { createStartupDeadline } from './startup-deadline.js?v=studio-76-final';

const startupGuard = globalThis.__yrlmrshStartupGuard;
if (startupGuard?.failed) throw new DOMException('Startup already recovered.', 'AbortError');

const $ = selector => document.querySelector(selector);
const startupTimings = createStartupTimingRecorder();
let startupCompleteMarked = false;
const anchor = $('#screen-anchor'), root = $('#os-root');
const loginScreen = $('#login-screen'), enterButton = $('#enter-desktop');
const tvAnchor = $('#tv-anchor'), tvRoot = $('#tv-root');
const radioPanel = $('#radio-panel'), radioRoot = $('#radio-root'), canvas = $('#computer-canvas');
const modeButton = $('#expand-screen'), status = $('#device-status');
attachGlassDock($('.view-controls'));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// Narrow layouts are mobile regardless of the browser's primary pointer.
// Larger touch screens, including landscape phones, keep the app layout too.
const mobileViewport = matchMedia('(max-width: 760px), (max-width: 1024px) and (any-pointer: coarse)');
let mobile = mobileViewport.matches;
const textVersion = new URLSearchParams(location.search).get('view') === 'text';
// Desktop visits start with the scene; phones and the text view stay flat.
let preferredFlat = false;
let flat = mobile || textVersion;
const startupUrl = new URL(location.href);
if (startupUrl.searchParams.has('flat')) {
  startupUrl.searchParams.delete('flat');
  history.replaceState(history.state, '', startupUrl);
}
let mode = flat ? 'work' : 'desk';
document.body.classList.toggle('mobile-mode', mobile);
let engine = null, scenePromise = null, sceneFailed = false, tvFailed = false;
let bootDone = false, entered = false, motionDisabled = reduced.matches;
let loadingEye = null, loadingTicket = 0, startupDeadline = null;
let backgroundSceneLoading = false;
let initialPageReady = Promise.resolve({ ready: true });
let initialPageSucceeded = false;
const initialPageView = textVersion ? null : getBrowserPageView();
let initialLoadingSession = takeStartupLoader();
const loadingCover = $('#loading-cover');
const readableContent = $('#seo-fallback');
function prepareReadableContent() {
  if (readableContent) readableContent.hidden = !textVersion;
  document.body.classList.toggle('text-mode', textVersion);
}
if (textVersion && readableContent) {
  const back = document.createElement('a');
  back.href = document.body.dataset.pagePath || '/';
  back.className = 'text-version-return';
  back.textContent = '← Вернуться к интерактивной версии';
  readableContent.prepend(back);
}
startupGuard?.onFailure(() => {
  ++loadingTicket; startupDeadline?.dispose();
  backgroundSceneLoading = false;
  loadingEye?.dispose(); loadingEye = null;
  engine?.dispose(); engine = null;
});
addEventListener('pagehide', () => startupDeadline?.dispose());
function setLoadingInteraction(loading) {
  $('#experience').inert = loading;
  $('.view-controls').inert = loading;
  $('.identity').inert = loading;
}
function markReveal() {
  if (!loadingCover.dataset.revealMs) loadingCover.dataset.revealMs = performance.now().toFixed(1);
}

const os = initOS(root, {
  onRestart: () => { entered = false; engine?.setEntered(false); os.open('home', { focus: false }); setMode('work'); bootDone = false; root.hidden = true; loginScreen.hidden = false; showLoading(); void showReady(); },
  onTelevision: id => openTelevision(id),
  onRadio: () => openRadio(),
  onExpand: () => setFlat(!flat),
  onTextVersion: () => {
    const url = new URL(document.querySelector('link[rel=canonical]').href);
    location.assign(url.pathname + '?view=text');
  },
  onViewChange: view => {
    if ((view !== 'home' || bootDone) && mode !== 'work') setMode('work');
  }
});
const desktopIconMarkup = Object.fromEntries([...root.querySelectorAll('.os-desktop-item')].map(button => [button.dataset.go, button.querySelector('svg')?.outerHTML]));
const television = createTelevision(tvRoot, {
  onBack: () => { setMode('work'); focusComputer(); },
  // The focused TV uses its projected HTML canvas; its 3D display is hidden.
  // Camera movement has its own frames. Refresh the texture again on exit.
  onFrame: () => { if (!flat && mode !== 'tv') engine?.requestFrame(); }
});
const radio = createRadio(radioRoot, {
  onBack: () => { setMode('work'); focusComputer(); },
  onStateChange: state => {
    engine?.setRadioState(radioModelState(state));
    $('#radio-view').classList.toggle('has-sound', state.powered);
    $('#radio-view').title = state.powered ? 'Радио включено' : 'Радио';
  }
});

function radioModelState(state) {
  return { ...state, volume: state.recording ? state.volume : state.noiseVolume };
}
function setRadioFromScene(patch) {
  const { volume, ...rest } = patch;
  const level = typeof volume === 'number' ? { [radio.state.recording ? 'volume' : 'noiseVolume']: volume } : {};
  radio.setState({ ...rest, ...level });
}

function finishBoot({ focus = !textVersion } = {}) { return startupTimings.run('startup finishBoot max', () => {
  bootDone = true; root.hidden = !entered; loginScreen.hidden = entered;
  if (focus && (mode === 'work' || mode === 'desk')) focusComputer();
}); }
function focusComputer() { return startupTimings.run('startup focus max', () => { if (entered) os.focus?.(); else enterButton.focus({ preventScroll: true }); }); }
enterButton.addEventListener('click', () => {
  entered = true; loginScreen.hidden = true; root.hidden = false;
  engine?.setEntered(true); setMode('work'); focusComputer();
});
function showLoading() {
  if (startupGuard?.failed) return;
  startupDeadline?.dispose();
  ++loadingTicket; loadingEye?.dispose();
  loadingEye = null;
  setLoadingInteraction(true);
  delete loadingCover.dataset.revealMs; delete loadingCover.dataset.loadedMs;
  document.body.classList.remove('intro-revealing');
  $('#loading-cover').classList.remove('is-loaded'); document.body.classList.add('is-loading');
  const ticket = loadingTicket;
  const onReveal = () => {
      if (ticket !== loadingTicket || startupGuard?.failed) return;
      if (initialPageSucceeded) prepareReadableContent();
      markReveal();
      startupTimings.run('startup reveal classes', () => { document.body.classList.add('intro-revealing'); document.body.classList.remove('is-loading'); });
      startupTimings.run('startup reveal inert', () => setLoadingInteraction(false));
      finishBoot();
      startupTimings.flush();
  };
  if (initialLoadingSession) {
    loadingEye = initialLoadingSession.eye;
    initialLoadingSession.onReveal = onReveal;
    initialLoadingSession = null;
  } else loadingEye = createEyeLoader($('#loading-eye'), {
    reducedMotion: reduced.matches || motionDisabled,
    onReveal
  });
  if (!flat && !engine?.ready) startupDeadline = createStartupDeadline({
    onSlow: () => {
      if (ticket !== loadingTicket || startupGuard?.failed || engine?.ready || mobile) return;
      backgroundSceneLoading = true;
      document.body.dataset.startupSurface = 'progressive';
      setFlat(true, { persist: false, temporary: true });
    }
  });
}
async function showReady({ immediate = false } = {}) {
  if (startupGuard?.failed || startupCompleteMarked && !loadingEye) return;
  anchor.classList.add('is-ready');
  loadingCover.dataset.readyMs = performance.now().toFixed(1);
  const eye = loadingEye, ticket = loadingTicket;
  const initialPage = await initialPageReady;
  if (startupGuard?.failed || ticket !== loadingTicket) return;
  if (!initialPage.ready || (initialPageView && initialPage.view !== initialPageView)) {
    startupGuard?.fail('page');
    return;
  }
  initialPageSucceeded = true;
  startupDeadline?.finish();
  if (eye && !immediate) await eye.finish();
  if (ticket !== loadingTicket || eye !== loadingEye || startupGuard?.failed) return;
  eye?.dispose(); loadingEye = null;
  prepareReadableContent();
  markReveal(); loadingCover.dataset.loadedMs = performance.now().toFixed(1);
  $('#loading-cover').classList.add('is-loaded'); document.body.classList.remove('is-loading');
  setLoadingInteraction(false);
  document.body.classList.remove('intro-revealing');
  if (!bootDone) finishBoot();
  else if (!textVersion && (mode === 'work' || mode === 'desk')) focusComputer();
  startupGuard?.ready();
  startupTimings.stop();
  if (!startupCompleteMarked) {
    startupCompleteMarked = true;
    // Elapsed readiness is distinct from CPU cost and from the loader's LCP.
    // Wait for two paint opportunities after the cover and inert are removed.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { performance.measure?.('YRLMRSH full startup elapsed', { start: 0, end: performance.now() }); }
      catch { /* Unsupported diagnostics must never affect the interface. */ }
    }));
  }
}
function skipBoot() { finishBoot(); }
root.addEventListener('retro-settings', event => {
  motionDisabled = Boolean(event.detail.reducedMotion);
  document.body.classList.toggle('crt-off', event.detail.crt === false);
  document.body.classList.toggle('motion-off', motionDisabled);
  engine?.setMotionDisabled(motionDisabled);
  if (innerWidth < 680 && event.detail.scale > 100 && !flat) setFlat(true, { persist: false });
});
motionDisabled = !os.preferences.motion;
document.body.classList.toggle('crt-off', !os.preferences.crt);
document.body.classList.toggle('motion-off', motionDisabled);

function updateStatus(message = '') { status.hidden = !message; status.textContent = message; }
function syncModes() {
  document.body.classList.toggle('mobile-mode', mobile);
  document.body.classList.toggle('flat-mode', flat);
  document.body.classList.toggle('is-inspecting', !flat && mode === 'object');
  document.body.classList.toggle('is-tv', mode === 'tv');
  document.body.classList.toggle('is-radio', mode === 'radio');
  document.body.classList.toggle('device-pending', !flat && mode === 'tv' && !engine?.tvReady && !tvFailed);
  document.body.dataset.displayMode = flat ? 'flat' : '3d';
  $('meta[name="theme-color"]').content = flat
    ? { tv: '#101010', radio: '#e9e4d6' }[mode] || '#eeede6'
    : '#f7f7f4';
  root.inert = !entered || mode === 'object' || mode === 'tv' || mode === 'radio';
  loginScreen.inert = entered || mode === 'object' || mode === 'tv' || mode === 'radio';
  tvRoot.inert = mode !== 'tv'; radioRoot.inert = mode !== 'radio';
  radioPanel.hidden = mode !== 'radio'; tvAnchor.classList.toggle('is-active', mode === 'tv');
  canvas.tabIndex = !flat && mode === 'object' ? 0 : -1;
  canvas.setAttribute('aria-hidden', String(flat));
  for (const [id, selected] of [['work-view', mode === 'work'], ['tv-view', mode === 'tv'], ['radio-view', mode === 'radio'], ['object-view', mode === 'object' || mode === 'desk']]) {
    $(`#${id}`).setAttribute('aria-pressed', String(selected));
  }
  modeButton.disabled = Boolean(flat && backgroundSceneLoading && !engine?.ready);
  modeButton.setAttribute('aria-pressed', String(flat));
  modeButton.setAttribute('aria-label', flat ? 'Включить 3D' : 'Пользоваться без 3D');
  modeButton.title = flat ? 'Вернуться к 3D-сцене' : 'Обычный сайт без 3D';
  $('#display-mode-label').textContent = modeButton.disabled ? '3D загружается…' : flat ? 'Включить 3D' : 'Без 3D';
  if (modeButton.disabled) modeButton.setAttribute('aria-label', '3D-сцена загружается. Сайт уже доступен.');
  $('#orbit-hint').hidden = flat || mode !== 'object';
  television.setActive(mode === 'tv'); radio.setActive(mode === 'radio');
  root.dispatchEvent(new CustomEvent('retro-activity', { bubbles: true, detail: { active: entered && (mode === 'work' || mode === 'desk') } }));
  root.dispatchEvent(new CustomEvent('retro-viewport', { detail: { mobile } }));
}
function setMode(next) {
  if (flat && (next === 'desk' || next === 'object')) next = 'work';
  const changed = mode !== next; mode = next;
  syncModes();
  engine?.setMode(mode);
  if (mode !== 'tv') updateStatus();
  if (!flat && mode === 'tv' && !engine?.tvReady && !tvFailed) updateStatus('Подключаем телевизор…');
  if (changed) {
    if (mode === 'work') focusComputer();
    else if (mode === 'tv') television.focus();
    else if (mode === 'radio') radio.focus();
    else if (mode === 'object') canvas.focus({ preventScroll: true });
  }
}
function setFlat(value, { persist = true, temporary = false } = {}) {
  if (startupGuard?.failed) return;
  if (mobile || textVersion) backgroundSceneLoading = false;
  if (!value && backgroundSceneLoading && !engine?.ready) return;
  // Phone layout is automatic; it must not replace the desktop preference.
  if (!mobile && !textVersion && !temporary) preferredFlat = Boolean(value);
  flat = mobile || textVersion || Boolean(value);
  if (persist && !mobile) {
    const url = new URL(location.href); url.searchParams.delete('flat'); history.replaceState(history.state, '', url);
  }
  if (flat && (mode === 'object' || mode === 'desk')) mode = 'work';
  if (!flat && mode === 'tv' && tvFailed) mode = 'work';
  engine?.setSuspended(flat && !backgroundSceneLoading);
  if (flat) {
    if (!textVersion && !entered) { entered = true; engine?.setEntered(true); }
    skipBoot(); void showReady({ immediate: !loadingEye }); updateStatus();
  }
  syncModes();
  engine?.setMode(mode, { animate: false });
  if (!flat) {
    sceneFailed = false;
    if (!engine?.ready && !loadingEye) showLoading();
    if (engine) { engine.resize(); engine.requestFrame(); }
    else void ensureScene();
  }
}
function openTelevision(id = null) {
  skipBoot(); television.open(id); setMode('tv');
  if (!flat && tvFailed) setFlat(true, { persist: false });
}
function openRadio() { skipBoot(); setMode('radio'); radio.focus(); }
function onDevice({ device, control, focused }) {
  if (flat) return;
  if (device === 'computer') { setMode('work'); return; }
  if (device === 'tv') { openTelevision(); return; }
  if (device !== 'radio') return;
  if (!focused) openRadio();
  if (control === 'power') radio.toggleRecording();
  else if (focused && control === 'volume') {
    const level = radioModelState(radio.state).volume;
    setRadioFromScene({ volume: level >= .9 ? .1 : Math.min(1, level + .1) });
  }
  else if (focused && control === 'tuning') {
    const stations = ['rain', 'noise', 'wind']; radio.setState({ station: stations[(stations.indexOf(radio.state.station) + 1) % 3] });
  } else if (focused && control?.startsWith('station:')) radio.toggleNoise(control.split(':')[1]);
}
function sceneError(error) {
  if (startupGuard?.failed) return;
  backgroundSceneLoading = false;
  console.warn('3D view unavailable; continuing without 3D.', error);
  sceneFailed = true; engine?.dispose(); engine = null;
  setFlat(true, { persist: false });
}
async function ensureScene() {
  if (startupGuard?.failed || flat && !backgroundSceneLoading || engine || scenePromise) return scenePromise;
  scenePromise = (async () => {
    const { createScene3D } = await import('./scene-3d.js?v=studio-80-final');
    if (startupGuard?.failed || flat && !backgroundSceneLoading) return;
    const controller = await createScene3D({
      canvas, anchor, tvAnchor, tvCanvas: television.canvas,
      isSuspended: () => Boolean(startupGuard?.failed || mobile || flat && !backgroundSceneLoading),
      getEntered: () => entered,
      desktopCaption: '',
      getDesktopIcon: key => desktopIconMarkup[key],
      getRadioState: () => radioModelState(radio.state),
      onReady: () => {
        if (startupGuard?.failed) return;
        startupDeadline?.finish();
        backgroundSceneLoading = false;
        engine?.setSuspended(flat);
        syncModes();
        if (loadingEye) void showReady();
      },
      onTVReady: () => { tvFailed = false; updateStatus(); syncModes(); },
      onTVError: error => { tvFailed = true; if (mode === 'tv' && !flat) setFlat(true, { persist: false }); console.warn('TV model unavailable.', error); },
      onError: sceneError,
      onDevice,
      onRadioChange: setRadioFromScene,
      onFrameStats: stats => {
        canvas.dataset.renderCount = String(stats.frames);
        canvas.dataset.renderCalls = String(stats.calls);
        canvas.dataset.triangles = String(stats.triangles);
        canvas.dataset.renderSize = `${stats.width}×${stats.height}`;
        canvas.dataset.frameMs = Number(stats.frameMs || 0).toFixed(1);
        canvas.dataset.renderMs = Number(stats.renderMs || 0).toFixed(1);
        canvas.dataset.interaction = String(Boolean(stats.interaction));
      }
    });
    if (startupGuard?.failed) { controller.dispose(); return; }
    engine = controller;
    engine.setEntered(entered);
    engine.setSuspended(flat && !backgroundSceneLoading); engine.setMotionDisabled(motionDisabled);
    engine.setMode(mode, { animate: false });
    if (!flat) engine.resize();
    syncModes();
  })().catch(error => { if (error.name !== 'AbortError') sceneError(error); }).finally(() => {
    scenePromise = null;
    if (!startupGuard?.failed && !flat && !engine && !sceneFailed) void ensureScene();
  });
  return scenePromise;
}
$('#work-view').addEventListener('click', () => {
  if (flat && mode === 'work' && entered) os.open('home');
  setMode('work');
});
$('#tv-view').addEventListener('click', () => openTelevision());
$('#radio-view').addEventListener('click', openRadio);
$('#object-view').addEventListener('click', () => setMode('object'));
modeButton.addEventListener('click', () => setFlat(!flat));
function updateViewportMode() {
  const nextMobile = mobileViewport.matches;
  if (nextMobile !== mobile) {
    mobile = nextMobile;
    setFlat(preferredFlat, { persist: false });
  } else {
    syncModes();
    if (!flat) engine?.resize();
  }
}
let viewportBaselineWidth = innerWidth, viewportBaselineHeight = innerHeight;
function updateVisualViewport() {
  if (!mobile) { document.body.style.removeProperty('--app-height'); document.body.classList.remove('keyboard-open'); return; }
  const visual = window.visualViewport;
  document.body.style.setProperty('--app-height', `${Math.round(visual?.height || innerHeight)}px`);
  const editingElement = document.activeElement;
  const editing = editingElement?.matches('input:not([type="range"]), textarea, [contenteditable="true"]');
  // Some mobile browsers resize both viewports for the keyboard. Retain the
  // unobstructed height instead of relying only on their current difference.
  if (Math.abs(innerWidth - viewportBaselineWidth) > 120) {
    viewportBaselineWidth = innerWidth; viewportBaselineHeight = innerHeight;
  } else if (!editing) viewportBaselineHeight = Math.max(viewportBaselineHeight, innerHeight);
  const keyboardOpen = Boolean(editing && visual && Math.max(innerHeight, viewportBaselineHeight) - visual.height > 120);
  document.body.classList.toggle('keyboard-open', keyboardOpen);
  if (keyboardOpen) requestAnimationFrame(() => {
    if (document.activeElement === editingElement) editingElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });
}
mobileViewport.addEventListener('change', updateViewportMode);
addEventListener('resize', () => { updateViewportMode(); updateVisualViewport(); });
window.visualViewport?.addEventListener('resize', updateVisualViewport);
document.addEventListener('focusin', updateVisualViewport);
document.addEventListener('focusout', updateVisualViewport);
updateVisualViewport();
if (initialPageView || flat && !textVersion) {
  entered = true; mode = 'work';
  root.hidden = false; loginScreen.hidden = true;
}
if (initialPageView) {
  os.open(initialPageView, { remember: false, focus: false });
  initialPageReady = os.whenReady();
}
syncModes();
if (flat) { showLoading(); void showReady(); }
else { showLoading(); void ensureScene(); }
