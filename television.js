import { projects } from './portfolio-data.js?v=studio-70-final';
import { tvServiceLogo, drawTVServiceLogo } from './screen-brand.js?v=studio-11';
import { bindRangeDrag } from './range-drag.js?v=studio-59-final';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const DURATION = 36;
const WHITE = '#eeeeee';
const BLACK = '#040404';
const programs = [
  {
    id: 'in-flow',
    title: 'В потоке',
    video: {
      available: true,
      src: './assets/films/in-flow/in-flow-film-studio54.mp4',
      poster: './assets/films/in-flow/tv-cover-studio54.webp',
      aspectRatio: 16 / 9,
      duration: 28,
    },
  },
  ...projects.filter(project => project.video?.available && typeof project.video.src === 'string' && project.video.src.trim()),
];
const getProgram = id => programs.find(program => program.id === id) || null;
const TV_PROGRAMS = [
  { projectId: 'in-flow', aspectRatio: 16 / 9, previewPoster: './assets/films/in-flow/tv-cover-studio54.webp', previewAspectRatio: 4 / 3 },
  { projectId: 'tracker', aspectRatio: 16 / 9, previewPoster: './assets/cases/tracker/tv-cover-studio43.webp', previewAspectRatio: 4 / 3 },
  { projectId: 'bolo', aspectRatio: 16 / 9, previewPoster: './assets/cases/bolo/tv-cover-studio42.webp', previewAspectRatio: 4 / 3 },
];

function aspectRatio(project) {
  const supplied = project.video?.aspectRatio;
  if (typeof supplied === 'number' && supplied > 0) return supplied;
  if (typeof supplied === 'string') {
    const parts = supplied.split(/[:/]/).map(Number);
    if (parts.length === 2 && parts.every(n => n > 0)) return parts[0] / parts[1];
  }
  return TV_PROGRAMS.find(program => program.projectId === project.id)?.aspectRatio || 4 / 3;
}
function previewAspectRatio(project) {
  return TV_PROGRAMS.find(program => program.projectId === project.id)?.previewAspectRatio || aspectRatio(project);
}
function contain(ratio, width, height) {
  const w = Math.min(width, height * ratio), h = w / ratio;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

// Keep gaps in the browser's real buffer visible instead of treating the last
// downloaded frame as if everything before it had already arrived.
export function videoBufferedSegments(buffered, total) {
  if (!buffered || !Number.isFinite(total) || total <= 0) return [];
  const ranges = [];
  try {
    for (let index = 0; index < buffered.length; index++) {
      const start = Math.max(0, Math.min(total, buffered.start(index)));
      const end = Math.max(0, Math.min(total, buffered.end(index)));
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) ranges.push({ start, end });
    }
  } catch { return []; }
  ranges.sort((a, b) => a.start - b.start);
  return ranges.reduce((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
    return merged;
  }, []);
}

// A failed image gets one new request per explicit retry/online event. Loaded
// and pending images keep their identity; failures never schedule themselves.
export function createPosterRequests({ createImage = () => new Image(), onlineTarget = globalThis.window, canRetryOnOnline = () => true } = {}) {
  const entries = new Map();
  let disposed = false, listening = false;
  function start(entry) {
    if (disposed || entry.status === 'pending' || entry.status === 'loaded') return entry.image;
    const image = createImage();
    entry.image = image; entry.status = 'pending'; image.decoding = 'async';
    const settle = loaded => {
      if (disposed || entry.image !== image || entry.status !== 'pending') return;
      image.onload = image.onerror = null;
      entry.status = loaded && image.naturalWidth > 0 ? 'loaded' : 'failed';
      entry.onSettled();
    };
    image.onload = () => settle(true);
    image.onerror = () => settle(false);
    entry.onImage(image);
    image.src = entry.src;
    return image;
  }
  function retryFailed() {
    if (disposed) return;
    for (const entry of entries.values()) if (entry.status === 'failed') start(entry);
  }
  function online() { if (!disposed && canRetryOnOnline()) retryFailed(); }
  return {
    add(key, src, onImage, onSettled) {
      if (disposed) return null;
      if (entries.has(key)) return entries.get(key).image;
      const entry = { src, onImage, onSettled, status: 'new', image: null };
      entries.set(key, entry);
      if (!listening) { onlineTarget?.addEventListener?.('online', online); listening = true; }
      return start(entry);
    },
    retryFailed,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (listening) onlineTarget?.removeEventListener?.('online', online);
      for (const entry of entries.values()) if (entry.image) entry.image.onload = entry.image.onerror = null;
      entries.clear();
    }
  };
}

