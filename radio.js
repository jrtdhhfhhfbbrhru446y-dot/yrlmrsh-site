import { bindRangeDrag } from './range-drag.js?v=studio-59-final';

const STATIONS = [
  { id: 'rain', title: 'Дождь', frequency: '88.4', position: '17%' },
  { id: 'noise', title: 'Белый шум', frequency: '96.2', position: '50%' },
  { id: 'wind', title: 'Ветер', frequency: '104.8', position: '83%' }
];
const STORAGE_KEY = 'archive26-radio';
const clamp = value => Math.max(0, Math.min(1, value));
const formatTime = seconds => Number.isFinite(seconds) && seconds >= 0
  ? `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` : '--:--';

function preferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      station: STATIONS.some(item => item.id === saved.station) ? saved.station : 'rain',
      volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? clamp(saved.volume) : .25,
      noiseVolume: typeof saved.noiseVolume === 'number' && Number.isFinite(saved.noiseVolume) ? clamp(saved.noiseVolume) : typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? clamp(saved.volume) : .25
    };
  } catch { return { station: 'rain', volume: .25, noiseVolume: .25 }; }
}

// A local recording and synthesized ambience have independent volume controls.
// Recording and one selected ambience are independent; reloading never starts playback.
export function createRadio(root, { onBack = () => {}, onStateChange = () => {} } = {}) {
  let state = { noiseEnabled: false, recording: false, ...preferences() };
  let context = null, master = null, noise = null, voice = null;
  let disposed = false, active = false, noiseEpoch = 0, recordingEpoch = 0;
  let noiseStatus = 'off', recordingStatus = 'off', noiseError = '', recordingError = '';
  let seeking = false;
  const timers = new Set(), voices = new Set();
  const source = () => state.noiseEnabled ? (state.recording ? 'mixed' : 'noise') : state.recording ? 'recording' : null;
  function overallStatus() {
    const statuses = [state.noiseEnabled && noiseStatus, state.recording && recordingStatus].filter(Boolean);
    return ['playing', 'starting', 'error', 'paused'].find(value => statuses.includes(value)) || 'off';
  }
  const snapshot = () => ({ ...state, source: source(), powered: state.noiseEnabled || state.recording, status: overallStatus(), noiseStatus, recordingStatus });

  root.innerHTML = `<section class="radio-system" aria-label="Радио — звуки и аудиозапись">
    <header class="radio-heading"><h1>Радио</h1><span class="radio-signal"><i data-radio-light aria-hidden="true"></i><span data-radio-power-label>OFF</span></span></header>
    <div class="radio-body">
      <div class="radio-dial" aria-hidden="true">
        <div class="radio-dial-top"><span data-radio-band>FM</span><span data-radio-frequency>88.4</span><span data-radio-format>MHz</span></div>
        <div class="radio-scale"><div class="radio-ticks"></div><i class="radio-needle" data-radio-needle></i><div class="radio-frequencies"><span>88</span><span>92</span><span>96</span><span>100</span><span>108</span></div></div>
      </div>
      <nav class="radio-stations" aria-label="Фоновый звук">${STATIONS.map(station => `<button type="button" data-radio-station="${station.id}" aria-pressed="false"><span>${station.title}</span></button>`).join('')}</nav>
      <div class="radio-player" aria-label="Аудиозапись">
        <div class="radio-player-heading"><span class="radio-player-title">Запись</span><span class="radio-time"><output data-radio-elapsed>00:00</output><span aria-hidden="true">/</span><output data-radio-duration>--:--</output></span></div>
        <div class="radio-controls"><button type="button" class="radio-power" data-radio-action="power" aria-label="Воспроизвести запись" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v9m-5.3-6.1a8 8 0 1 0 10.6 0"/></svg><span data-radio-power-text>Слушать</span></button><div class="radio-seek"><label class="radio-visually-hidden" for="archive-radio-seek">Перемотка записи</label><span class="radio-seek-track" aria-hidden="true"><span class="radio-buffered" data-radio-buffered></span><span class="radio-played"></span></span><span id="archive-radio-buffer-status" class="radio-visually-hidden" data-radio-buffer-status></span><input id="archive-radio-seek" data-radio-seek type="range" min="0" max="0" step="1" value="0" aria-describedby="archive-radio-buffer-status" disabled></div></div>
      </div>
      <div class="radio-levels">
        <div class="radio-volume radio-noise-volume"><label for="archive-radio-noise-volume">Громкость шумов <output data-radio-noise-volume-label for="archive-radio-noise-volume">25</output></label><input id="archive-radio-noise-volume" data-radio-noise-volume type="range" min="0" max="100" step="1" value="25" aria-valuetext="25 процентов"></div>
        <div class="radio-volume radio-recording-volume"><label for="archive-radio-volume">Громкость записи <output data-radio-volume-label for="archive-radio-volume">25</output></label><input id="archive-radio-volume" data-radio-volume type="range" min="0" max="100" step="1" value="25" aria-valuetext="25 процентов"></div>
      </div>
      <div class="radio-reception"><p data-radio-status role="status" aria-live="polite">Радио выключено</p><button type="button" class="radio-resume" data-radio-action="resume" hidden>Продолжить →</button></div>
      <a class="radio-library" href="https://yrlmrshaudio.pages.dev/" target="_blank" rel="noopener noreferrer"><span>Полная библиотека шумов</span><span aria-hidden="true">↗</span></a>
    </div>
    <footer class="radio-footer"><button type="button" data-radio-action="back">← К компьютеру</button><span class="radio-footer-grille" aria-hidden="true"></span></footer>
    <audio class="radio-recording" data-radio-recording preload="none" hidden></audio>
  </section>`;

  const recording = root.querySelector('[data-radio-recording]');
  const ui = {
    panel: root.querySelector('.radio-system'),
    light: root.querySelector('[data-radio-light]'),
    powerLabel: root.querySelector('[data-radio-power-label]'),
    power: root.querySelector('[data-radio-action="power"]'),
    powerText: root.querySelector('[data-radio-power-text]'),
    needle: root.querySelector('[data-radio-needle]'),
    frequency: root.querySelector('[data-radio-frequency]'),
    band: root.querySelector('[data-radio-band]'),
    format: root.querySelector('[data-radio-format]'),
    player: root.querySelector('.radio-player'),
    seekArea: root.querySelector('.radio-seek'),
    buffered: root.querySelector('[data-radio-buffered]'),
    bufferStatus: root.querySelector('[data-radio-buffer-status]'),
    seek: root.querySelector('[data-radio-seek]'),
    elapsed: root.querySelector('[data-radio-elapsed]'),
    duration: root.querySelector('[data-radio-duration]'),
    volume: root.querySelector('[data-radio-volume]'),
    volumeLabel: root.querySelector('[data-radio-volume-label]'),
    noiseVolume: root.querySelector('[data-radio-noise-volume]'),
    noiseVolumeLabel: root.querySelector('[data-radio-noise-volume-label]'),
    status: root.querySelector('[data-radio-status]'),
    resume: root.querySelector('[data-radio-action="resume"]'),
    stations: [...root.querySelectorAll('[data-radio-station]')]
  };

  function updateProgress() {
    if (disposed) return;
    const duration = Number.isFinite(recording.duration) && recording.duration > 0 ? recording.duration : 0;
    const current = seeking ? Number(ui.seek.value) : Number.isFinite(recording.currentTime) ? recording.currentTime : 0;
    ui.elapsed.textContent = formatTime(current);
    ui.duration.textContent = duration ? formatTime(duration) : '--:--';
    ui.seek.disabled = !duration || Boolean(recording.error);
    if (Number(ui.seek.max) !== duration) ui.seek.max = String(duration);
    if (!seeking) ui.seek.value = String(Math.min(current, duration));
    ui.seekArea.style.setProperty('--radio-progress', `${duration ? Math.max(0, Math.min(100, current / duration * 100)) : 0}%`);
    ui.seekArea.classList.toggle('is-unavailable', ui.seek.disabled);
    ui.seek.setAttribute('aria-valuetext', `${formatTime(current)} из ${duration ? formatTime(duration) : '--:--'}`);
  }

  let lastBufferedKey = '';
  function updateBuffered() {
    if (disposed) return;
    const duration = Number.isFinite(recording.duration) && recording.duration > 0 ? recording.duration : 0;
    const intervals = [];
    if (duration && recording.buffered) {
      try {
        const buffered = recording.buffered;
        for (let index = 0; index < buffered.length; index++) {
          const suppliedStart = buffered.start(index), suppliedEnd = buffered.end(index);
          if (!Number.isFinite(suppliedStart) || !Number.isFinite(suppliedEnd)) continue;
          const start = Math.max(0, suppliedStart), end = Math.min(duration, suppliedEnd);
          if (end > start) intervals.push([start, end]);
        }
      } catch { intervals.length = 0; /* A changing TimeRanges snapshot is retried on the next media event. */ }
    }
    intervals.sort((a, b) => a[0] - b[0]);
    const ranges = [];
    for (const interval of intervals) {
      const previous = ranges[ranges.length - 1];
      if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
      else ranges.push([...interval]);
    }
    const key = JSON.stringify([duration, ranges]);
    if (key !== lastBufferedKey) {
      lastBufferedKey = key;
      const fragments = ranges.map(([start, end]) => {
        const fragment = document.createElement('span');
        fragment.style.setProperty('left', `${start / duration * 100}%`);
        fragment.style.setProperty('width', `${(end - start) / duration * 100}%`);
        return fragment;
      });
      ui.buffered.replaceChildren(...fragments);
      const loaded = ranges.reduce((total, [start, end]) => total + end - start, 0);
      const percent = duration ? Math.floor(Math.min(1, loaded / duration) * 100) : null;
      ui.buffered.dataset.ranges = JSON.stringify(ranges);
      ui.buffered.dataset.percent = percent === null ? '' : String(percent);
      ui.bufferStatus.textContent = percent === null
        ? 'Загруженные участки появятся после получения сведений о записи.'
        : `Загружено ${percent}% записи. Светлые участки шкалы показывают готовые фрагменты.`;
    }
  }
  function updateTimeline() { updateProgress(); updateBuffered(); }

  function render() {
    if (disposed) return;
    const station = STATIONS.find(item => item.id === state.station);
    const volume = Math.round(state.volume * 100);
    const noiseVolume = Math.round(state.noiseVolume * 100);
    const silent = (state.recording || state.noiseEnabled) && (!state.recording || state.volume === 0) && (!state.noiseEnabled || state.noiseVolume === 0);
    const powered = state.noiseEnabled || state.recording;
    const playingRecording = state.recording && ['playing', 'starting'].includes(recordingStatus);
    const status = overallStatus();
    const statuses = [state.noiseEnabled && noiseStatus, state.recording && recordingStatus];
    ui.panel.dataset.state = status;
    ui.panel.dataset.source = source() || 'off';
    ui.panel.dataset.noiseState = noiseStatus;
    ui.panel.dataset.recordingState = recordingStatus;
    ui.panel.classList.toggle('has-notice', statuses.some(value => ['starting', 'paused', 'error'].includes(value)) || silent);
    ui.panel.classList.toggle('is-powered', powered);
    ui.panel.classList.toggle('is-active', active);
    ui.player.classList.toggle('is-playing', state.recording && recordingStatus === 'playing');
    ui.player.setAttribute('aria-busy', String(state.recording && recordingStatus === 'starting'));
    ui.powerLabel.textContent = status === 'playing' ? 'ON AIR' : powered ? 'PAUSE' : 'OFF';
    ui.power.setAttribute('aria-pressed', String(playingRecording));
    ui.power.setAttribute('aria-label', playingRecording ? 'Приостановить запись' : 'Воспроизвести запись');
    ui.powerText.textContent = playingRecording ? 'Пауза' : 'Слушать';
    ui.needle.style.left = station.position;
    const recordingOnly = state.recording && !state.noiseEnabled;
    ui.frequency.textContent = recordingOnly ? 'ЗАПИСЬ' : station.frequency;
    ui.band.textContent = recordingOnly ? 'REC' : state.recording ? 'FM + REC' : 'FM';
    ui.format.textContent = recordingOnly ? 'MP3' : 'MHz';
    ui.volume.value = String(volume);
    ui.volume.setAttribute('aria-valuetext', `${volume} процентов`);
    ui.volumeLabel.textContent = String(volume).padStart(2, '0');
    ui.noiseVolume.value = String(noiseVolume);
    ui.noiseVolume.setAttribute('aria-valuetext', `${noiseVolume} процентов`);
    ui.noiseVolumeLabel.textContent = String(noiseVolume).padStart(2, '0');
    ui.stations.forEach(button => button.setAttribute('aria-pressed', String(state.noiseEnabled && button.dataset.radioStation === state.station)));
    const issues = [state.noiseEnabled && noiseError, state.recording && recordingError].filter(Boolean);
    let message = 'Радио выключено';
    if (issues.length) message = issues.join(' ');
    else if (statuses.includes('paused')) message = 'Воспроизведение приостановлено браузером';
    else if (statuses.includes('starting')) message = recordingStatus === 'starting' ? 'Загрузка записи…' : 'Включение…';
    else if (silent) message = 'Громкость на нуле';
    else if (status === 'playing') message = state.noiseEnabled && state.recording ? `Играет: ${station.title} + запись` : state.recording ? 'Играет запись' : `Играет: ${station.title}`;
    ui.status.textContent = message;
    ui.resume.hidden = !statuses.some(value => ['paused', 'error'].includes(value));
    updateProgress();
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ station: state.station, volume: state.volume, noiseVolume: state.noiseVolume })); } catch {}
  }
  function later(callback, milliseconds) {
    const id = setTimeout(() => { timers.delete(id); callback(); }, milliseconds);
    timers.add(id); return id;
  }
  function notify() { render(); onStateChange(snapshot()); }

  function setGain(parameter, value, seconds = .055) {
    if (!context) return;
    const now = context.currentTime;
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
    parameter.setTargetAtTime(value, now, seconds);
  }

  function ensureContext() {
    if (context) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Этот браузер не поддерживает звук радио.');
    context = new Audio();
    context.addEventListener('statechange', audioStateChanged);
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    noise = context.createBuffer(2, Math.round(context.sampleRate * 6), context.sampleRate);
    let seed = 0x26a1b4;
    for (let channel = 0; channel < 2; channel++) {
      const data = noise.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        data[i] = ((seed >>> 0) / 2147483648 - 1) * .85;
      }
      // Join the loop without a discontinuity at its boundary.
      const edge = Math.min(256, Math.floor(data.length / 8));
      const end = data[data.length - 1];
      for (let i = 0; i < edge; i++) {
        const blend = i / edge;
        data[i] = end * (1 - blend) + data[i] * blend;
      }
    }
  }

  function destroyVoice(item) {
    if (!item || item.dead) return;
    item.dead = true;
    for (const source of item.sources) { try { source.stop(); } catch {} }
    for (const node of item.nodes) { try { node.disconnect(); } catch {} }
    voices.delete(item);
    if (voice === item) voice = null;
  }

  function retire(item, immediately = false) {
    if (!item || item.retiring || item.dead) return;
    item.retiring = true;
    if (immediately || context?.state !== 'running') { destroyVoice(item); return; }
    setGain(item.envelope.gain, 0, .025);
    later(() => destroyVoice(item), 170);
  }

  function makeVoice(station) {
    const nodes = [], sources = [];
    const own = node => { nodes.push(node); return node; };
    const envelope = own(context.createGain());
    envelope.gain.value = 0;
    envelope.connect(master);
    const source = own(context.createBufferSource());
    source.buffer = noise; source.loop = true; sources.push(source);
    const high = own(context.createBiquadFilter());
    high.type = 'highpass'; high.Q.value = .45;
    const low = own(context.createBiquadFilter());
    low.type = 'lowpass'; low.Q.value = .5;
    const level = own(context.createGain());
    source.connect(high); high.connect(low); low.connect(level); level.connect(envelope);
    if (station === 'rain') {
      high.frequency.value = 430; low.frequency.value = 6400; level.gain.value = .9;
      const swell = own(context.createOscillator()), depth = own(context.createGain());
      swell.frequency.value = .17; depth.gain.value = .08;
      swell.connect(depth); depth.connect(level.gain); sources.push(swell);
    } else if (station === 'wind') {
      high.frequency.value = 45; low.frequency.value = 580; level.gain.value = 2.7;
      const gust = own(context.createOscillator()), depth = own(context.createGain());
      gust.frequency.value = .095; depth.gain.value = 270;
      gust.connect(depth); depth.connect(low.frequency); sources.push(gust);
      const swell = own(context.createOscillator()), swellDepth = own(context.createGain());
      swell.frequency.value = .067; swellDepth.gain.value = .5;
      swell.connect(swellDepth); swellDepth.connect(level.gain); sources.push(swell);
    } else {
      high.frequency.value = 28; low.frequency.value = Math.min(12000, context.sampleRate * .42); level.gain.value = .72;
    }
    const item = { station, nodes, sources, envelope, retiring: false, dead: false };
    voices.add(item);
    sources.forEach(node => node.start());
    setGain(envelope.gain, 1, .055);
    const old = voice;
    voice = item;
    retire(old);
    return item;
  }

  function volumeGain() { return .46 * Math.pow(state.noiseVolume, 1.65); }

  function silenceNoise(immediately = false) {
    for (const item of [...voices]) {
      if (immediately) destroyVoice(item);
      else retire(item);
    }
    voice = null;
    if (immediately && master && context) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
    }
    const stoppedAt = noiseEpoch;
    later(() => {
      if (!disposed && noiseEpoch === stoppedAt && !state.noiseEnabled && context?.state === 'running') {
        try { context.suspend()?.catch(() => {}); } catch {}
      }
    }, 190);
  }

  function stopRecording() {
    ++recordingEpoch; state.recording = false; recordingStatus = 'off'; recordingError = '';
    recording.pause(); notify();
  }
  function stopNoise() {
    ++noiseEpoch; state.noiseEnabled = false; noiseStatus = 'off'; noiseError = '';
    silenceNoise(); notify();
  }
  function stop() {
    if (disposed) return;
    ++noiseEpoch; ++recordingEpoch;
    state.noiseEnabled = false; state.recording = false;
    noiseStatus = recordingStatus = 'off'; noiseError = recordingError = '';
    recording.pause(); silenceNoise(); notify();
  }

  async function startNoise() {
    const startedAt = ++noiseEpoch;
    if (disposed || !state.noiseEnabled) return;
    noiseStatus = 'starting'; noiseError = ''; notify();
    try {
      ensureContext();
      if (context.state !== 'running') await context.resume();
      if (disposed || startedAt !== noiseEpoch || !state.noiseEnabled) {
        if (!disposed && context.state === 'running' && !state.noiseEnabled) {
          try { context.suspend()?.catch(() => {}); } catch {}
        }
        return;
      }
      if (context.state !== 'running') throw new Error('Браузер приостановил звук.');
      setGain(master.gain, volumeGain());
      if (!voice || voice.station !== state.station) makeVoice(state.station);
      noiseStatus = 'playing'; notify();
    } catch (cause) {
      if (disposed || startedAt !== noiseEpoch || !state.noiseEnabled) return;
      noiseError = cause?.message?.includes('не поддерживает') ? cause.message : 'Шум не включился. Нажми «Продолжить» или проверь настройки браузера.';
      noiseStatus = 'error'; notify();
    }
  }

  async function startRecording() {
    if (disposed) return;
    const startedAt = ++recordingEpoch;
    state.recording = true; recordingStatus = 'starting'; recordingError = '';
    recording.volume = state.volume;
    // Assign the source only when the recording is requested. Noise, opening
    // the panel and switching sections must not download or recreate it.
    if (!recording.getAttribute('src')) recording.setAttribute('src', '/assets/audio/radio-recording.mp3?v=studio-39-final');
    if (recording.error) recording.load();
    if (Number.isFinite(recording.duration) && recording.currentTime >= recording.duration - .05) recording.currentTime = 0;
    notify();
    try {
      await recording.play();
      if (disposed || startedAt !== recordingEpoch || !state.recording) {
        // A newer request uses the same element; only cancel a stopped recording.
        if (!state.recording) recording.pause();
        return;
      }
      recordingStatus = recording.paused ? 'paused' : 'playing'; notify();
    } catch {
      if (disposed || startedAt !== recordingEpoch || !state.recording) return;
      recordingStatus = 'error'; recordingError = 'Запись не включилась. Нажми «Продолжить» или проверь подключение.'; notify();
    }
  }

  function toggleRecording() {
    if (disposed) return;
    if (state.recording && ['playing', 'starting'].includes(recordingStatus)) stopRecording();
    else void startRecording();
  }
  function toggleNoise(id) {
    if (disposed || !STATIONS.some(item => item.id === id)) return;
    if (state.noiseEnabled && state.station === id) { stopNoise(); return; }
    state.station = id; state.noiseEnabled = true; persist(); void startNoise();
  }

  // Knob updates are idempotent; each transport affects only its own source.
  function setState(patch = {}) {
    if (disposed) return;
    const previousStation = state.station;
    if (STATIONS.some(item => item.id === patch.station)) state.station = patch.station;
    if (typeof patch.volume === 'number' && Number.isFinite(patch.volume)) {
      state.volume = clamp(patch.volume); recording.volume = state.volume;
    }
    if (typeof patch.noiseVolume === 'number' && Number.isFinite(patch.noiseVolume)) {
      state.noiseVolume = clamp(patch.noiseVolume);
      if (master && context?.state === 'running') setGain(master.gain, volumeGain());
    }
    persist();
    if (patch.powered === false) { stop(); return; }
    if (patch.powered === true) { void startRecording(); return; }
    if (state.noiseEnabled && previousStation !== state.station && noiseStatus === 'playing' && context?.state === 'running') makeVoice(state.station);
    notify();
  }
  function seek(seconds) {
    if (disposed || !Number.isFinite(seconds) || !Number.isFinite(recording.duration) || recording.duration <= 0 || recording.error) return;
    try { recording.currentTime = Math.max(0, Math.min(recording.duration, seconds)); } catch { return; }
    updateProgress();
  }
  function click(event) {
    const station = event.target.closest('[data-radio-station]');
    if (station) { toggleNoise(station.dataset.radioStation); return; }
    const action = event.target.closest('[data-radio-action]')?.dataset.radioAction;
    if (action === 'power') toggleRecording();
    if (action === 'resume') {
      if (state.recording && ['paused', 'error'].includes(recordingStatus)) void startRecording();
      if (state.noiseEnabled && ['paused', 'error'].includes(noiseStatus)) void startNoise();
    }
    if (action === 'back') onBack();
  }
  function input(event) {
    if (event.target.matches('[data-radio-volume]')) setState({ volume: Number(event.target.value) / 100 });
    if (event.target.matches('[data-radio-noise-volume]')) setState({ noiseVolume: Number(event.target.value) / 100 });
    if (event.target.matches('[data-radio-seek]')) seek(Number(event.target.value));
  }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onBack(); }
  }
  function visibility() {
    if (disposed || document.hidden) return;
    // Backgrounding is never a stop action. Recover only if the browser itself
    // interrupted an already requested source while the page was away.
    if (state.noiseEnabled && context?.state !== 'running') void startNoise();
    if (state.recording && recording.paused && recordingStatus === 'paused') void startRecording();
  }
  function audioStateChanged() {
    if (disposed || !state.noiseEnabled) return;
    if (['suspended', 'interrupted'].includes(context.state) && noiseStatus === 'playing') {
      noiseStatus = 'paused'; notify();
    } else if (context.state === 'running' && noiseStatus === 'paused' && voice) {
      noiseStatus = 'playing'; notify();
    }
  }
  function recordingPlaying() {
    if (disposed) return;
    if (!state.recording) { recording.pause(); return; }
    if (recording.paused) return;
    recordingStatus = 'playing'; recordingError = ''; notify();
  }
  function recordingPaused() {
    if (disposed || !state.recording || !recording.paused || recording.ended || !['playing', 'starting'].includes(recordingStatus)) return;
    recordingStatus = 'paused'; notify();
  }
  function recordingWaiting() {
    if (disposed || !state.recording || recording.paused) return;
    recordingStatus = 'starting'; notify();
  }
  function recordingEnded() {
    if (disposed || !state.recording || !recording.ended) return;
    ++recordingEpoch; state.recording = false; recordingStatus = 'off'; notify();
  }
  function recordingFailed() {
    updateProgress();
    if (disposed || !state.recording) return;
    ++recordingEpoch; recordingStatus = 'error';
    recordingError = 'Не удалось загрузить запись. Проверь подключение и попробуй ещё раз.';
    recording.pause(); notify();
  }
  const mediaListeners = [
    ['loadedmetadata', updateTimeline], ['durationchange', updateTimeline],
    ['progress', updateBuffered], ['loadeddata', updateBuffered], ['emptied', updateTimeline],
    ['timeupdate', updateProgress], ['seeked', updateTimeline],
    ['playing', recordingPlaying], ['pause', recordingPaused],
    ['waiting', recordingWaiting], ['ended', recordingEnded], ['error', recordingFailed]
  ];
  const rangeDrags = [
    bindRangeDrag(ui.seek, {
      onStart: () => { seeking = true; },
      onInput: value => seek(value),
      onEnd: () => { seeking = false; updateProgress(); }
    }),
    bindRangeDrag(ui.volume, { thumbSize: 12, onInput: value => setState({ volume: value / 100 }) }),
    bindRangeDrag(ui.noiseVolume, { thumbSize: 12, onInput: value => setState({ noiseVolume: value / 100 }) })
  ];
  recording.volume = state.volume;
  for (const [name, listener] of mediaListeners) recording.addEventListener(name, listener);
  root.addEventListener('click', click);
  root.addEventListener('input', input);
  root.addEventListener('keydown', keyboard);
  document.addEventListener('visibilitychange', visibility);
  render(); updateBuffered();

  return {
    get state() { return snapshot(); },
    setState, toggleNoise, toggleRecording,
    setActive(value) { active = Boolean(value); if (!active) rangeDrags.forEach(drag => drag.cancel()); render(); updateBuffered(); },
    focus() { if (!disposed) ui.power.focus({ preventScroll: true }); },
    dispose() {
      if (disposed) return;
      disposed = true; ++noiseEpoch; ++recordingEpoch;
      rangeDrags.forEach(drag => drag.dispose());
      timers.forEach(id => clearTimeout(id)); timers.clear();
      for (const [name, listener] of mediaListeners) recording.removeEventListener(name, listener);
      recording.pause(); recording.removeAttribute('src'); recording.load();
      for (const item of [...voices]) destroyVoice(item);
      try { master?.disconnect(); } catch {}
      context?.removeEventListener('statechange', audioStateChanged);
      if (context && context.state !== 'closed') { try { context.close()?.catch(() => {}); } catch {} }
      noise = null;
      document.removeEventListener('visibilitychange', visibility);
      root.removeEventListener('click', click);
      root.removeEventListener('input', input);
      root.removeEventListener('keydown', keyboard);
      root.replaceChildren();
    }
  };
}
