import { educationCase } from './case-education.js?v=studio-34-final';
import { trackerCase } from './case-tracker.js?v=studio-43-final';
import { boloCase } from './case-bolo.js?v=studio-34-final';
import { noiseCase } from './case-noise.js?v=studio-34-final';

// Four complete portfolio cases, including the sound-library experiment.
export const projects = [
  educationCase,
  trackerCase,
  boloCase,
  noiseCase,
];

export function getProject(id) {
  return projects.find(project => project.id === id) || null;
}

export const skills = [
  { id: 'offer', title: 'Задача и оффер', description: 'Понять, кому нужен продукт и почему человек должен выбрать его.', tools: ['Оффер', 'Позиционирование', 'Гипотезы'], projectIds: ['education', 'bolo'] },
  { id: 'journey', title: 'Путь клиента', description: 'Связать первое касание, предложение и следующий шаг.', tools: ['CJM', 'Воронка', 'Go-to-Market'], projectIds: ['education'] },
  { id: 'design', title: 'UX/UI и визуальный язык', description: 'Превратить задачу в понятный интерфейс с собственным характером.', tools: ['Figma', 'Прототипирование', 'Визуальная концепция'], projectIds: ['education', 'tracker', 'noise'] },
  { id: 'build', title: 'От прототипа к продукту', description: 'Самостоятельно собрать лендинг, веб-инструмент или интерактив.', tools: ['Codex', 'Claude', 'Генеративная разработка'], projectIds: ['education', 'tracker', 'noise'] },
  { id: 'content', title: 'Креатив и AI-контент', description: 'Придумать визуальную историю и собрать изображения или видео под задачу.', tools: ['Seedance', 'Seedream', 'Veo', 'Kling'], projectIds: ['bolo'] },
  { id: 'iteration', title: 'Гипотезы и обратная связь', description: 'Определить, что проверять, и доработать решение по результатам.', tools: ['Аналитика', 'Проверка гипотез', 'Итерации'], projectIds: ['education', 'tracker'] },
  { id: 'retention', title: 'Возвращение клиента', description: 'Продумать поводы вернуться и связать коммуникации с опытом продукта.', tools: ['CRM-стратегия', 'Удержание', 'Сценарии коммуникаций'], projectIds: [] },
];