// Real project films and local screen studies share the same CRT canvas.
// One canvas feeds the physical television texture and its HTML controls.
export function createTelevision(root, { onBack, onFrame = () => {} } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 720;
  canvas.setAttribute('aria-label', 'Экранный этюд выбранного проекта');
  const ctx = canvas.getContext('2d', { alpha: false });
  const noise = document.createElement('canvas');
  noise.width = noise.height = 96;
  const noiseContext = noise.getContext('2d');
  const noiseImage = noiseContext.createImageData(96, 96);
  let seed = 2619;
  for (let i = 0; i < noiseImage.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = seed >>> 24;
    noiseImage.data[i] = noiseImage.data[i + 1] = noiseImage.data[i + 2] = value;
    noiseImage.data[i + 3] = 255;
  }
  noiseContext.putImageData(noiseImage, 0, 0);
  const noisePattern = ctx.createPattern(noise, 'repeat');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, playing = false, current = null, view = 'library';
  let preview = programs[0], seconds = 0, last = 0, raf = 0, disposed = false;
  let lastTimeLabel = '', lastPlayingState = null, pointerTimer = 0;
  let hoverTimer = 0, hoverGuardUntil = 0, swipe = null, pointerIntent = null, suppressClickUntil = 0, seeking = false;
  let seekDrag = null, volumeDrag = null;
  let crtEnabled = !document.body.classList.contains('crt-off');
  let mobilePresentation = document.body.classList.contains('mobile-mode');
  const posters = new Map();
  const posterImages = new Map();
  const previewImages = new Map();
  const posterRequests = createPosterRequests({ canRetryOnOnline: () => !mobilePresentation || active });
  let media = null, mediaProject = null, mediaListeners = [], muted = false, volume = .8;
  let lastAudibleVolume = volume, lastMutedState = null, postersRequested = false;
  let mediaLoading = false, mediaFailed = false, loadingReason = 'loading', lastBufferKey = '';
  const hasFilm = project => Boolean(project?.video?.available && typeof project.video.src === 'string' && project.video.src.trim());
  const currentFilm = () => hasFilm(current) && media && mediaProject === current.id;
  const duration = () => {
    const measured = currentFilm() && media.duration;
    const supplied = current?.video?.duration;
    return Number.isFinite(measured) && measured > 0 ? measured
      : hasFilm(current) && Number.isFinite(supplied) && supplied > 0 ? supplied : DURATION;
  };
  function message(value = '') {
    const element = root.querySelector('[data-tv-message]');
    if (element) element.textContent = value;
  }
  function updateLoading() {
    const visible = Boolean(active && view === 'player' && currentFilm() && mediaLoading && !mediaFailed);
    const loader = root.querySelector('[data-tv-loading]');
    if (loader) loader.hidden = !visible;
    const label = root.querySelector('[data-tv-loading-text]');
    if (label) label.textContent = loadingReason === 'seek' ? 'Загрузка фрагмента…' : 'Загрузка видео…';
    root.querySelector('[data-tv-picture]')?.setAttribute('aria-busy', String(visible));
    root.dataset.videoLoadState = currentFilm() ? mediaFailed ? 'error' : mediaLoading ? 'loading' : 'ready' : 'idle';
  }
  function setLoading(value, reason = 'loading') {
    mediaLoading = Boolean(value);
    if (value) loadingReason = reason;
    updateLoading();
  }
  function updateBuffered() {
    const holder = root.querySelector('[data-tv-buffered]');
    if (!holder) return;
    const total = duration();
    const ranges = currentFilm() ? videoBufferedSegments(media.buffered, total) : [];
    const key = `${total}:` + ranges.map(({ start, end }) => `${start.toFixed(4)}:${end.toFixed(4)}`).join('|');
    if (key !== lastBufferKey) {
      holder.innerHTML = ranges.map(({ start, end }) => `<span style="left:${(start / total * 100).toFixed(4)}%;width:${((end - start) / total * 100).toFixed(4)}%"></span>`).join('');
      holder.dataset.ranges = JSON.stringify(ranges);
      lastBufferKey = key;
    }
    const percent = total > 0 ? Math.floor(ranges.reduce((sum, range) => sum + range.end - range.start, 0) / total * 100) : 0;
    const summary = root.querySelector('[data-tv-buffer-summary]');
    if (summary) summary.textContent = `Загружено ${Math.min(100, percent)}% видео`;
  }
  function timeIsBuffered(time) {
    return currentFilm() && videoBufferedSegments(media.buffered, duration()).some(range => time >= range.start && time <= range.end);
  }
  function releaseMedia() {
    if (!media) return;
    for (const [event, listener] of mediaListeners) media.removeEventListener(event, listener);
    mediaListeners = [];
    media.pause(); media.removeAttribute('src'); media.load(); media.remove();
    media = null; mediaProject = null;
    mediaLoading = false; mediaFailed = false; lastBufferKey = '';
    updateLoading();
  }
  function prepareMedia(project) {
    releaseMedia();
    if (!hasFilm(project)) return;
    const video = document.createElement('video');
    media = video; mediaProject = project.id;
    // Selection is the first request for the film. Preload its first frame and
    // buffer here, while the unopened TV still makes no movie requests.
    video.className = 'tv-media-source'; video.preload = 'auto';
    video.playsInline = true; video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
    video.muted = muted; video.volume = volume;
    if (project.video.poster) video.poster = project.video.poster;
    const listen = (event, listener) => {
      const guarded = (...args) => { if (!disposed && media === video) listener(...args); };
      video.addEventListener(event, guarded); mediaListeners.push([event, guarded]);
    };
    const sync = () => {
      if (disposed || media !== video || mediaProject !== current?.id) return;
      if (mediaLoading && !video.seeking && video.readyState >= 3) setLoading(false);
      seconds = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      updateTime(); updateBuffered();
      if (!playing || seeking) draw();
    };
    listen('loadstart', () => { mediaFailed = false; message(); setLoading(video.readyState < 2); });
    listen('loadedmetadata', () => { message(); sync(); draw(); });
    listen('loadeddata', () => { if (!video.seeking) setLoading(video.readyState < (video.paused ? 2 : 3)); message(); sync(); draw(); });
    listen('canplay', () => { if (!video.seeking) setLoading(false); sync(); });
    listen('playing', () => { setLoading(false); message(); sync(); });
    const waitingForData = () => {
      if (video.readyState < 3 && (!video.paused || video.seeking || video.readyState < 2)) setLoading(true, 'buffer');
    };
    listen('waiting', waitingForData); listen('stalled', waitingForData);
    listen('suspend', () => {
      // Data Saver and some phone browsers can intentionally stop preloading.
      // A paused poster is not an endlessly buffering playback request.
      if (video.paused && !video.seeking) {
        setLoading(false);
        if (video.readyState < 2) message('Нажмите воспроизведение, чтобы загрузить видео.');
      }
    });
    listen('seeking', () => { if (video.readyState < 3) setLoading(true, 'seek'); });
    listen('progress', updateBuffered); listen('durationchange', sync);
    listen('timeupdate', sync);
    listen('seeked', () => { setLoading(video.readyState < (video.paused ? 2 : 3), 'seek'); sync(); draw(); });
    listen('volumechange', () => {
      if (media !== video) return;
      muted = video.muted; volume = video.volume;
      if (volume > 0) lastAudibleVolume = volume;
      updateSound();
    });
    listen('play', () => {
      if (!active || document.hidden || view !== 'player') { video.pause(); return; }
      playing = true; message(); updateTime(); schedule();
    });
    listen('pause', () => { playing = false; if (video.readyState >= 2 && !video.seeking) setLoading(false); stop(); sync(); revealControls(); });
    listen('ended', () => { playing = false; setLoading(false); stop(); sync(); revealControls(); });
    listen('error', () => {
      mediaFailed = true; setLoading(false); playing = false; stop(); updateTime(); revealControls();
      message('Видео не загрузилось. Попробуйте запустить ещё раз.');
    });
    mediaFailed = false; setLoading(true);
    video.src = project.video.src;
  }
  function playMedia() {
    if (!currentFilm() || !active || disposed) return;
    const video = media;
    if (video.ended || seconds >= duration()) { video.currentTime = 0; seconds = 0; }
    if (video.error) video.load();
    message(); mediaFailed = false; setLoading(video.readyState < 3, 'buffer'); playing = true; updateTime(); revealControls(); schedule();
    const promise = video.play();
    promise?.then(() => {
      if (disposed || media !== video || !active || document.hidden || view !== 'player') video.pause();
    }).catch(() => {
      if (disposed || media !== video) return;
      setLoading(false); playing = false; stop(); updateTime(); revealControls();
      message('Нажмите воспроизведение, чтобы запустить видео.');
    });
  }
  function seekTo(value) {
    seconds = Math.max(0, Math.min(duration(), Number(value) || 0));
    if (currentFilm()) {
      if (!media.error && !timeIsBuffered(seconds)) setLoading(true, 'seek');
      try { media.currentTime = seconds; } catch { /* Metadata may still be loading. */ }
    }
    draw(); updateTime(); revealControls();
  }
  function updateSound() {
    const silent = currentFilm() ? media.muted || media.volume === 0 : muted || volume === 0;
    const button = root.querySelector('[data-tv-action="mute"]');
    if (button && lastMutedState !== silent) {
      const label = silent ? 'Включить звук' : 'Выключить звук';
      button.setAttribute('aria-label', label); button.title = label;
      button.setAttribute('aria-pressed', String(silent));
      button.innerHTML = silent ? mutedIcon : soundIcon;
      lastMutedState = silent;
    }
    const range = root.querySelector('[data-tv-volume]');
    if (range && !volumeDrag?.dragging) range.value = String(Math.round((currentFilm() ? media.volume : volume) * 100));
    range?.setAttribute('aria-valuetext', `${Math.round((currentFilm() ? media.volume : volume) * 100)}%`);
  }
  function setVolume(value) {
    if (!currentFilm()) return;
    media.volume = Math.max(0, Math.min(1, Number(value) / 100 || 0));
    volume = media.volume;
    if (volume > 0) { lastAudibleVolume = volume; media.muted = false; }
    muted = media.muted;
    updateSound(); revealControls();
  }
  function toggleMute() {
    if (!currentFilm()) return;
    const silent = media.muted || media.volume === 0;
    media.muted = !silent;
    if (silent && media.volume === 0) media.volume = lastAudibleVolume || .8;
    muted = media.muted; volume = media.volume;
    updateSound(); revealControls();
  }
  function paintText(ctx, str, x, y, size = 32, { color = WHITE, family = 'Arial', weight = 400, italic = false } = {}) {
    ctx.fillStyle = color;
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${family}", sans-serif`;
    ctx.fillText(str, x, y);
  }
  function paintStroke(ctx, x1, y1, x2, y2, color = '#c6c6c6', width = 2) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  const type = (...args) => paintText(ctx, ...args);
  function art(project, t, drawingContext = ctx) {
    const ctx = drawingContext;
    const type = (...args) => paintText(ctx, ...args);
    const stroke = (...args) => paintStroke(ctx, ...args);
    if (project.id === 'education') {
      // A typographic composition opens into the structure of a page.
      const shift = reduced.matches ? 0 : Math.sin(t * .48) * 18;
      ctx.save();
      ctx.translate(552, 360); ctx.rotate(-.12 + Math.sin(t * .12) * .015);
      type('A', -222, 164, 530, { family: 'Georgia', color: '#e7e7e7' });
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(-250, -22 + shift, 450, 15);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const y = 164 + i * 162;
        stroke(95, y, 293 - i * 25, y, '#cacaca', 3);
        stroke(95, y + 22, 244 - i * 21, y + 22, '#424242', 2);
      }
    } else if (project.id === 'tracker') {
      const angle = t * .035;
      ctx.save(); ctx.translate(525, 333); ctx.rotate(angle);
      ctx.strokeStyle = '#242424'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 214, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2;
        const r = i % 4 === 0 ? 196 : 205;
        stroke(Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * 214, Math.sin(a) * 214, i % 4 === 0 ? '#a7a7a7' : '#474747', 2);
      }
      ctx.restore();
      type('24', 319, 425, 254, { weight: 600 });
      for (let i = 0; i < 18; i++) {
        const height = 13 + (1 + Math.sin(i * 1.31 + t * .45)) * 27;
        ctx.fillStyle = i === Math.floor(t * .8) % 18 ? WHITE : '#414141';
        ctx.fillRect(135 + i * 39, 592 - height, 19, height);
      }
    } else if (project.id === 'bolo') {
      ctx.save();
      ctx.translate(480, 350);
      const roll = reduced.matches ? .2 : t * .08;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2 + roll;
        ctx.save(); ctx.rotate(a);
        const light = 30 + (i % 4) * 13;
        ctx.strokeStyle = `rgb(${light},${light},${light})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 265, 48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      type('BOLO', 108, 422, 218, { family: 'Georgia', italic: true, color: '#f0f0f0' });
    } else {
      for (let j = 0; j < 16; j++) {
        ctx.beginPath();
        for (let x = 68; x <= 896; x += 4) {
          const edge = Math.sin((x - 68) / 828 * Math.PI);
          const wave = Math.sin(x * .009 - t * .7 + j * .22) * Math.sin(x * .003 + t * .12);
          const y = 260 + j * 12 + wave * edge * 109;
          if (x === 68) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = j % 4 === 0 ? '#dddddd' : '#575757';
        ctx.lineWidth = j % 4 === 0 ? 1.6 : .8; ctx.stroke();
      }
      type('ТИШЕ.', 110, 600, 87, { weight: 500 });
    }
  }
  function glass() {
    // Static fine grain remains inexpensive in the paused scene texture.
    if (crtEnabled) {
      ctx.save(); ctx.globalAlpha = .04; ctx.fillStyle = noisePattern;
      const grainTime = reduced.matches || document.body.classList.contains('motion-off') ? 0 : seconds;
      ctx.translate(Math.floor(grainTime * 11) % 96, Math.floor(grainTime * 7) % 96);
      ctx.fillRect(-96, -96, 1152, 912); ctx.restore();
      ctx.fillStyle = '#00000018';
      for (let y = 0; y < 720; y += 3) ctx.fillRect(0, y, 960, 1);
    }
    const vignette = ctx.createRadialGradient(480, 335, 130, 480, 350, 605);
    vignette.addColorStop(0, '#00000000'); vignette.addColorStop(.72, '#00000013'); vignette.addColorStop(1, '#000000bc');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, 960, 720);
    const reflection = ctx.createLinearGradient(0, 0, 0, 720);
    reflection.addColorStop(0, '#ffffff0c'); reflection.addColorStop(.18, '#ffffff00'); reflection.addColorStop(.86, '#ffffff00'); reflection.addColorStop(1, '#ffffff05');
    ctx.fillStyle = reflection; ctx.fillRect(0, 0, 960, 720);
  }
  function drawProgram(project, t, destination, width, height) {
    const ratio = aspectRatio(project), box = contain(ratio, width, height);
    destination.fillStyle = BLACK; destination.fillRect(0, 0, width, height);
    if (hasFilm(project)) {
      const video = currentFilm() && current.id === project.id && media.readyState >= 2 ? media : null;
      const image = video || posterImages.get(project.id);
      if (image && (video || image.complete && image.naturalWidth > 0)) {
        const intrinsicRatio = video ? video.videoWidth / video.videoHeight : image.naturalWidth / image.naturalHeight;
        const frame = contain(intrinsicRatio || ratio, width, height);
        destination.drawImage(image, frame.x, frame.y, frame.width, frame.height);
        return frame;
      }
      return box;
    }
    destination.save(); destination.beginPath(); destination.rect(box.x, box.y, box.width, box.height); destination.clip();
    destination.translate(box.x, box.y); destination.scale(box.width / 960, box.width / 960);
    // Widescreen studies are composed in their own 960×540 frame, not cropped out of 4:3.
    destination.translate(0, (960 / ratio - 720) / 2);
    art(project, t, destination); destination.restore();
    return box;
  }
  function drawPoster(project, t, destination, width, height) {
    const previewImage = previewImages.get(project.id);
    const image = previewImage?.complete && previewImage.naturalWidth > 0
      ? previewImage : posterImages.get(project.id);
    if (image?.complete && image.naturalWidth > 0) {
      const frame = contain(image.naturalWidth / image.naturalHeight, width, height);
      destination.fillStyle = BLACK; destination.fillRect(0, 0, width, height);
      destination.drawImage(image, frame.x, frame.y, frame.width, frame.height);
      return;
    }
    // Library covers are static: never substitute the currently playing film.
    if (hasFilm(project)) {
      destination.fillStyle = BLACK; destination.fillRect(0, 0, width, height);
      return;
    }
    drawProgram(project, t, destination, width, height);
  }
  function offsetFor(index) {
    const selected = programs.findIndex(project => project.id === preview.id);
    let offset = (index - selected + programs.length) % programs.length;
    if (offset > programs.length / 2) offset -= programs.length;
    return offset;
  }
  function drawShelf() {
    drawTVServiceLogo(ctx, 79, 71, 142);
    programs.map((project, index) => ({ project, offset: offsetFor(index) }))
      .sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset))
      .forEach(({ project, offset }) => {
        const distance = Math.abs(offset), width = distance === 0 ? 400 : distance === 1 ? 162 : 92;
        const height = distance === 0 ? 300 : distance === 1 ? 250 : 205;
        const x = 480 + offset * (distance === 1 ? 274 : 188), y = 340;
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha = distance === 0 ? 1 : distance === 1 ? .62 : .25;
        ctx.fillStyle = '#080808'; ctx.fillRect(-width / 2, -height / 2, width, height);
        const poster = posters.get(project.id), frame = contain(previewAspectRatio(project), width - 4, height - 4);
        ctx.drawImage(poster, -width / 2 + 2 + frame.x, -height / 2 + 2 + frame.y, frame.width, frame.height);
        ctx.strokeStyle = distance === 0 ? '#a1a1a1' : '#3b3b3b'; ctx.lineWidth = 1; ctx.strokeRect(-width / 2, -height / 2, width, height);
        if (distance === 0) {
          ctx.fillStyle = '#040404c9'; ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-7, -13); ctx.lineTo(-7, 13); ctx.lineTo(15, 0); ctx.closePath(); ctx.fillStyle = WHITE; ctx.fill();
        }
        ctx.restore();
      });
    ctx.save(); ctx.textAlign = 'center'; type(preview.title, 480, 566, 31); ctx.restore();
  }
  function draw() {
    if (!ctx || disposed) return;
    // The browser displays the native film on phones. Avoid decoding and
    // painting every video frame a second time into an invisible CRT texture.
    if (mobilePresentation && view === 'player' && currentFilm()) return;
    ctx.fillStyle = BLACK; ctx.fillRect(0, 0, 960, 720);
    ctx.save();
    const t = reduced.matches || document.body.classList.contains('motion-off') ? 0 : seconds;
    if (view === 'player' && current) {
      const box = drawProgram(current, t, ctx, 960, 720);
      canvas.dataset.mediaAspect = String(currentFilm() && media.videoWidth ? media.videoWidth / media.videoHeight : aspectRatio(current));
      canvas.dataset.contentRect = `${box.x},${box.y},${box.width},${box.height}`;
    } else if (!active) drawShelf();
    ctx.restore(); glass(); onFrame();
  }
  function updateTime() {
    const range = root.querySelector('[data-tv-seek]');
    if (range && Number(range.max) !== duration()) range.max = String(duration());
    if (range && !seeking) range.value = String(seconds);
    const label = `${clock(seconds)} / ${clock(duration())}`;
    if (label !== lastTimeLabel) {
      const element = root.querySelector('[data-tv-time]'); if (element) element.textContent = label;
      lastTimeLabel = label;
    }
    const toggle = root.querySelector('[data-tv-action="toggle"]');
    if (toggle && lastPlayingState !== playing) {
      toggle.setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
      toggle.innerHTML = playing ? pauseIcon : playIcon;
      lastPlayingState = playing;
    }
    const played = root.querySelector('[data-tv-played]');
    if (played) played.style.width = `${Math.max(0, Math.min(100, seconds / duration() * 100))}%`;
    root.querySelector('.tv-system')?.classList.toggle('is-playing', playing);
    updateSound();
  }
  function frame(now) {
    raf = 0;
    if (!active || !playing || document.hidden || disposed || view !== 'player') return;
    if (now - last < 1000 / 24) { raf = requestAnimationFrame(frame); return; }
    if (currentFilm()) seconds = Number.isFinite(media.currentTime) ? media.currentTime : 0;
    else if (last) seconds = Math.min(DURATION, seconds + Math.min((now - last) / 1000, .12));
    last = now; draw(); updateTime();
    if (!currentFilm() && seconds >= DURATION) { playing = false; updateTime(); return; }
    raf = requestAnimationFrame(frame);
  }
  function schedule() {
    if (active && playing && view === 'player' && !raf && !document.hidden && !disposed) {
      last = 0; raf = requestAnimationFrame(frame);
    }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; last = 0; }
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14" fill="none" stroke="currentColor" stroke-width="4"/></svg>';
  const previousIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const nextIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const restartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a8 8 0 1 1-1 7M5 3v6h6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const soundIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const mutedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  function syncNoise() {
    root.querySelector('.tv-system')?.classList.toggle('is-tv-active', active && !document.hidden);
  }
  function updateSelection({ focus = false } = {}) {
    const cards = root.querySelectorAll('[data-tv-card]');
    cards.forEach((card, index) => {
      const offset = offsetFor(index), distance = Math.abs(offset), selected = distance === 0;
      card.style.setProperty('--flow-x', `${offset * 73}%`);
      card.style.setProperty('--flow-turn', `${selected ? 0 : Math.sign(offset) * -61}deg`);
      card.style.setProperty('--flow-z', `${selected ? 26 : -distance * 30}px`);
      card.style.setProperty('--flow-scale', String(selected ? 1 : distance === 1 ? .92 : .78));
      card.style.setProperty('--flow-opacity', String(selected ? 1 : distance === 1 ? .64 : .24));
      card.style.zIndex = String(10 - distance);
      card.classList.toggle('is-current', selected);
      card.setAttribute('aria-pressed', String(selected));
      card.setAttribute('aria-label', `${selected ? 'Смотреть' : 'Выбрать'} ${programs[index].title}`);
      card.tabIndex = selected ? 0 : -1;
    });
    const title = root.querySelector('[data-tv-title]'); if (title) title.textContent = preview.title;
    if (focus) root.querySelector(`[data-tv-card="${preview.id}"]`)?.focus({ preventScroll: true });
    draw();
  }
  function selectProject(id, options) {
    if (view !== 'library' || preview.id === id) return;
    preview = getProgram(id) || preview;
    clearTimeout(hoverTimer); hoverTimer = 0;
    hoverGuardUntil = performance.now() + 420;
    updateSelection(options);
  }
  function selectRelative(direction, options) {
    const index = programs.findIndex(project => project.id === preview.id);
    selectProject(programs[(index + direction + programs.length) % programs.length].id, options);
  }
  function render() {
    if (disposed) return;
    seekDrag?.dispose(); seekDrag = null;
    volumeDrag?.dispose(); volumeDrag = null;
    lastTimeLabel = ''; lastPlayingState = null; lastMutedState = null; lastBufferKey = '';
    if (view === 'library') {
      root.innerHTML = `<section class="tv-system tv-library-screen" aria-label="Видеотека"><div class="tv-picture tv-library-picture" data-tv-picture></div><h1 class="tv-library-heading">${tvServiceLogo()}</h1><div class="tv-carousel" role="group" aria-roledescription="карусель" aria-label="Видеотека">${programs.map(p => `<button class="tv-flow-card" data-tv-card="${p.id}" data-tv-aspect="${previewAspectRatio(p)}" type="button"><span class="tv-flow-media" data-tv-poster="${p.id}"></span><span class="tv-flow-play" aria-hidden="true">${playIcon}</span></button>`).join('')}</div><div class="tv-flow-caption"><button data-tv-action="previous" class="tv-icon-button" aria-label="Предыдущее видео">${previousIcon}</button><p data-tv-title aria-live="polite">${esc(preview.title)}</p><button data-tv-action="next" class="tv-icon-button" aria-label="Следующее видео">${nextIcon}</button></div><footer class="tv-bottom"><button data-tv-action="back" class="tv-back">← К компьютеру</button></footer></section>`;
      for (const project of programs) root.querySelector(`[data-tv-poster="${project.id}"]`)?.append(posters.get(project.id));
      updateSelection();
    } else {
      const film = hasFilm(current);
      root.innerHTML = `<section class="tv-system tv-player-screen is-controls-visible${playing ? ' is-playing' : ''}${film ? ' tv-film-screen' : ''}" aria-label="${esc(current.title)} — ${film ? 'видео' : 'экранный этюд'}" tabindex="-1"><div class="tv-picture" data-tv-picture><div class="tv-video-loading" data-tv-loading role="status" aria-live="polite" hidden><span class="tv-loading-ring" aria-hidden="true"></span><span data-tv-loading-text>Загрузка видео…</span></div></div><div class="tv-player-shade" aria-hidden="true"></div><header class="tv-player-heading"><button data-tv-action="library" class="tv-back">← Видеотека</button><span>${esc(current.title)}</span></header><p class="tv-player-message" data-tv-message role="status"></p><div class="tv-player-controls"><div class="tv-player-timeline"><div class="tv-seek-shell"><div class="tv-seek-track" aria-hidden="true"><span class="tv-buffered" data-tv-buffered data-ranges="[]"></span><span class="tv-played" data-tv-played></span></div><input data-tv-seek type="range" min="0" max="${duration()}" step=".1" value="${seconds}" aria-label="${film ? 'Позиция видео' : 'Позиция заставки'}" aria-describedby="tv-buffer-summary"></div><span id="tv-buffer-summary" class="tv-buffer-summary" data-tv-buffer-summary>Загружено 0% видео</span><span data-tv-time>${clock(seconds)} / ${clock(duration())}</span></div><div class="tv-player-actions"><button data-tv-action="toggle" class="tv-icon-button tv-toggle" aria-label="${playing ? 'Пауза' : 'Воспроизвести'}" title="Воспроизведение / пауза">${playing ? pauseIcon : playIcon}</button>${film ? `<button data-tv-action="restart" class="tv-icon-button tv-restart" aria-label="Сначала" title="Сначала">${restartIcon}</button><div class="tv-player-audio"><button data-tv-action="mute" class="tv-icon-button tv-mute" aria-label="${muted ? 'Включить звук' : 'Выключить звук'}" aria-pressed="${muted}">${muted ? mutedIcon : soundIcon}</button><input class="tv-volume-range" data-tv-volume type="range" min="0" max="100" step="1" value="${Math.round(volume * 100)}" aria-label="Громкость видео"></div>` : ''}</div></div></section>`;
    }
    const picture = root.querySelector('[data-tv-picture]');
    picture.append(canvas);
    // The actual video can fill a phone's portrait viewport without stretching
    // the 4:3 canvas used by the physical television's texture.
    if (currentFilm()) picture.append(media);
    const range = root.querySelector('[data-tv-seek]');
    if (range) seekDrag = bindRangeDrag(range, {
      thumbSize: 8,
      onStart: () => { seeking = true; revealControls(); },
      onInput: seekTo,
      onEnd: () => { seeking = false; updateTime(); }
    });
    const volumeRange = root.querySelector('[data-tv-volume]');
    if (volumeRange) volumeDrag = bindRangeDrag(volumeRange, {
      thumbSize: 12, onInput: setVolume, onEnd: updateSound
    });
    draw();
    canvas.setAttribute('aria-label', view === 'player' && hasFilm(current) ? `Видео ${current.title}` : 'Экранный этюд выбранного проекта');
    syncNoise(); updateTime(); updateBuffered(); updateLoading(); revealControls();
  }
  function open(id) {
    requestPosters();
    stop(); clearTimeout(pointerTimer); clearTimeout(hoverTimer); swipe = null; pointerIntent = null; seeking = false;
    current = id ? getProgram(id) : null;
    if (current) preview = current;
    prepareMedia(current);
    seconds = 0; playing = Boolean(current) && !hasFilm(current); view = current ? 'player' : 'library';
    render(); schedule();
  }
  function library() {
    playing = false; stop(); releaseMedia(); view = 'library'; render();
    root.querySelector(`[data-tv-card="${preview.id}"]`)?.focus({ preventScroll: true });
  }
  function togglePlaying() {
    if (currentFilm()) {
      if (playing) { media.pause(); playing = false; stop(); updateTime(); revealControls(); }
      else playMedia();
      return;
    }
    if (seconds >= DURATION) seconds = 0;
    playing = !playing; updateTime(); revealControls();
    if (playing) schedule(); else stop();
  }
  function click(event) {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    const project = event.target.closest('[data-tv-card]');
    if (project) {
      const firstPointerSelection = pointerIntent?.id === project.dataset.tvCard && !pointerIntent.selected && performance.now() - pointerIntent.time < 1800;
      pointerIntent = null;
      if (firstPointerSelection || project.dataset.tvCard !== preview.id) selectProject(project.dataset.tvCard, { focus: true });
      else { open(preview.id); root.querySelector('.tv-player-screen')?.focus({ preventScroll: true }); }
      return;
    }
    const action = event.target.closest('[data-tv-action]')?.dataset.tvAction;
    if (action === 'back') onBack?.();
    if (action === 'library') library();
    if (action === 'toggle') togglePlaying();
    if (action === 'restart' && currentFilm()) { seekTo(0); playMedia(); }
    if (action === 'mute') toggleMute();
    if (action === 'previous') selectRelative(-1);
    if (action === 'next') selectRelative(1);
  }
  function input(event) {
    if (event.target.matches('[data-tv-seek]')) seekTo(event.target.value);
    if (event.target.matches('[data-tv-volume]')) setVolume(event.target.value);
  }
  function previewProgram(event) {
    const button = event.target.closest('[data-tv-card]');
    if (!button || button.dataset.tvCard === preview.id || view !== 'library') return;
    if (event.type === 'focusin') {
      // A pointer gives a button focus before its click. Keep that first tap a selection.
      if (pointerIntent?.id === button.dataset.tvCard && performance.now() - pointerIntent.time < 1800) return;
      selectProject(button.dataset.tvCard); return;
    }
    if (event.pointerType !== 'mouse' || performance.now() < hoverGuardUntil) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => selectProject(button.dataset.tvCard), 130);
  }
  function cancelHover(event) {
    if (event.target.closest('[data-tv-card]')) { clearTimeout(hoverTimer); hoverTimer = 0; }
  }
  function pointerDown(event) {
    const card = view === 'library' ? event.target.closest('[data-tv-card]') : null;
    pointerIntent = card ? { id: card.dataset.tvCard, selected: card.dataset.tvCard === preview.id, time: performance.now() } : null;
    if (card) { clearTimeout(hoverTimer); hoverTimer = 0; }
    if (view !== 'library' || event.pointerType === 'mouse' || !event.target.closest('.tv-carousel')) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function pointerUp(event) {
    if (!swipe || event.pointerId !== swipe.id) return;
    const x = event.clientX - swipe.x, y = event.clientY - swipe.y; swipe = null;
    if (Math.abs(x) > 28 && Math.abs(x) > Math.abs(y) * 1.2) {
      pointerIntent = null;
      suppressClickUntil = performance.now() + 450;
      selectRelative(x < 0 ? 1 : -1);
    }
  }
  function pointerCancel() { swipe = null; pointerIntent = null; seekDrag?.cancel(); volumeDrag?.cancel(); }
  function keyboard(event) {
    pointerIntent = null;
    if (event.key === 'Escape') {
      event.preventDefault(); if (view === 'player') library(); else onBack?.(); return;
    }
    if (view === 'library' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault(); selectRelative(event.key === 'ArrowRight' ? 1 : -1, { focus: true });
    }
    if (event.key === ' ' && view === 'player' && !event.target.matches('button,input')) {
      event.preventDefault(); togglePlaying();
    }
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && view === 'player' && !event.target.matches('input')) {
      event.preventDefault(); seekTo(seconds + (event.key === 'ArrowRight' ? 3 : -3));
    }
  }
  function revealControls() {
    clearTimeout(pointerTimer);
    const system = root.querySelector('.tv-system');
    system?.classList.add('is-controls-visible');
    if (playing && active && !reduced.matches && matchMedia('(hover: hover)').matches) {
      pointerTimer = setTimeout(() => {
        if (!root.contains(document.activeElement)) system?.classList.remove('is-controls-visible');
      }, 2200);
    }
  }
  function visibility() { syncNoise(); if (document.hidden) { seekDrag?.cancel(); volumeDrag?.cancel(); media?.pause(); stop(); clearTimeout(hoverTimer); swipe = null; pointerIntent = null; seeking = false; } else schedule(); }
  const appearance = new MutationObserver(() => {
    const enabled = !document.body.classList.contains('crt-off');
    const nextMobile = document.body.classList.contains('mobile-mode');
    if ((enabled !== crtEnabled || nextMobile !== mobilePresentation) && !disposed) {
      const enteringDesktop = mobilePresentation && !nextMobile;
      crtEnabled = enabled; mobilePresentation = nextMobile;
      if (!mobilePresentation) requestPosters({ retry: enteringDesktop });
      draw();
    }
  });
  appearance.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  root.addEventListener('click', click); root.addEventListener('input', input); root.addEventListener('keydown', keyboard);
  root.addEventListener('pointerover', previewProgram); root.addEventListener('focusin', previewProgram);
  root.addEventListener('pointerout', cancelHover); root.addEventListener('pointerdown', pointerDown);
  root.addEventListener('pointerup', pointerUp); root.addEventListener('pointercancel', pointerCancel);
  root.addEventListener('pointermove', revealControls); root.addEventListener('focusin', revealControls);
  document.addEventListener('visibilitychange', visibility);
  for (const project of programs) {
    const previewPoster = TV_PROGRAMS.find(program => program.projectId === project.id)?.previewPoster;
    const poster = document.createElement('canvas'), ratio = previewAspectRatio(project);
    poster.width = previewPoster ? 960 : 480; poster.height = Math.round(poster.width / ratio);
    poster.setAttribute('aria-hidden', 'true');
    drawPoster(project, 3, poster.getContext('2d', { alpha: false }), poster.width, poster.height);
    posters.set(project.id, poster);
  }
  function requestPosters({ retry = true } = {}) {
    if (disposed) return;
    if (postersRequested) { if (retry) posterRequests.retryFailed(); return; }
    postersRequested = true;
    for (const project of programs) {
      const poster = posters.get(project.id);
      const previewPoster = TV_PROGRAMS.find(program => program.projectId === project.id)?.previewPoster;
      const redrawPoster = () => {
        if (disposed) return;
        drawPoster(project, 0, poster.getContext('2d', { alpha: false }), poster.width, poster.height);
        draw();
      };
      if (hasFilm(project) && project.video.poster) {
        posterRequests.add(`poster:${project.id}`, project.video.poster, image => posterImages.set(project.id, image), redrawPoster);
      }
      if (previewPoster) {
        posterRequests.add(`preview:${project.id}`, previewPoster, image => previewImages.set(project.id, image), redrawPoster);
      }
    }
  }
  // The physical desktop television uses its covers before the panel opens.
  // Phones start without a 3D scene, so covers wait for the first TV visit.
  if (!mobilePresentation) requestPosters();
  render();
  return {
    canvas, open,
    setActive(value) {
      const changed = active !== value; active = value;
      if (!active) { seekDrag?.cancel(); volumeDrag?.cancel(); playing = false; media?.pause(); stop(); clearTimeout(pointerTimer); clearTimeout(hoverTimer); swipe = null; pointerIntent = null; seeking = false; updateTime(); }
      else { requestPosters({ retry: changed }); schedule(); }
      syncNoise(); updateLoading(); if (changed) draw();
    },
    focus() {
      if (view === 'library') root.querySelector(`[data-tv-card="${preview.id}"]`)?.focus({ preventScroll: true });
      else root.querySelector('.tv-player-screen')?.focus({ preventScroll: true });
    },
    dispose() {
      seekDrag?.dispose(); seekDrag = null;
      volumeDrag?.dispose(); volumeDrag = null;
      disposed = true; stop(); releaseMedia(); clearTimeout(pointerTimer); clearTimeout(hoverTimer); appearance.disconnect();
      posterRequests.dispose();
      posterImages.clear();
      previewImages.clear();
      document.removeEventListener('visibilitychange', visibility);
      root.removeEventListener('click', click); root.removeEventListener('input', input); root.removeEventListener('keydown', keyboard);
      root.removeEventListener('pointerover', previewProgram); root.removeEventListener('focusin', previewProgram);
      root.removeEventListener('pointerout', cancelHover); root.removeEventListener('pointerdown', pointerDown);
      root.removeEventListener('pointerup', pointerUp); root.removeEventListener('pointercancel', pointerCancel);
      root.removeEventListener('pointermove', revealControls); root.removeEventListener('focusin', revealControls);
      root.replaceChildren();
    }
  };
}
