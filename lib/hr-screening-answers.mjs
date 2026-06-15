/**
 * Стандартные ответы на типовые вопросы рекрутера.
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

const PATHS = [
  path.join(ROOT, 'config', 'hr-screening-answers.local.json'),
  path.join(ROOT, 'config', 'hr-screening-answers.json'),
  path.join(ROOT, 'config', 'hr-screening-answers.example.json'),
];

const DEFAULTS = {
  startDate: 'Готов выйти через 1–2 недели, гибко по договорённости.',
  salary: 'Ориентир 170–200 тыс. ₽ на руки, готов обсудить вилку с учётом задач.',
  employment: 'Предпочтительно по ТК РФ.',
  remote: 'Удалёнка или гибрид в Москве — комфортно.',
  english: 'Читаю документацию; разговорный — базовый, для рабочих задач хватает.',
  careerBridge:
    'Перехожу из L2/инфраструктуры в DevOps: инциденты, релизы, мониторинг, Docker/OpenShift, автоматизация.',
  onCall: 'Готов к дежурствам по регламенту команды.',
  probation: 'Испытательный срок ок, важны понятные задачи и обратная связь.',
};

let cached = null;

export function loadHrScreeningAnswers() {
  if (cached) return cached;
  for (const p of PATHS) {
    if (fs.existsSync(p)) {
      try {
        cached = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
        return cached;
      } catch {
        /* next */
      }
    }
  }
  cached = { ...DEFAULTS };
  return cached;
}

/** Текст блока для промптов чата и анкет. */
export function hrScreeningAnswersBlock() {
  const a = loadHrScreeningAnswers();
  return [
    `Старт: ${a.startDate}`,
    `Зарплата: ${a.salary}`,
    `Оформление: ${a.employment}`,
    `Формат: ${a.remote}`,
    `English: ${a.english}`,
    `Переход в DevOps: ${a.careerBridge}`,
    `Дежурства: ${a.onCall}`,
    `Испытательный: ${a.probation}`,
  ].join('\n');
}
