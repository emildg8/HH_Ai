/**
 * Русские подписи UI (без англицизмов tier/ingest в лице пользователя).
 */

/** Короткая метка оценки вакансии */
export const TIER_SHORT = { A: 'топ', B: 'хор.', C: 'слаб.', D: 'г' };

/** Подпись оценки для фильтров и крошек */
export const TIER_CLASS_LABEL = {
  all: 'Все оценки',
  A: 'Топ',
  B: 'Хорошие',
  C: 'Слабые',
  D: 'Очень слабые',
};

/** @param {string} tier */
export function tierShortLabel(tier) {
  const t = String(tier || '').toUpperCase();
  return TIER_SHORT[t] || t;
}

/** @param {string} tier */
export function tierClassLabel(tier) {
  const t = String(tier || '').toUpperCase();
  return TIER_CLASS_LABEL[t] || (t ? `Оценка ${t}` : '');
}

/** Подписи источников для UI */
export const SOURCE_UI_LABELS = {
  hh: 'hh.ru',
  habr: 'Хабр',
  telegram: 'Telegram',
  ats: 'Сайт компании',
  jobboard: 'Доска вакансий',
};
