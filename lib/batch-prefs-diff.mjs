/**
 * Снимок и diff настроек, влияющих на precheck/батч (с прошлой серии).
 */

/** Ключи из config/preferences.json, релевантные для батча. */
export const BATCH_PRECHECK_PREF_KEYS = [
  'dashboardBatchSize',
  'dashboardMinScoreFilter',
  'batchRequireRemote',
  'requireRemote',
  'allowHybrid',
  'allowOfficeMoscow',
  'hybridMoscowOnly',
  'blockSpokenEnglishRequired',
  'blockNightShiftOnly',
  'allowUnknownSalary',
  'excludeSeniorRoles',
  'exclude1CRoles',
  'excludeDeveloperRoles',
  'excludeIrrelevantTitles',
  'minMonthlyRub',
  'targetMonthlyRub',
  'maxMonthlyRubSearch',
  'batchAutoPrepareLetters',
  'batchLetterRequireMetric',
  'batchAutoApproveBestLetter',
  'batchFalsePositiveMax',
  'learningAutoApplyPatterns',
  'learningAutoApplyMinCount',
];

/** @type {Record<string, string>} */
export const BATCH_PREF_LABELS = {
  dashboardBatchSize: 'Лимит серии',
  dashboardMinScoreFilter: 'Мин. score в очереди',
  batchRequireRemote: 'Батч: только удалёнка',
  requireRemote: 'Таргетинг: удалёнка',
  allowHybrid: 'Гибрид',
  allowOfficeMoscow: 'Офис Москва',
  hybridMoscowOnly: 'Гибрид только Москва',
  blockSpokenEnglishRequired: 'Блок spoken English',
  blockNightShiftOnly: 'Блок ночные смены',
  allowUnknownSalary: 'Зарплата не указана',
  excludeSeniorRoles: 'Исключать senior',
  exclude1CRoles: 'Исключать 1С',
  excludeDeveloperRoles: 'Исключать dev-роли',
  excludeIrrelevantTitles: 'Исключать нерелевантные title',
  minMonthlyRub: 'Мин. зарплата (₽)',
  targetMonthlyRub: 'Целевая зарплата (₽)',
  maxMonthlyRubSearch: 'Макс. зарплата поиска (₽)',
  batchAutoPrepareLetters: 'Автоподготовка писем',
  batchLetterRequireMetric: 'Метрика письма обязательна',
  batchAutoApproveBestLetter: 'Авто-утверждение письма',
  batchFalsePositiveMax: 'Порог false positives',
  learningAutoApplyPatterns: 'Обучение: авто-правила',
  learningAutoApplyMinCount: 'Обучение: мин. повторов',
};

const BOOL_DEFAULT_TRUE = new Set([
  'allowHybrid',
  'allowOfficeMoscow',
  'hybridMoscowOnly',
  'blockSpokenEnglishRequired',
  'blockNightShiftOnly',
  'batchAutoPrepareLetters',
  'batchLetterRequireMetric',
  'learningAutoApplyPatterns',
]);

/**
 * @param {Record<string, unknown>} prefs
 * @returns {Record<string, unknown>}
 */
export function pickBatchPrefsSnapshot(prefs) {
  /** @type {Record<string, unknown>} */
  const snap = {};
  for (const key of BATCH_PRECHECK_PREF_KEYS) {
    if (key in prefs) snap[key] = prefs[key];
  }
  return snap;
}

/**
 * @param {unknown} v
 * @param {string} key
 */
export function formatBatchPrefValue(v, key) {
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  if (v === undefined || v === null) {
    if (BOOL_DEFAULT_TRUE.has(key)) return 'да (по умолч.)';
    return '—';
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return String(v);
}

/**
 * @param {Record<string, unknown> | null | undefined} before
 * @param {Record<string, unknown>} after
 * @returns {Array<{ key: string, label: string, before: string, after: string }>}
 */
export function diffBatchPrefsSnapshots(before, after) {
  if (!before || typeof before !== 'object') return [];
  const rows = [];
  for (const key of BATCH_PRECHECK_PREF_KEYS) {
    const a = key in after ? after[key] : undefined;
    const b = key in before ? before[key] : undefined;
    const norm = (x) => (x === undefined ? '__undef__' : JSON.stringify(x));
    if (norm(a) === norm(b)) continue;
    rows.push({
      key,
      label: BATCH_PREF_LABELS[key] || key,
      before: formatBatchPrefValue(b, key),
      after: formatBatchPrefValue(a, key),
    });
  }
  return rows;
}
