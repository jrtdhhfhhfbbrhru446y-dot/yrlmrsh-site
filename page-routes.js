// Public page addresses and metadata. This catalog deliberately has no DOM or
// full-case imports, so linking to a page does not preload its article or media.
export const SITE_ORIGIN = 'https://yrlmrsh.ru';

export const HOME_PAGE = Object.freeze({
  path: '/', route: 'home', kind: 'home', heading: 'YRLMRSH',
  title: 'YRLMRSH — портфолио: продукт, маркетинг и креатив',
  description: 'Портфолио Ярослава: маркетинговая стратегия, UX/UI, сайты и рекламные концепции. Кейсы РАНХиГС × OTUS, MONO TASK, BOLO и YRLMRSH AUDIO.',
  image: '/assets/social/yrlmrsh-social-cover-studio53.jpg',
  imageAlt: 'YRLMRSH — компьютер, радио и телевизор в белой студии',
  imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg',
});

const projects = [
  {
    id: 'education', slug: 'education', heading: 'РАНХиГС × OTUS',
    title: 'РАНХиГС × OTUS — сайт и маркетинговая стратегия | YRLMRSH',
    description: 'Кейс Ярослава: предложение, структура, тексты, дизайн сайта и подготовка продвижения образовательной программы РАНХиГС × OTUS.',
    articleHeading: 'РАНХиГС × OTUS. Связать предложение, сайт и продвижение',
    articleDescription: 'Подробный разбор работы над образовательной программой: аудитория, предложение, структура сайта, редизайн и план продвижения. Решения и границы результата.',
    image: '/assets/cases/education/cover.webp',
    imageAlt: 'РАНХиГС × OTUS — лендинг и стратегия продвижения',
  },
  {
    id: 'tracker', slug: 'mono-task', heading: 'MONO TASK',
    title: 'MONO TASK — мобильный задачник и шкала дня | YRLMRSH',
    description: 'MONO TASK — личный продукт Ярослава: короткие списки дел, наглядная шкала дня и мобильные сценарии. От потребности до рабочего веб-приложения.',
    articleHeading: 'MONO TASK. От личной потребности к приложению на каждый день',
    articleDescription: 'Как личная потребность превратилась в мобильный задачник: модель продукта, визуальный язык, сценарии, локальное сохранение и проверка на телефоне.',
    image: '/assets/cases/tracker/cover.webp',
    imageAlt: 'MONO TASK — мобильный задачник на экране телефона',
  },
  {
    id: 'bolo', slug: 'bolo', heading: 'BOLO',
    title: 'BOLO — рекламная концепция и короткий ролик | YRLMRSH',
    description: 'Самостоятельный рекламный проект Ярослава для BOLO: продуктовый акцент, сценарий, фирменный стиль и пятнадцатисекундное вертикальное видео.',
    articleHeading: 'BOLO. Превратить продукт и айдентику в рекламную историю',
    articleDescription: 'Разбор короткого рекламного ролика BOLO: продукт и айдентика, сценарий движения, генеративное видео, публикация и границы подтверждённого результата.',
    image: '/assets/cases/bolo/cover.webp',
    imageAlt: 'BOLO — рекламная концепция вокруг продукта и айдентики',
  },
  {
    id: 'noise', slug: 'audio', heading: 'YRLMRSH AUDIO',
    title: 'YRLMRSH AUDIO — библиотека шумов и звуковых сцен | YRLMRSH',
    description: 'Продуктовый эксперимент Ярослава: браузерная библиотека шумов и музыки, готовые миксы и управление звуковыми слоями. Работающий прототип для личного использования.',
    articleHeading: 'YRLMRSH AUDIO. Быстрый эксперимент с полезным результатом',
    articleDescription: 'Как собрать полезный звуковой веб-инструмент: готовые сцены, библиотека слоёв, независимое управление и осознанные приоритеты функционального прототипа.',
    image: '/assets/cases/noise/cover.webp',
    imageAlt: 'YRLMRSH AUDIO — библиотека шумов и настройка звуковых слоёв',
  },
];

export const PAGE_ROUTES = Object.freeze(projects.flatMap(project => [
  Object.freeze({
    path: `/projects/${project.slug}/`, route: `case:${project.id}`,
    projectId: project.id, kind: 'project', heading: project.heading,
    title: project.title, description: project.description,
    image: project.image, imageAlt: project.imageAlt, imageWidth: 1560, imageHeight: 800, imageType: 'image/webp',
  }),
  Object.freeze({
    path: `/articles/${project.slug}/`, route: `article:${project.id}`,
    projectId: project.id, kind: 'article', heading: project.articleHeading,
    title: `${project.articleHeading} | YRLMRSH`, description: project.articleDescription,
    image: project.image, imageAlt: project.imageAlt, imageWidth: 1560, imageHeight: 800, imageType: 'image/webp',
  }),
]));

const byPath = new Map(PAGE_ROUTES.map(page => [page.path, page]));
const byRoute = new Map(PAGE_ROUTES.map(page => [page.route, page]));

export function getPageRoute(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) return null;
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  return byPath.get(path) || null;
}

export function getPageRouteForView(view) {
  if (typeof view !== 'string') return null;
  const [kind, id, tab, extra] = view.split(':');
  if (extra || (kind === 'article' && tab) || (tab && !['overview', 'process', 'materials'].includes(tab))) return null;
  return byRoute.get(`${kind}:${id}`) || null;
}

export const pageForPath = getPageRoute;
export const pageForView = getPageRouteForView;
export const viewForPath = pathname => getPageRoute(pathname)?.route || null;
export const projectPath = id => byRoute.get(`case:${id}`)?.path || null;
export const articlePath = id => byRoute.get(`article:${id}`)?.path || null;
