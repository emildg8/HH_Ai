/**
 * Русские подписи пресетов и источников суфлёра (сервер + тесты).
 */

export const PROMPT_PRESET_LABELS = {
  thesis: 'Кратко',
  star: 'СТАР',
  key5: '5 тезисов',
  full: 'Полный',
  script: 'Сценарий',
  live: 'Живой',
};

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
