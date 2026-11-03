// Only the exact card and television metadata is needed on startup. Full case
// objects stay in their existing files and load when a project is opened.
export const projects = [
  {
    "id": "education",
    "title": "РАНХиГС × OTUS",
    "kind": "Сайт и маркетинговая стратегия",
    "cover": "./assets/cases/education/cover.webp",
    "coverAlt": "РАНХиГС × OTUS и подпись «Лендинг и стратегия продвижения» слева, справа крупные синие кольца и красная диагональная фигура на светлом фоне",
    "cardSummary": "Сайт и продвижение программы: от рабочих задач слушателя до понятного предложения и сценариев обращения.",
    "video": {
      "available": false,
      "chapters": []
    }
  },
  {
    "id": "tracker",
    "title": "MONO TASK",
    "kind": "Личный продукт · приложение",
    "cover": "./assets/cases/tracker/cover.webp",
    "coverAlt": "Крупная надпись MONO TASK слева; справа парящий телефон с приложением под выразительным углом на чистом светлом фоне.",
    "cardSummary": "Короткие списки дел и шкала времени — от личной потребности до приложения на телефоне.",
    "video": {
      "available": true,
      "src": "./assets/cases/tracker/mono-task-film-studio43.mp4",
      "poster": "./assets/cases/tracker/tv-cover-studio43.webp",
      "duration": 82.10833333333333,
      "width": 1920,
      "height": 1080,
      "aspectRatio": "16:9",
      "chapters": []
    }
  },
  {
    "id": "bolo",
    "title": "BOLO",
    "kind": "Рекламная концепция и видео",
    "cover": "./assets/cases/bolo/cover.webp",
    "coverAlt": "Крупная золотистая булочка с начинкой и белая надпись BOLO на синем фоне с оранжевой графикой",
    "cardSummary": "Продукт, движение и айдентика в коротком ролике — от самостоятельной идеи до публикации.",
    "video": {
      "available": true,
      "src": "./assets/cases/bolo/bolo.mp4",
      "poster": "./assets/cases/bolo/video-poster.webp",
      "duration": 15.083333333333334,
      "width": 1080,
      "height": 1920,
      "aspectRatio": "9:16",
      "chapters": []
    }
  },
  {
    "id": "noise",
    "title": "YRLMRSH AUDIO",
    "kind": "Продуктовый эксперимент · звук",
    "cover": "./assets/cases/noise/cover.webp",
    "coverAlt": "Крупная светлая надпись «Библиотека Шумов» слева; справа металлический звуковой пульт на тёмно-синем ночном фоне со звёздами и тёплыми искрами костра",
    "cardSummary": "Библиотека шумов и музыки с готовыми миксами и отдельной настройкой каждого слоя.",
    "video": {
      "available": false,
      "aspectRatio": "16:9",
      "chapters": []
    }
  }
];

const projectLoaders = {
  education: () => import('./case-education.js?v=studio-60-final').then(module => module.educationCase),
  tracker: () => import('./case-tracker.js?v=studio-60-final').then(module => module.trackerCase),
  bolo: () => import('./case-bolo.js?v=studio-60-final').then(module => module.boloCase),
  noise: () => import('./case-noise.js?v=studio-60-final').then(module => module.noiseCase),
};
const loadedProjects = new Map(), pendingProjects = new Map();

export function getProject(id) {
  return loadedProjects.get(id) || projects.find(project => project.id === id) || null;
}

export function getLoadedProject(id) {
  return loadedProjects.get(id) || null;
}

export function loadProject(id) {
  if (loadedProjects.has(id)) return Promise.resolve(loadedProjects.get(id));
  if (!Object.hasOwn(projectLoaders, id)) return Promise.resolve(null);
  if (!pendingProjects.has(id)) {
    const pending = projectLoaders[id]().then(project => {
      loadedProjects.set(id, project);
      return project;
    }).finally(() => { pendingProjects.delete(id); });
    pendingProjects.set(id, pending);
  }
  return pendingProjects.get(id);
}

export const skills = [
  { id: 'offer', title: 'Задача и оффер', description: 'Понять, кому нужен продукт и почему человек должен выбрать его.', tools: ['Оффер', 'Позиционирование', 'Гипотезы'], projectIds: ['education', 'bolo'] },
  { id: 'journey', title: 'Путь клиента', description: 'Связать первое касание, предложение и следующий шаг.', tools: ['CJM', 'Воронка', 'Go-to-Market'], projectIds: ['education'] },
  { id: 'design', title: 'UX/UI и визуальный язык', description: 'Превратить задачу в понятный интерфейс с собственным характером.', tools: ['Figma', 'Прототипирование', 'Визуальная концепция'], projectIds: ['education', 'tracker', 'noise'] },
  { id: 'build', title: 'От прототипа к продукту', description: 'Довести идею до работающего сайта, веб-инструмента или интерактива.', tools: ['Прототипирование', 'Веб-разработка', 'Проверка сценариев'], projectIds: ['education', 'tracker', 'noise'] },
  { id: 'content', title: 'Креатив и контент', description: 'Найти продуктовый акцент, придумать историю и реализовать её в изображении или видео.', tools: ['Концепция', 'Сценарий', 'Визуальное направление'], projectIds: ['bolo'] },
  { id: 'iteration', title: 'Гипотезы и обратная связь', description: 'Определить, что проверять, и доработать решение по результатам.', tools: ['Аналитика', 'Проверка гипотез', 'Итерации'], projectIds: ['education', 'tracker'] },
  { id: 'retention', title: 'Возвращение клиента', description: 'Продумать поводы вернуться и связать коммуникации с опытом продукта.', tools: ['CRM-стратегия', 'Удержание', 'Сценарии коммуникаций'], projectIds: [] },
];
