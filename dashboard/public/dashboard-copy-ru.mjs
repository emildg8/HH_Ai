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

/** Стадии воронки откликов (корзины A–F) */
export const OUTCOME_BUCKET_LABELS = {
  A: 'Закрыли вакансию',
  B: 'Тишина',
  C: 'Шаблонный отказ',
  D: 'Диалог',
  E: 'Собеседование',
  F: 'Оффер',
};

/** Короткая подпись для плиток воронки */
export const OUTCOME_BUCKET_SHORT = {
  A: 'Закрыли',
  B: 'Тишина',
  C: 'Отказ',
  D: 'Диалог',
  E: 'Собес',
  F: 'Оффер',
};

/** @param {string} bucket */
export function outcomeBucketLabel(bucket, { short = false } = {}) {
  const b = String(bucket || '').toUpperCase();
  const map = short ? OUTCOME_BUCKET_SHORT : OUTCOME_BUCKET_LABELS;
  return map[b] || b;
}

/** Подписи источников для UI */
export const SOURCE_UI_LABELS = {
  hh: 'hh.ru',
  habr: 'Хабр',
  telegram: 'Telegram',
  ats: 'Сайт компании',
  jobboard: 'Доска вакансий',
};

/** Пресеты суфлёра */
export const PROMPT_PRESET_LABELS = {
  thesis: 'Кратко',
  star: 'СТАР',
  key5: '5 тезисов',
  full: 'Полный',
  script: 'Сценарий',
  live: 'Живой',
};

/** Источник текста суфлёра */
export const PROMPT_SOURCE_LABELS = {
  prep: 'План собеса',
  'mock-tech': 'Тех. вопросы',
  'mock-hr': 'HR-скрининг',
  manual: 'Вручную',
  loading: 'Загрузка',
  live: 'Живой режим',
  replay: 'Репетиция',
};

/** @param {string} preset */
export function promptPresetLabel(preset) {
  const p = String(preset || '').toLowerCase();
  return PROMPT_PRESET_LABELS[p] || p;
}

/** @param {string} source */
export function promptSourceLabel(source) {
  const s = String(source || '');
  return PROMPT_SOURCE_LABELS[s] || s;
}

/** Вкладки панели copilot */
export const COPILOT_TAB_LABELS = {
  prep: 'К собесу',
  live: 'Во время',
  replay: 'Репетиция',
  post: 'После',
};

/** Мастер готовности */
export const COPILOT_WIZARD_STEPS = {
  context: 'Контекст слота',
  audio: 'Звук с созвона',
  overlay: 'Проверка overlay',
  start: 'Старт',
};

/** Статусы live */
export const COPILOT_LIVE_STATUS = {
  idle: 'Готов к собесу',
  listening: 'Слушаю…',
  tier1: 'Быстрый ответ',
  tier2: 'Уточняю ответ…',
  error: 'Ошибка сессии',
};

/** Человекочитаемые флаги offer-guard */
export const COPILOT_GUARD_LABELS = {
  empty: 'Пустой ответ',
  red_flag_tone: 'Тон слишком резкий — смягчили',
  star_weak: 'Добавьте пример (СТАР)',
  spoken_years_mismatch: 'Сверьте годы опыта с тем, что уже сказали',
  spoken_cv_mismatch: 'Цифра не совпадает с резюме и вашим ответом',
};

/** @param {string} flag */
export function copilotGuardLabel(flag) {
  const s = String(flag || '');
  if (COPILOT_GUARD_LABELS[s]) return COPILOT_GUARD_LABELS[s];
  if (s.startsWith('years_mismatch:')) return `Годы опыта: сверьте с резюме (${s.split(':')[1] || '?'})`;
  return s;
}

/** Этапы собеса */
export const COPILOT_STAGE_LABELS = {
  screening: 'Скрининг',
  hr: 'HR / behavioral',
  tech: 'Технический',
  negotiation: 'Переговоры',
  final: 'Финал',
};

/** Совместимость платформ */
export const COPILOT_COMPAT_ROWS = [
  { id: 'zoom', name: 'Zoom (desktop)', loopback: 'да', dock: 'да', stealth: 'проверьте шаринг' },
  { id: 'telemost', name: 'Телемост (web)', loopback: 'частично', dock: 'да', stealth: 'проверьте шаринг' },
  { id: 'teams', name: 'Teams', loopback: 'частично', dock: 'частично', stealth: 'проверьте шаринг' },
];
