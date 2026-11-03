import { projects, getProject, getLoadedProject, loadProject } from './portfolio-data.js?v=studio-66-final';

// Keep the four desktop icons synchronous: the 3D screen compiles their SVGs
// immediately after initOS. Larger sections are fetched only when opened.
const sections = {
  skills: { load: () => import('./skill-map.js?v=studio-66-final') },
  games: { load: () => import('./games.js?v=studio-16-final') },
  profile: { load: () => import('./profile.js?v=studio-56-final') },
};
function loadSection(name) {
  const section = sections[name];
  if (!section.pending) section.pending = section.load().then(module => {
    section.module = module;
    return module;
  }).catch(error => { section.pending = null; throw error; });
  return section.pending;
}

const DRAWINGS = {
  profile: '<rect x="5" y="10" width="58" height="44"/><circle cx="23" cy="26" r="7"/><path d="M12 46v-3c0-11 22-11 22 0v3M41 24h14m-14 9h14m-14 9h9"/>',
  document: '<path d="M15 4h26l11 11v45H15zM40 5v12h11M23 27h21M23 35h21M23 43h21M23 51h15"/>',
  code: '<path d="m21 17-16 15 16 15m22-30 16 15-16 15M37 10 27 54"/>',
  design: '<path d="m12 42 31-31 10 10-31 31-15 5zM37 17l10 10M12 42l10 10M43 11l5-5 10 10-5 5"/>',
  marketing: '<path d="M9 26h12L49 12v39L21 38H9zM18 39l5 16h10l-5-13M56 20l7-4m-7 16h8m-8 12 7 4"/>',
  content: '<rect x="8" y="13" width="48" height="40"/><path d="m27 23 16 10-16 10zM16 6h32M16 60h32"/>',
  strategy: '<path d="M14 8h36v48H14zM22 19h20m-20 9h20m-20 9h14m-14 9h20"/>',
  analytics: '<path d="M9 53h48M13 45V32h8v13M29 45V22h8v23M45 45V10h8v35"/>',
};
// Classic desktop linework: paper faces, a thin outline and a restrained
// two-pixel offset edge. Details stay separate at the taskbar's small scale.
const PIXEL_DRAWINGS = {
  burger: `<path class="os-icon-face" d="M9 29v-6h3v-5h5v-4h7v-3h16v3h7v4h5v5h3v6z"/>
    <g fill="currentColor" stroke="none"><path d="M21 16h3v2h-3zM31 13h3v2h-3zM41 16h3v2h-3zM23 21h3v3h-3zM38 21h3v3h-3z"/></g>
    <path d="M29 24v2h6v-2"/>
    <path class="os-icon-face" d="M7 34h50v5l-8-2-8 4-9-4-9 4-8-4-8 2z"/>
    <rect x="8" y="43" width="48" height="6" fill="currentColor" stroke="none"/>
    <path class="os-icon-face" d="M10 53h44v3h-3v3H13v-3h-3z"/>`,
  folder: `<path fill="currentColor" stroke="none" d="M6 23h55v35H6z"/>
    <path class="os-icon-face" d="M5 22v-8h2v-2h18l5 6h26v6z"/>
    <g fill="currentColor" stroke="none">${Array.from({ length: 3 }, (_, row) => Array.from({ length: 9 }, (_, column) => `<circle cx="${8 + column * 1.9 + (row % 2) * .8}" cy="${14 + row * 1.8}" r=".4"/>`).join('')).join('')}</g>
    <path class="os-icon-face" d="M4 22h55v34H4z"/>`,
  skills: `<path d="M32 15v10M15 32h10M39 32h10M32 39v10"/>
    <g fill="currentColor" stroke="none"><path d="M28 5h12v12H28zM5 28h12v12H5zM27 27h14v14H27zM51 28h12v12H51zM28 51h12v12H28z"/></g>
    <path class="os-icon-face" d="M26 3h12v12H26zM3 26h12v12H3zM25 25h14v14H25zM49 26h12v12H49zM26 49h12v12H26z"/>`,
  games: `<path d="M42 2v8l-4 4h-7l-3 4v10" stroke-width="2.3"/>
    <path fill="currentColor" stroke="none" transform="translate(2 2)" d="M12 28h38v2h4v3h3v3h2v13h-2v4h-3v3H9v-2H6v-3H3V37h2v-3h3v-3h4z"/>
    <path class="os-icon-face" d="M12 28h38v2h4v3h3v3h2v13h-2v4h-3v3H9v-2H6v-3H3V37h2v-3h3v-3h4z"/>
    <g fill="currentColor" stroke="none"><path d="M14 36h5v5h5v5h-5v5h-5v-5H9v-5h5z"/><rect x="27" y="47" width="5" height="2.4"/><rect x="34.5" y="47" width="5" height="2.4"/><circle cx="47" cy="36.5" r="2.5"/><circle cx="40.8" cy="42.7" r="2.5"/><circle cx="53.2" cy="42.7" r="2.5"/><circle cx="47" cy="48.9" r="2.5"/></g>`,
  contact: `<path fill="currentColor" stroke="none" d="M5 18h56v38H5z"/>
    <path class="os-icon-face" d="M3 16h56v38H3z"/>
    <path d="m4 17 24 21h6l24-21M4 53l18-18M58 53 40 35"/>`,
  monitor: `<path fill="currentColor" stroke="none" d="M10 10h47v35H10z"/>
    <path class="os-icon-face" d="M8 8h47v35H8zM25 43l-3 10h20l-3-10"/>
    <path fill="currentColor" stroke="none" d="M12 12h39v27H12z"/>
    <path d="M17 56h30"/>`,
  television: `<path d="m20 5 11 13L43 4"/>
    <rect fill="currentColor" stroke="none" x="11" y="22" width="46" height="34" rx="4"/>
    <rect class="os-icon-face" x="9" y="20" width="46" height="34" rx="4"/>
    <rect class="os-icon-face" x="14" y="25" width="31" height="24" rx="3"/>
    <g fill="currentColor" stroke="none"><circle cx="50" cy="30" r="1.5"/><circle cx="50" cy="39" r="1.5"/></g>
    <path d="M15 55v4M49 55v4"/>`,
  radio: `<path d="M13 19 53 5"/>
    <rect fill="currentColor" stroke="none" x="7" y="21" width="52" height="36" rx="1"/>
    <rect class="os-icon-face" x="5" y="19" width="52" height="36" rx="1"/>
    <path d="M11 28h25M11 34h25M11 40h25M11 46h25"/>
    <circle class="os-icon-face" cx="46" cy="30" r="4"/><circle class="os-icon-face" cx="46" cy="45" r="4"/>`,
};
const icon = (name, cls = '') => PIXEL_DRAWINGS[name]
  ? `<svg class="os-icon os-icon-pixel ${cls}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter" stroke-linecap="square" shape-rendering="geometricPrecision" aria-hidden="true">${PIXEL_DRAWINGS[name]}</svg>`
  : `<svg class="os-icon ${cls}" viewBox="0 0 68 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" aria-hidden="true">${DRAWINGS[name] || DRAWINGS.document}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HOME = [ ['experiments', 'Эксперименты', 'folder'], ['skills', 'Навыки', 'skills'], ['games', 'Игры', 'games'], ['contact', 'Контакт', 'contact'] ];
const DESKTOP_ICON_IMAGES = {
  folder: './assets/icons/desktop-folder-studio59.png',
  skills: './assets/icons/desktop-skills-studio59.png',
  games: './assets/icons/desktop-games-studio59.png',
  contact: './assets/icons/desktop-contact-studio59.png',
};
const STORAGE_KEY = 'archive26:view:1';
const defaults = () => ({ scale: 100, layout: 'icons', crt: true, contrast: false, motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });

/** A small, self-contained desktop. All pages are local HTML, not WebGL scenes. */
export function initOS(root, { onRestart = () => {}, onTelevision = () => {}, onRadio = () => {}, onExpand = () => {}, onViewChange = () => {} } = {}) {
  if (!root) throw new Error('initOS requires a screen root');
  let preferences = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') preferences = {
      scale: [100, 125, 150].includes(saved.scale) ? saved.scale : 100,
      layout: saved.layout === 'list' ? 'list' : 'icons',
      crt: typeof saved.crt === 'boolean' ? saved.crt : true,
      contrast: saved.contrast === true,
      motion: typeof saved.motion === 'boolean' ? saved.motion : defaults().motion,
    };
  } catch { /* Private browsing can make storage unavailable. */ }
  let view = 'home', selected = -1, history = [], forward = [], destroyed = false;
  let activeMenu = '', cleanupView = () => {}, clockTimer, copyTimer, noticeTimer, menuCloseTimer;
  let hoverMenu = false;
  let processIndex = 0, skillMap = null, viewTicket = 0, viewPending = false, viewActive = true;
  const scrollPositions = new Map();
  root.classList.add('retro-os');
  root.setAttribute('aria-label', 'Личный компьютер YRLMRSH');
  root.innerHTML = `<header class="os-menubar"><button class="os-brand" data-menu="system" aria-label="Системное меню" aria-haspopup="menu" aria-expanded="false">YRLMRSH</button><nav class="os-main-menu" aria-label="Меню компьютера"><button data-menu="file" aria-haspopup="menu" aria-expanded="false">Файл</button><button data-menu="view" aria-haspopup="menu" aria-expanded="false">Вид</button><button data-menu="go" aria-haspopup="menu" aria-expanded="false">Переход</button></nav><button class="os-mobile-about" data-go="about">Обо мне ↗</button><time class="os-clock"></time></header><div class="os-menu-layer" hidden></div><main class="os-workspace" tabindex="-1"></main><footer class="os-taskbar"><button class="os-radio-button" data-radio aria-label="Радио" title="Радио">${icon('radio')}<span>Радио</span></button><button class="os-desktop-button" data-go="home" aria-label="Рабочий стол" title="Рабочий стол">${icon('monitor')}<span>Рабочий стол</span></button><button class="os-tv-button" data-tv aria-label="Телевизор" title="Телевизор">${icon('television')}<span>Телевизор</span></button><span class="os-location"></span></footer><div class="os-notice" role="status" hidden></div>`;
  const main = root.querySelector('.os-workspace'), menuLayer = root.querySelector('.os-menu-layer');
  const brand = root.querySelector('.os-brand');
  const location = root.querySelector('.os-location'), notice = root.querySelector('.os-notice');
  function applyPreferences(save = true) {
    root.style.setProperty('--os-scale', preferences.scale / 100);
    root.dataset.layout = preferences.layout;
    root.classList.toggle('os-crt', preferences.crt);
    root.classList.toggle('os-high-contrast', preferences.contrast);
    root.classList.toggle('os-reduce-motion', !preferences.motion);
    if (save) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Still usable without storage. */ } }
    root.dispatchEvent(new CustomEvent('ospreferenceschange', { bubbles: true, detail: { ...preferences } }));
    root.dispatchEvent(new CustomEvent('retro-settings', { bubbles: true, detail: { crt: preferences.crt, reducedMotion: !preferences.motion, contrast: preferences.contrast, scale: preferences.scale } }));
  }
  function updateClock() { root.querySelector('.os-clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
  function notify(text) { clearTimeout(noticeTimer); notice.textContent = text; notice.hidden = false; noticeTimer = setTimeout(() => { notice.hidden = true; }, 3000); }
  const button = (text, attrs = '', dark = false) => `<button class="os-button${dark ? ' os-button-dark' : ''}" ${attrs}>${text}</button>`;
  function windowFrame(title, body, { type = '', toolbar = '', footer = '', iconName = 'folder' } = {}) {
    return `<section class="os-window ${type}" aria-label="${esc(title)}"><header class="os-titlebar"><button class="os-mobile-back" data-back aria-label="Назад">←</button>${icon(iconName)}<h1>${esc(title)}</h1><div class="os-window-controls"><button data-minimize aria-label="Свернуть">−</button><button data-expand aria-label="Пользоваться без 3D" title="Пользоваться без 3D">${icon('monitor')}</button><button data-go="home" aria-label="На рабочий стол"><span class="os-desktop-close">×</span><span class="os-mobile-home">${icon('monitor')}</span></button></div></header>${toolbar}<div class="os-window-content" tabindex="0">${body}</div>${footer ? `<footer class="os-window-footer">${footer}</footer>` : ''}</section>`;
  }
  function breadcrumbs(items, extras = '') { return `<div class="os-pathbar"><button class="os-small-button" data-back aria-label="Назад">←</button><span>${items}</span>${extras}</div>`; }
  function cover(project, cls = '') { return `<img class="os-case-cover ${cls}" src="${esc(project.cover)}?v=studio-35-final2" alt="${esc(project.coverAlt || project.title)}" draggable="false" loading="lazy" decoding="async">`; }
  const paragraphs = text => String(text ?? '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map(part => `<p>${esc(part)}</p>`).join('');
  const imageDimensions = image => ['width', 'height'].map(name => {
    const value = Number(image?.[name]);
    return Number.isInteger(value) && value > 0 ? ` ${name}="${value}"` : '';
  }).join('');
  function contentImages(item, cls = '', projectId = '') {
    const images = [...(item.image ? [item.image] : []), ...(Array.isArray(item.images) ? item.images : [])];
    return images.filter(image => image && typeof image.src === 'string' && image.src.trim()).map(image => {
      const picture = `<img src="${esc(image.src)}" alt="${esc(image.alt || '')}"${imageDimensions(image)} loading="lazy" decoding="async">`;
      const interactive = projectId && image.assetId ? `<button class="os-content-image-button" data-go="image:${esc(projectId)}:${esc(image.assetId)}" aria-label="Рассмотреть иллюстрацию: ${esc(image.alt || image.caption || 'Материал проекта')}">${picture}</button>` : picture;
      return `<figure class="os-content-figure ${cls}">${interactive}${image.caption ? `<figcaption>${esc(image.caption)}</figcaption>` : ''}</figure>`;
    }).join('');
  }
  function articleSources(section) {
    const sources = (Array.isArray(section.sources) ? section.sources : []).filter(source => {
      if (!source || typeof source.url !== 'string') return false;
      try { const url = new URL(source.url); return url.protocol === 'https:' && Boolean(url.hostname); }
      catch { return false; }
    });
    return sources.length ? `<aside class="os-article-sources" aria-label="Источники к разделу"><p>Источники</p><ul>${sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label || 'Открыть исследование')} ↗</a>${source.note ? `<span>${esc(source.note)}</span>` : ''}</li>`).join('')}</ul></aside>` : '';
  }
  function caseLinks(project, cls = '') {
    const links = (project.links || []).filter(link => link && /^https?:\/\//i.test(link.url || ''));
    return links.length ? `<div class="os-case-links ${cls}">${links.map(link => `<a class="os-button" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(link.label || 'Открыть сайт')} ↗</strong>${link.note ? `<span>${esc(link.note)}</span>` : ''}</a>`).join('')}</div>` : '';
  }
  function stepDetail(step, project) {
    const actions = (step.actions || []).filter(action => typeof action === 'string' && action.trim());
    const decisions = (step.decisions || []).filter(decision => decision && decision.decision);
    return `<section class="os-step-detail" aria-live="polite" tabindex="-1"><button class="os-map-return" data-return-map="process">↑ К этапам</button><h3>${esc(step.title)}</h3>${paragraphs(step.description || step.summary)}${actions.length ? `<div class="os-step-actions"><h4>Что сделано</h4><ul>${actions.map(action => `<li>${esc(action)}</li>`).join('')}</ul></div>` : ''}${decisions.length ? `<div class="os-step-decisions"><h4>Ключевые решения</h4>${decisions.map(decision => `<div class="os-step-decision"><strong>${esc(decision.decision)}</strong>${paragraphs(decision.reason)}${decision.tradeoff ? `<p class="os-step-tradeoff">${esc(decision.tradeoff)}</p>` : ''}</div>`).join('')}</div>` : ''}${contentImages(step, 'os-step-figure', project?.id)}${step.output ? `<p class="os-step-output"><strong>На выходе</strong> ${esc(step.output)}</p>` : ''}</section>`;
  }
  function renderDesktop() {
    // Raster copies avoid transformed-SVG painting differences in Chrome. Keep
    // the original hidden SVG for the unchanged 3D Canvas icon compiler.
    return `<div class="os-desktop"><div class="os-desktop-icons">${HOME.map(([key, label, image]) => `<button class="os-desktop-item" data-select data-go="${key}"><img class="os-icon os-icon-pixel" src="${DESKTOP_ICON_IMAGES[image]}" width="64" height="64" alt="" aria-hidden="true" draggable="false">${icon(image).replace('<svg ', '<svg hidden ')}<span>${label}</span></button>`).join('')}</div></div>`;
  }
  function renderExperiments() {
    const cards = projects.map(p => `<button class="os-project-card" data-select data-go="case:${p.id}" aria-label="${esc(p.title)} — ${esc(p.cardSummary || p.kind)}"><span class="os-cover-frame">${cover(p)}</span><span class="os-project-card-label">${icon('folder')}<span><strong>${esc(p.title)}</strong><small>${esc(p.kind)}</small>${p.cardSummary ? `<span class="os-project-summary">${esc(p.cardSummary)}</span>` : ''}</span></span></button>`).join('');
    return windowFrame('Эксперименты', `<div class="os-project-grid">${cards}</div>`, {
      toolbar: breadcrumbs('', `<div class="os-layout-switch" aria-label="Вид каталога"><button data-layout="icons" aria-label="Показывать карточками" aria-pressed="${preferences.layout === 'icons'}">▦</button><button data-layout="list" aria-label="Показывать списком" aria-pressed="${preferences.layout === 'list'}">☷</button></div>`),
      footer: `<button data-go="completed">${icon('folder')}<span>Завершённые кейсы</span><span>›</span></button><button data-go="upcoming">${icon('folder')}<span>Скоро</span><span>›</span></button>`,
      type: 'os-experiments-window',
    });
  }
  function caseNav(project, tab) {
    return `<nav class="os-case-tabs" aria-label="Разделы кейса">${[['overview', 'Кратко', 'document'], ['process', 'Ход работы', 'skills'], ['materials', 'Материалы', 'folder']].map(([key, title, image]) => `<button data-select data-go="case:${project.id}:${key}" aria-current="${tab === key ? 'page' : 'false'}">${icon(image)}<span>${title}</span></button>`).join('')}</nav>`;
  }
  function projectActions(project) {
    if (project.id === 'noise') return `<div class="os-actions">${button('Подробный разбор', `data-go="article:${project.id}"`, true)}</div>`;
    return `<div class="os-actions">${button('Подробный разбор', `data-go="article:${project.id}"`, true)}${project.video?.available ? button('Смотреть ролик', `data-tv="${project.id}"`) : ''}${project.demoUrl && !(project.links || []).some(link => link.url === project.demoUrl) ? button('Открыть демо ↗', `data-go="demo:${project.id}"`) : ''}</div>`;
  }
  function renderCase(project, tab) {
    let body;
    const articleEntry = tab === 'process' && project.processPresentation === 'article';
    if (articleEntry) {
      body = `<div class="os-case-article-entry"><button class="os-button os-case-article-button" data-go="article:${esc(project.id)}">${icon(project.processIcon || 'burger', 'os-case-article-icon')}<span>Подробный разбор</span></button></div>`;
    } else if (tab === 'process') {
      const steps = project.process || [], chosen = steps[Math.min(processIndex, steps.length - 1)];
      const detailed = steps.length > 8 || steps.some(step => step.actions?.length || step.decisions?.length);
      const nodes = steps.map((step, i) => {
        const row = Math.floor(i / 2) + 1;
        const column = row % 2 ? i % 2 + 1 : 2 - i % 2;
        const flow = i === steps.length - 1 ? 'none' : i % 2 ? 'down' : row % 2 ? 'right' : 'left';
        return `<button class="os-process-step${i === processIndex ? ' is-active' : ''}" data-step="${i}" data-flow="${flow}" style="grid-row:${row};grid-column:${column}" aria-pressed="${i === processIndex}">${icon(step.icon || ['strategy','design','code','document','content','analytics'][i % 6])}<strong>${esc(step.title)}</strong></button>`;
      }).join('');
      body = `<div class="os-case-heading"><h2>Ход работы</h2></div><div class="os-process${detailed ? ' os-process-long' : ''}" aria-label="Этапы работы">${nodes}</div>${chosen ? stepDetail(chosen, project) : ''}<div class="os-tools">${(project.tools || []).map(item => `<span>${esc(item)}</span>`).join('')}</div>${projectActions(project)}`;
    } else if (tab === 'materials') {
      const materials = (project.materials || []).filter(item => item && item.id && item.src);
      body = `<div class="os-case-heading"><h2>Материалы</h2></div>${caseLinks(project)}<div class="os-material-grid">${project.processPresentation === 'article' ? '' : `<button class="os-material-cover" data-go="image:${project.id}">${cover(project)}<span>Рассмотреть обложку ↗</span></button>`}<button class="os-material-file" data-go="article:${project.id}">${icon('document')}<strong>Подробный разбор</strong><span>Задача, подход, решения и результат</span></button>${project.video?.available ? `<button class="os-material-file" data-tv="${project.id}">${icon('television')}<strong>Смотреть ролик</strong></button>` : ''}${project.id !== 'noise' && project.demoUrl ? `<button class="os-material-file" data-go="demo:${project.id}">${icon('monitor')}<strong>Демонстрация</strong><span>Открыть проект</span></button>` : ''}</div>${materials.length ? `<div class="os-case-media-gallery" aria-label="Иллюстрации проекта">${materials.map(item => `<button class="os-case-media-card" data-go="image:${project.id}:${esc(item.id)}"><img src="${esc(item.src)}" alt="${esc(item.alt || item.title || project.title)}"${imageDimensions(item)} loading="lazy" decoding="async"><span><strong>${esc(item.title || 'Материал проекта')}</strong>${item.caption ? `<small>${esc(item.caption)}</small>` : ''}</span></button>`).join('')}</div>` : project.processPresentation === 'article' ? '' : '<p class="os-footnote">Исходные материалы и ссылки будут дополняться по мере подготовки кейса.</p>'}`;
    } else {
      body = `${cover(project)}<div class="os-status">${esc(project.statusShort)}</div><h2>${esc(project.subtitle || project.title)}</h2>${project.intro ? `<p class="os-case-intro">${esc(project.intro)}</p>` : ''}<dl class="os-project-facts"><div><dt>Задача</dt><dd>${esc(project.task)}</dd></div>${project.contribution ? `<div><dt>Моя роль</dt><dd>${esc(project.contribution)}</dd></div>` : ''}<div><dt>Решения</dt><dd><ul class="os-done-list">${project.done.map(item => `<li>${esc(String(item).trim())}</li>`).join('')}</ul></dd></div><div><dt>${esc(project.resultLabel || 'Сейчас')}</dt><dd>${esc(project.current)}</dd></div></dl>${caseLinks(project)}${projectActions(project)}`;
    }
    return windowFrame(project.title, `<div class="os-case-layout${articleEntry ? ' os-case-layout-article-entry' : ''}">${caseNav(project, tab)}<article class="os-case-body${articleEntry ? ' os-case-body-article-entry' : ''}">${body}</article></div>`, {
      toolbar: breadcrumbs(`Эксперименты / ${esc(project.title)}`), type: 'os-case-window',
    });
  }
  function renderArticle(project) {
    const article = project.article || { lead: project.intro, sections: [] };
    const sections = article.sections || [], longArticle = sections.length >= 5 || (project.processPresentation === 'article' && sections.length >= 4);
    const lead = String(article.lead || project.intro || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map(part => `<p class="os-journal-lead">${esc(part)}</p>`).join('');
    const contents = longArticle ? `<details class="os-article-toc"${root.clientWidth >= 780 ? ' open' : ''}><summary>В этой статье</summary><nav aria-label="Содержание статьи"><ol>${sections.map((section, i) => `<li><button class="os-button" data-article-jump="${i}">${esc(section.navTitle || section.heading)}</button></li>`).join('')}</ol></nav></details>` : `<div class="os-print-ad">${icon('radio')}<strong>Бюро тишины</strong><p>Дождь, шум и ветер для чтения.</p>${button('Слушать', 'data-radio')}</div>`;
    return windowFrame('Журнал', `<div class="os-journal${longArticle ? ' os-journal-with-toc' : ''}"><article class="os-journal-reading"><header class="os-article-heading"><p class="os-article-meta">${esc(project.status)}</p><h2>${esc(article.title || project.subtitle || project.title)}</h2>${lead}${project.video?.available ? `<div class="os-actions">${button('Смотреть ролик', `data-tv="${project.id}"`, true)}</div>` : ''}</header><figure class="os-article-image">${cover(project)}</figure>${sections.map((section, i) => `<section id="os-article-section-${i}" tabindex="-1"><h3>${esc(section.heading)}</h3>${paragraphs(section.text)}${section.bullets?.length ? `<ul class="os-article-list">${section.bullets.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${contentImages(section, '', project.id)}${articleSources(section)}</section>`).join('')}<footer class="os-journal-colophon"><span>YRLMRSH</span><button data-go="case:${project.id}:materials">Материалы проекта →</button></footer></article><aside class="os-journal-sidebar" aria-label="${longArticle ? 'Содержание и материалы' : 'Радио и материалы'}">${contents}<button class="os-folder-return" data-go="case:${project.id}">${icon('folder')}К проекту</button>${longArticle ? `<button class="os-folder-return" data-go="case:${project.id}:materials">${icon('folder')}Материалы</button>` : ''}${project.id === 'noise' ? (/^https:\/\//i.test(project.demoUrl || '') ? `<a class="os-folder-return" href="${esc(project.demoUrl)}" target="_blank" rel="noopener noreferrer">${icon('radio')}Открыть приложение ↗</a>` : '') : project.video?.available ? `<button class="os-folder-return" data-tv="${project.id}">${icon('television')}На телевизоре</button>` : ''}</aside></div>`, {
      type: 'os-browser-window', iconName: 'document', toolbar: `<div class="os-browser-toolbar"><button class="os-small-button" data-back aria-label="Назад">←</button><button class="os-small-button" data-forward aria-label="Вперёд" ${forward.length ? '' : 'disabled'}>→</button><button class="os-small-button" data-go="experiments" aria-label="К экспериментам">⌂</button><div class="os-address" aria-label="Открытый проект">${esc(project.title)}</div></div>`,
    });
  }
  function renderDemo(project) {
    return windowFrame(`${project.title} / Демо`, `<article class="os-demo-page">${cover(project)}<span class="os-status">${esc(project.status)}</span><h2>${esc(project.title)}</h2><p>${esc(project.intro)}</p><section class="os-inset"><h3>${project.demoUrl ? 'Проект доступен' : 'Ссылка на демо пока не добавлена'}</h3><p>${esc(project.current)}</p></section>${caseLinks(project)}<div class="os-actions">${project.demoUrl ? `<a class="os-button os-button-dark" href="${esc(project.demoUrl)}" target="_blank" rel="noopener noreferrer">Открыть проект ↗</a>` : ''}${button('Материалы', `data-go="case:${project.id}:materials"`)}${button('Подробный разбор', `data-go="article:${project.id}"`)}</div></article>`, { iconName: 'monitor', toolbar: breadcrumbs(`archive://demo/${esc(project.id)}`) });
  }
  function renderSkills() {
    return windowFrame('Навыки', '<div class="os-skill-map-mount"></div>', { type: 'os-skills-window', iconName: 'skills' });
  }
  function renderAbout() {
    return windowFrame('Обо мне', sections.profile.module.renderAbout(icon), { type: 'os-profile-window', iconName: 'profile' });
  }
  function renderContact() {
    return windowFrame('Контакт', sections.profile.module.renderContact(icon), { type: 'os-contact-window', iconName: 'contact' });
  }
  function renderSettings() {
    return windowFrame('Вид', `<form class="os-settings"><fieldset><legend>Размер интерфейса</legend>${[100,125,150].map(scale => `<label><input type="radio" name="scale" value="${scale}" ${preferences.scale === scale ? 'checked' : ''}>${scale}%</label>`).join('')}</fieldset><fieldset><legend>Рабочий стол</legend><label><input type="radio" name="layout" value="icons" ${preferences.layout === 'icons' ? 'checked' : ''}>Значки</label><label><input type="radio" name="layout" value="list" ${preferences.layout === 'list' ? 'checked' : ''}>Список</label></fieldset><fieldset><legend>Экран</legend><label><input type="checkbox" name="crt" ${preferences.crt ? 'checked' : ''}>Линии ЭЛТ</label><label><input type="checkbox" name="contrast" ${preferences.contrast ? 'checked' : ''}>Больше контраста</label></fieldset><fieldset><legend>Движение</legend><label><input type="checkbox" name="reduce" ${preferences.motion ? '' : 'checked'}>Меньше анимации</label><p>Для спокойного просмотра.</p></fieldset><div class="os-settings-actions">${button('Применить', 'type="submit"', true)}${button('Сбросить', 'type="button" data-reset-settings')}</div></form>`, { type: 'os-settings-window', iconName: 'monitor' });
  }
  function renderCollection(kind) {
    const upcoming = kind === 'upcoming';
    return windowFrame(upcoming ? 'Скоро' : 'Завершённые кейсы', `<div class="os-empty-collection">${icon('folder')}<h2>${upcoming ? 'Архив открыт.' : 'Пока пусто.'}</h2><p>${upcoming ? 'Новые эксперименты появятся здесь.' : 'Здесь будут проекты с результатами после запуска. Сейчас в архиве — эксперименты и личные проекты.'}</p>${button(upcoming ? 'К экспериментам' : 'Посмотреть эксперименты', 'data-go="experiments"')}${button('Обсудить идею', 'data-go="contact"')}</div>`);
  }
  function selectable() { return [...main.querySelectorAll('[data-select]')]; }
  function select(index, focus = true) {
    const items = selectable(); if (!items.length) return;
    selected = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle('is-selected', i === selected));
    if (focus) { items[selected].focus({ preventScroll: true }); items[selected].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  function normalized(route) { return route.startsWith('project:') ? route.replace('project:', 'case:') : route === 'game' ? 'games' : route; }
  function show(next = 'home', { remember = true, focus = true } = {}) {
    if (destroyed) return;
    next = normalized(next);
    if (next === 'videos') { closeMenu(false); onTelevision(null); return; }
    const ticket = ++viewTicket;
    const previousContent = main.querySelector('.os-window-content');
    if (previousContent && !viewPending) scrollPositions.set(view, previousContent.scrollTop);
    if (remember && next !== view) { history.push(view); forward = []; }
    if (history.length > 60) history.shift();
    cleanupView(); cleanupView = () => {};
    closeMenu(false); selected = -1;
    const [page, id] = next.split(':');
    const project = id ? getProject(id) : null;
    const needsProject = ['case','article','demo','image'].includes(page) && Boolean(project);
    if (['case','article','demo','image'].includes(page) && !project) next = 'experiments';
    view = next; root.dataset.view = view;
    const sectionName = next === 'skills' || next === 'games' ? next : next === 'about' || next === 'contact' ? 'profile' : '';
    const pending = needsProject && !getLoadedProject(id) ? loadProject(id)
      : sectionName && !sections[sectionName].module ? loadSection(sectionName) : null;
    if (pending) {
      viewPending = true;
      const label = project?.title || ({ skills: 'Навыки', games: 'Игры', about: 'Обо мне', contact: 'Контакт' }[next]);
      main.setAttribute('aria-busy', 'true');
      main.innerHTML = windowFrame(label, '<div class="os-empty-collection"><p role="status">Загрузка…</p></div>');
      location.textContent = label;
      if (focus) main.querySelector('.os-window-content')?.focus({ preventScroll: true });
      pending.then(loaded => {
        if (destroyed || ticket !== viewTicket) return;
        // A section finishing in the background must not steal focus from a
        // menu, another device, or a different page the visitor has opened.
        const restoreFocus = focus && main.contains(document.activeElement) && !root.inert && !root.hidden;
        completeView(next, needsProject ? loaded : project, { remember, focus: restoreFocus });
      }).catch(() => {
        if (destroyed || ticket !== viewTicket) return;
        const restoreFocus = focus && main.contains(document.activeElement) && !root.inert && !root.hidden;
        main.removeAttribute('aria-busy');
        main.innerHTML = windowFrame(label, `<div class="os-empty-collection"><p role="alert">Не удалось загрузить раздел. Проверь соединение и попробуй ещё раз.</p>${button('Попробовать снова', 'data-retry-view', true)}${button('На рабочий стол', 'data-go="home"')}</div>`);
        if (restoreFocus) main.querySelector('[data-retry-view]')?.focus({ preventScroll: true });
      });
    } else completeView(next, needsProject ? getLoadedProject(id) : project, { remember, focus });
    onViewChange(view);
  }
  function completeView(next, project, { remember, focus }) {
    viewPending = false;
    main.removeAttribute('aria-busy');
    const [page, , tab = 'overview'] = next.split(':');
    let label = 'Рабочий стол';
    if (next === 'home') main.innerHTML = renderDesktop();
    else if (next === 'experiments') { main.innerHTML = renderExperiments(); label = 'Эксперименты'; }
    else if (project && page === 'case') { main.innerHTML = renderCase(project, ['overview','process','materials'].includes(tab) ? tab : 'overview'); label = project.title; }
    else if (project && page === 'article') { main.innerHTML = renderArticle(project); label = 'Журнал'; }
    else if (project && page === 'demo') { main.innerHTML = renderDemo(project); label = 'Демонстрация'; }
    else if (project && page === 'image') {
      const galleryAsset = (project.materials || []).find(item => item.id === tab);
      const articleAsset = (project.article?.sections || []).flatMap(section => section.images || []).find(item => item.assetId === tab);
      const processAsset = (project.process || []).flatMap(step => step.images || []).find(item => item.assetId === tab);
      const asset = galleryAsset || articleAsset || processAsset;
      const title = asset?.title || (asset ? 'Иллюстрация' : 'Обложка');
      main.innerHTML = windowFrame(`${project.title} / ${title}`, `<div class="os-image-view">${asset ? `<figure class="os-content-figure"><img src="${esc(asset.src)}" alt="${esc(asset.alt || asset.title || project.title)}"${imageDimensions(asset)} decoding="async">${asset.caption ? `<figcaption>${esc(asset.caption)}</figcaption>` : ''}</figure>` : `${cover(project)}<p>${esc(project.coverAlt || project.title)}</p>`}${articleAsset && !galleryAsset ? button('К статье', `data-go="article:${project.id}"`) : button('К материалам', `data-go="case:${project.id}:materials"`)}</div>`, { iconName: 'design' }); label = 'Просмотр';
    }
    else if (next === 'skills') { main.innerHTML = renderSkills(); skillMap = sections.skills.module.mountSkillMap(main.querySelector('.os-skill-map-mount'), { onProject: id => show(`case:${id}`), onContact: () => show('contact') }); skillMap.setActive?.(viewActive); cleanupView = () => { skillMap?.dispose(); skillMap = null; }; label = 'Навыки'; }
    else if (next === 'about') { main.innerHTML = renderAbout(); label = 'Обо мне'; }
    else if (next === 'contact') { main.innerHTML = renderContact(); cleanupView = sections.profile.module.mountContact(main.querySelector('.os-contact-panel')); label = 'Контакт'; }
    else if (next === 'settings') { main.innerHTML = renderSettings(); label = 'Вид'; }
    else if (next === 'completed' || next === 'upcoming') { main.innerHTML = renderCollection(next); label = next === 'completed' ? 'Завершённые' : 'Скоро'; }
    else if (next === 'games') { main.innerHTML = windowFrame('Игры', '<div class="os-games-mount"></div>', { type: 'os-games-window', iconName: 'games' }); const mounted = sections.games.module.mountGames(main.querySelector('.os-games-mount')); cleanupView = typeof mounted === 'function' ? mounted : () => mounted?.dispose?.(); root.dispatchEvent(new CustomEvent('retro-activity', { bubbles: true, detail: { active: viewActive } })); label = 'Игры'; }
    else { view = 'home'; root.dataset.view = 'home'; main.innerHTML = renderDesktop(); }
    syncViewportLayout();
    location.textContent = next === 'home' ? '' : label;
    if (!remember && scrollPositions.has(view)) main.querySelector('.os-window-content')?.scrollTo({ top: scrollPositions.get(view) });
    if (focus) { const target = next === 'home' ? main : main.querySelector('.os-window-content'); (target || main).focus({ preventScroll: true }); }
  }
  function goBack() { const previous = history.pop(); if (previous) { forward.push(view); show(previous, { remember: false }); } else show('home', { remember: false }); }
  function goForward() { const next = forward.pop(); if (next) { history.push(view); show(next, { remember: false }); } }
  function closeMenu(restoreFocus = false) {
    clearTimeout(menuCloseTimer); hoverMenu = false;
    if (!activeMenu) return;
    const trigger = root.querySelector(`[data-menu="${activeMenu}"]`);
    trigger?.setAttribute('aria-expanded', 'false'); trigger?.classList.remove('is-open');
    activeMenu = ''; menuLayer.hidden = true; menuLayer.innerHTML = '';
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  }
  function openMenu(name, keyboard = false) {
    if (activeMenu === name) { closeMenu(true); return; }
    closeMenu(); activeMenu = name;
    const entries = {
      system: [['Обо мне', 'about'], ['Рабочий стол', 'home'], ['Видеотека', 'videos'], ['К радио', 'radio'], ['Настройки', 'settings'], ['Перезагрузить', 'restart']],
      file: [['Открыть эксперименты', 'experiments'], ['Видеотека', 'videos'], ['Написать автору', 'contact'], ['Закрыть окно', 'home']],
      view: [['Настроить вид…', 'settings'], ['Значки', 'layout:icons'], ['Список', 'layout:list'], ['Пользоваться без 3D', 'expand']],
      go: [['Рабочий стол', 'home'], ['Эксперименты', 'experiments'], ['Навыки', 'skills'], ['Игры', 'games'], ['Контакт', 'contact'], ['К телевизору', 'television'], ['К радио', 'radio']],
    };
    menuLayer.innerHTML = `<div class="os-dropdown" role="menu">${(entries[name] || entries.system).map(([label, action]) => `<button role="menuitem" data-menu-action="${action}">${action === `layout:${preferences.layout}` ? '✓ ' : ''}${label}</button>`).join('')}</div>`;
    const trigger = root.querySelector(`[data-menu="${name}"]`);
    trigger?.setAttribute('aria-expanded', 'true'); trigger?.classList.add('is-open'); menuLayer.hidden = false;
    // offsetLeft uses the untransformed screen coordinates, unlike client rectangles.
    const left = trigger ? trigger.offsetLeft + (trigger.offsetParent?.classList.contains('os-main-menu') ? trigger.offsetParent.offsetLeft : 0) : 0;
    menuLayer.querySelector('.os-dropdown').style.left = `${Math.max(0, Math.min(left, root.clientWidth - 230))}px`;
    if (keyboard) menuLayer.querySelector('button')?.focus();
  }
  function keepHoverMenu() { clearTimeout(menuCloseTimer); }
  function openHoverMenu(event) {
    if (event.pointerType === 'touch') return;
    keepHoverMenu();
    if (activeMenu !== 'system') { openMenu('system'); hoverMenu = true; }
  }
  function leaveHoverMenu() {
    if (!hoverMenu) return;
    clearTimeout(menuCloseTimer);
    menuCloseTimer = setTimeout(() => {
      if (!menuLayer.contains(document.activeElement)) closeMenu();
    }, 220);
  }
  async function copyHandle(buttonEl) {
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText('@YRLMRSH'); copied = true; } } catch { /* Clipboard fallback below. */ }
    if (!copied) {
      const field = document.createElement('textarea'); field.value = '@YRLMRSH'; field.setAttribute('readonly',''); field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'; root.append(field); field.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      field.remove();
    }
    if (destroyed || !buttonEl.isConnected || !root.contains(buttonEl)) return;
    buttonEl.textContent = copied ? 'Ник скопирован ✓' : '@YRLMRSH — выдели и скопируй';
    buttonEl.focus({ preventScroll: true }); clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { if (buttonEl.isConnected) buttonEl.textContent = 'Скопировать ник'; }, 2500);
    const handle = root.querySelector('.os-contact h2');
    if (!copied && handle) window.getSelection()?.selectAllChildren(handle);
  }
  function scrollContentTo(selector, focusSelector = '') {
    const content = main.querySelector('.os-window-content');
    const target = content?.querySelector(selector);
    if (!content || !target) return;
    const focusTarget = focusSelector ? content.querySelector(focusSelector) : target;
    // Layout offsets remain correct while the LCD is transformed in 3D.
    let top = 0, element = focusSelector && target.contains(focusTarget) ? focusTarget : target;
    while (element && element !== content) { top += element.offsetTop; element = element.offsetParent; }
    const tabs = content.querySelector('.os-case-tabs');
    // Only the stacked tab row covers the top of narrow content. The desktop
    // sidebar stretches to the article's height and must never be subtracted.
    const tabHeight = tabs && tabs.offsetWidth >= content.clientWidth * .8 ? tabs.offsetHeight : 0;
    focusTarget?.focus({ preventScroll: true });
    content.scrollTo({ top: Math.max(0, top - tabHeight - 8), behavior: preferences.motion && !document.body.classList.contains('mobile-mode') ? 'smooth' : 'auto' });
  }
  function click(event) {
    const target = event.target.closest('button, a');
    if (!target || !root.contains(target)) { closeMenu(); return; }
    if (target.dataset.menu) {
      // A mouse click after pointer-enter pins the already open menu. Touch and
      // keyboard keep the same click/arrow access without relying on hover.
      if (target === brand && activeMenu === 'system' && hoverMenu) {
        keepHoverMenu(); hoverMenu = false;
        if (event.detail === 0) menuLayer.querySelector('button')?.focus();
      } else openMenu(target.dataset.menu, event.detail === 0);
      return;
    }
    if (target.dataset.menuAction) {
      const action = target.dataset.menuAction; closeMenu();
      if (action.startsWith('layout:')) { preferences.layout = action.split(':')[1]; applyPreferences(); show(view, { remember: false }); }
      else if (action === 'restart') { show('home', { focus: false }); onRestart(); }
      else if (action === 'television') onTelevision(null);
      else if (action === 'radio') onRadio();
      else if (action === 'expand') onExpand();
      else if (action === 'about') show('about');
      else show(action);
      return;
    }
    closeMenu();
    if (target.hasAttribute('data-retry-view')) { show(view, { remember: false }); return; }
    if (target.hasAttribute('data-tv')) { onTelevision(target.dataset.tv || null); return; }
    if (target.hasAttribute('data-radio')) { onRadio(); return; }
    if (target.hasAttribute('data-go')) { const next = target.dataset.go; if (!next.endsWith(':process')) processIndex = 0; show(next); return; }
    if (target.hasAttribute('data-back')) { goBack(); return; }
    if (target.hasAttribute('data-forward')) { goForward(); return; }
    if (target.hasAttribute('data-minimize')) { show('home'); return; }
    if (target.hasAttribute('data-expand')) { onExpand(); return; }
    if (target.hasAttribute('data-copy')) { copyHandle(target); return; }
    if (target.hasAttribute('data-layout')) { preferences.layout = target.dataset.layout; applyPreferences(); show(view, { remember: false }); return; }
    if (target.hasAttribute('data-step')) { const content = main.querySelector('.os-window-content'), scrollTop = content.scrollTop; processIndex = Number(target.dataset.step); show(view, { remember: false, focus: false }); main.querySelector('.os-window-content').scrollTop = scrollTop; main.querySelector(`[data-step="${processIndex}"]`)?.focus({ preventScroll: true }); if (root.clientWidth < 570 || main.querySelector('.os-process-long')) scrollContentTo('.os-step-detail'); return; }
    if (target.hasAttribute('data-article-jump')) { const section = Number(target.dataset.articleJump); if (Number.isInteger(section) && section >= 0) scrollContentTo(`#os-article-section-${section}`); return; }
    if (target.hasAttribute('data-return-map')) { scrollContentTo('.os-process', `[data-step="${processIndex}"]`); return; }
    if (target.hasAttribute('data-reset-settings')) { preferences = defaults(); applyPreferences(); show('settings', { remember: false }); return; }
    if (target.hasAttribute('data-select')) select(selectable().indexOf(target), false);
  }
  function submit(event) {
    if (!event.target.matches('.os-settings')) return; event.preventDefault();
    const data = new FormData(event.target);
    preferences = { scale: Number(data.get('scale')), layout: data.get('layout'), crt: data.has('crt'), contrast: data.has('contrast'), motion: !data.has('reduce') };
    applyPreferences(); goBack(); notify('Вид сохранён');
  }
  function keydown(event) {
    if (!root.contains(document.activeElement) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (activeMenu) {
      const buttons = [...menuLayer.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); return; }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const menus = ['system','file','view','go']; const name = menus[(menus.indexOf(activeMenu) + (event.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length]; openMenu(name, true); return; }
    }
    if (event.key === 'Escape' || (event.key === 'Backspace' && !event.target.matches('input,textarea,[contenteditable]'))) { event.preventDefault(); event.stopPropagation(); goBack(); return; }
    if (view === 'games' || event.target.matches('input,textarea,select')) return;
    if (view === 'home' || view === 'experiments') {
      const grid = main.querySelector(view === 'home' ? (document.body.classList.contains('mobile-mode') ? '.os-desktop-icons' : '.os-desktop') : '.os-project-grid');
      const gridStyle = grid ? getComputedStyle(grid) : null;
      const columns = gridStyle?.display === 'grid' ? Math.max(1, gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length) : 1;
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
      if (delta) { event.preventDefault(); const index = selectable().indexOf(document.activeElement); select(index < 0 ? delta > 0 ? 0 : selectable().length - 1 : index + delta); }
      if (event.key === 'Enter' && document.activeElement === main) { event.preventDefault(); select(0, false); selectable()[0]?.click(); }
    } else if (document.activeElement.classList.contains('os-window-content') && ['ArrowDown','ArrowUp','PageDown','PageUp'].includes(event.key)) {
      event.preventDefault(); document.activeElement.scrollBy({ top: (event.key.includes('Down') ? 1 : -1) * (event.key.startsWith('Page') ? 180 : 45) });
    }
  }
  function outsidePointer(event) { if (!root.contains(event.target)) closeMenu(); }
  function activity(event) { viewActive = event.detail?.active !== false; skillMap?.setActive?.(viewActive); }
  function syncViewportLayout() {
    const frame = main.querySelector('.os-window');
    const content = frame?.querySelector('.os-window-content');
    const footer = frame?.querySelector('.os-window-footer');
    if (!content || !footer) return;
    // Collection links belong to the page on a phone, rather than covering
    // the scroll area. Keep the same elements and restore the desktop frame.
    const parent = document.body.classList.contains('mobile-mode') ? content : frame;
    if (footer.parentElement !== parent) parent.append(footer);
  }
  root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('keydown', keydown); document.addEventListener('pointerdown', outsidePointer); root.addEventListener('retro-activity', activity);
  root.addEventListener('retro-viewport', syncViewportLayout);
  brand.addEventListener('pointerenter', openHoverMenu); brand.addEventListener('pointerleave', leaveHoverMenu);
  menuLayer.addEventListener('pointerenter', keepHoverMenu); menuLayer.addEventListener('pointerleave', leaveHoverMenu);
  applyPreferences(false); updateClock(); clockTimer = setInterval(updateClock, 30000); show('home', { focus: false });
  function focus() { if (selected >= 0 && selectable().length) select(selected); else (main.querySelector('.os-window-content') || main).focus({ preventScroll: true }); }
  function dispose() {
    if (destroyed) return; destroyed = true; cleanupView(); clearInterval(clockTimer); clearTimeout(copyTimer); clearTimeout(noticeTimer); clearTimeout(menuCloseTimer);
    root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outsidePointer); root.removeEventListener('retro-activity', activity);
    root.removeEventListener('retro-viewport', syncViewportLayout);
    brand.removeEventListener('pointerenter', openHoverMenu); brand.removeEventListener('pointerleave', leaveHoverMenu);
    menuLayer.removeEventListener('pointerenter', keepHoverMenu); menuLayer.removeEventListener('pointerleave', leaveHoverMenu);
    root.classList.remove('retro-os','os-crt','os-high-contrast','os-reduce-motion'); root.innerHTML = '';
  }
  return { open: show, show, focus, dispose, destroy: dispose, get view() { return view; }, get preferences() { return { ...preferences }; } };
}
