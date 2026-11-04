const PORTRAIT = '/assets/profile/yaroslav-portrait-studio56.webp';
export const CONTACT_EMAIL = 'miroshnichenko.ys@mail.ru';
export const CONTACT_PRESETS = [
  { id: 'project', title: 'Проект целиком', text: 'Привет, Ярослав! Хочу обсудить проект и пройти весь путь — от задачи и исследования до готового решения. Расскажу, что задумали, какие есть сроки и бюджет.' },
  { id: 'task', title: 'Отдельная задача', text: 'Привет, Ярослав! Нужна помощь с отдельной задачей в проекте. Расскажу, что уже есть, какой результат нужен и к какому сроку.' },
  { id: 'idea', title: 'Обсудить идею', text: 'Привет, Ярослав! Есть идея, которую хочется разобрать и понять, с чего лучше начать. Можем обсудить?' },
  { id: 'hello', title: 'Познакомиться', text: 'Привет, Ярослав! Посмотрел портфолио и хочу познакомиться.' },
];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function telegramDraftURL(text = '') {
  const draft = String(text).trim();
  return `https://t.me/YRLMRSH${draft ? `?text=${encodeURIComponent(draft)}` : ''}`;
}

export function renderAbout(icon) {
  return `<article class="os-profile">
    <header class="os-profile-card">
      <figure class="os-profile-photo"><img src="${PORTRAIT}" width="2048" height="2048" alt="Пиксельный портрет Ярослава в очках" draggable="false" decoding="async"></figure>
      <div class="os-profile-identity"><h2>Ярослав</h2><p class="os-profile-intro">Помогаю бизнесу запускать и развивать продукты. Соединяю маркетинг, креатив и реализацию — от исследования аудитории и стратегии продвижения до контента, дизайна и разработки. Могу взять на себя весь проект или отдельную задачу.</p><button class="os-button os-button-dark" data-go="contact">Обсудить задачу <span aria-hidden="true">↗</span></button></div>
    </header>
    <section class="os-profile-approach"><h3>Сначала — продукт и задача бизнеса</h3><p>Разбираюсь, кому нужен продукт, за что его выбирают и что мешает человеку заинтересоваться, обратиться или купить. Собираю вводные в бриф, изучаю аудиторию, конкурентов и текущие коммуникации.</p><p>На этой основе определяю, что стоит усилить: предложение, позиционирование, подачу или путь пользователя. Формулирую гипотезы, расставляю приоритеты и продумываю, как оценивать результат. Это становится основой для стратегии и конкретных действий.</p></section>
    <div class="os-profile-notes"><section><h3>От стратегии к реализации</h3><p>Разрабатываю концепции, выстраиваю содержание и визуальную подачу, создаю рекламные материалы и реализую цифровые решения. Связываю эти части общей маркетинговой логикой, чтобы продукт был понятен аудитории, а коммуникация вела к нужному действию.</p><p>Уделяю внимание общей логике и деталям: точности формулировок, убедительности подачи, удобству и качеству исполнения. Проверяю решение в разных сценариях и дорабатываю слабые места.</p></section><section><h3>Глубина под задачу</h3><p>Объём проработки соотношу с целью, сроками и бюджетом. Если важен быстрый запуск, выделяю главное и собираю рабочую версию с понятными приоритетами для дальнейших улучшений.</p><p>Когда сроки и бюджет позволяют, глубже исследую контекст, сравниваю концепции и дорабатываю решение в несколько итераций — от маркетинговой логики до деталей исполнения. Приоритеты, объём работы и критерии результата обсуждаем заранее.</p></section></div>
    <footer class="os-profile-links"><button data-go="skills">${icon('skills')}Мои навыки <span aria-hidden="true">→</span></button><button data-go="experiments">${icon('folder')}Посмотреть работы <span aria-hidden="true">→</span></button></footer>
  </article>`;
}

