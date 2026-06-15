/**
 * HR-скрининг (мок): зарплата, выход, удалёнка, мотивация.
 */

import { hrScreeningAnswersBlock } from './hr-screening-answers.mjs';
import { loadPreferences } from './preferences.mjs';

const HR_QUESTIONS = [
  'Почему смотрите смену работы сейчас?',
  'Какая вилка по зарплате комфортна и от какой суммы готовы обсуждать?',
  'Когда можете выйти? Есть ли отработка?',
  'Удалёнка / гибрид / офис — что подходит?',
  'Готовы к дежурствам и on-call?',
  'Что для вас важно в команде и у руководителя?',
];

/**
 * @param {object} [rec]
 */
export function buildHrScreeningMock(rec = {}) {
  const prefs = loadPreferences();
  const screening = hrScreeningAnswersBlock();
  const salaryHint = prefs.targetMonthlyRub
    ? `Ориентир: от ${prefs.minMonthlyRub || prefs.targetMonthlyRub} ₽, цель ${prefs.targetMonthlyRub} ₽.`
    : '';

  return {
    questions: HR_QUESTIONS,
    suggestedAnswers: screening,
    salaryHint,
    company: rec.company || '',
    title: rec.title || '',
    checklist: [
      'Коротко: опыт L2 → DevOps, банковский прод',
      'ЗП: вилка + готовность к обсуждению',
      'Выход: 1–2 недели',
      'Формат: удалёнка предпочтительна',
      'Спросить про стек, дежурства, испытательный срок',
    ],
  };
}