export function renderContact(icon) {
  return `<div class="os-contact-panel">
    <section class="os-contact-view">
      <header class="os-contact-identity">${icon('contact')}<div><h2>@YRLMRSH</h2><p>Ярослав</p></div></header>
      <button class="os-button os-button-dark os-write-author" data-profile-compose>Написать автору <span aria-hidden="true">↗</span></button>
      <div class="os-contact-mail"><span>Почта</span><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><button type="button" data-profile-copy="email" aria-label="Скопировать почту">Копировать</button></div>
      <footer class="os-contact-options"><button data-profile-copy="handle">Скопировать ник</button></footer>
      <p class="os-contact-status" role="status" aria-live="polite"></p>
    </section>
    <section class="os-contact-write" hidden aria-labelledby="os-draft-title">
      <button type="button" class="os-draft-back" data-profile-close>← Контакты</button><h2 id="os-draft-title" tabindex="-1">С чего начнём?</h2>
      <div class="os-contact-presets" role="group" aria-label="Тема сообщения">${CONTACT_PRESETS.map((preset, index) => `<button type="button" data-profile-preset="${preset.id}" aria-pressed="${index === 0}">${esc(preset.title)}</button>`).join('')}</div>
      <label class="os-draft-label" for="os-contact-draft">Сообщение</label><textarea id="os-contact-draft" rows="5" maxlength="1400" spellcheck="true"></textarea>
      <p class="os-draft-hint">Можно дописать детали. В Telegram откроется диалог с этим черновиком.</p>
      <div class="os-draft-actions"><a class="os-button os-button-dark" data-profile-telegram href="${telegramDraftURL(CONTACT_PRESETS[0].text)}" target="_blank" rel="noopener noreferrer">Открыть Telegram <span aria-hidden="true">↗</span></a><a href="https://t.me/YRLMRSH" target="_blank" rel="noopener noreferrer">Без заготовки <span aria-hidden="true">↗</span></a></div>
    </section>
  </div>`;
}

export function mountContact(container) {
  const home = container.querySelector('.os-contact-view'), composer = container.querySelector('.os-contact-write');
  const textarea = container.querySelector('textarea'), telegram = container.querySelector('[data-profile-telegram]');
  let disposed = false, statusTimer = 0;
  textarea.value = CONTACT_PRESETS[0].text;
  function updateDraft() { telegram.href = telegramDraftURL(textarea.value); }
  function open() { home.hidden = true; composer.hidden = false; composer.querySelector('h2').focus({ preventScroll: true }); container.closest('.os-window-content')?.scrollTo({ top: 0 }); }
  function close() { home.hidden = false; composer.hidden = true; home.querySelector('[data-profile-compose]').focus({ preventScroll: true }); container.closest('.os-window-content')?.scrollTo({ top: 0 }); }
  async function copy(kind) {
    const value = kind === 'email' ? CONTACT_EMAIL : '@YRLMRSH';
    const trigger = document.activeElement;
    let copied = false;
    try { await navigator.clipboard.writeText(value); copied = true; } catch {
      if (disposed || !container.isConnected) return;
      const field = document.createElement('textarea'); field.value = value; field.readOnly = true; field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'; container.append(field); field.select();
      try { copied = document.execCommand('copy'); } catch { /* Manual copy remains possible. */ }
      field.remove();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
    if (disposed) return;
    const status = container.querySelector('.os-contact-status');
    status.textContent = copied ? (kind === 'email' ? 'Почта скопирована' : 'Ник скопирован') : `Скопируйте: ${value}`;
    clearTimeout(statusTimer); statusTimer = setTimeout(() => { if (!disposed) status.textContent = ''; }, 2500);
  }
  function click(event) {
    const target = event.target.closest('button'); if (!target) return;
    if (target.hasAttribute('data-profile-compose')) open();
    if (target.hasAttribute('data-profile-close')) close();
    if (target.dataset.profileCopy) void copy(target.dataset.profileCopy);
    if (target.dataset.profilePreset) {
      const preset = CONTACT_PRESETS.find(item => item.id === target.dataset.profilePreset); if (!preset) return;
      textarea.value = preset.text; updateDraft();
      container.querySelectorAll('[data-profile-preset]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    }
  }
  function keydown(event) { if (event.key === 'Escape' && !composer.hidden) { event.preventDefault(); event.stopPropagation(); close(); } }
  container.addEventListener('click', click); container.addEventListener('keydown', keydown); textarea.addEventListener('input', updateDraft);
  return () => { disposed = true; clearTimeout(statusTimer); container.removeEventListener('click', click); container.removeEventListener('keydown', keydown); textarea.removeEventListener('input', updateDraft); };
}
