/**
 * Поисковые запросы hh.ru: текст, зарплата в URL, минус-слова.
 *
 * В URL — только короткий набор (senior / lead / 1С). Исключения developer, python, android и т.д.
 * применяются при harvest через runTitleOnlyFilters по заголовку карточки.
 */

import { applySearchPeriodToParams } from './hh-search-period.mjs';

/** Безопасные минус-слова для поля text= на hh.ru */
const URL_SAFE_EXCLUDE_TOKENS = [
  'senior',
  'сеньор',
  'lead',
  'лид',
  'tech lead',
  'team lead',
  '1с',
  '1c',
];

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseTokenList(raw) {
  return String(raw || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @returns {string[]}
 */
export function searchExcludeTokens() {
  const mode = String(process.env.HH_SEARCH_EXCLUDE_MODE || 'url-safe').toLowerCase();
  const env = process.env.HH_SEARCH_EXCLUDE_TOKENS;

  if (mode === 'off' || mode === '0') return [];
  if (env === '') return [];

  if (mode === 'all') {
    const list = env === undefined || env === null ? [...URL_SAFE_EXCLUDE_TOKENS] : parseTokenList(env);
    return list;
  }

  // url-safe (по умолчанию): длинный список из devops.env не тащим в URL целиком
  if (env === undefined || env === null) return [...URL_SAFE_EXCLUDE_TOKENS];

  const parsed = parseTokenList(env);
  if (parsed.length <= 8) return parsed;

  return [...URL_SAFE_EXCLUDE_TOKENS];
}

/**
 * @param {object} [prefs]
 * @returns {number} 0 = не передавать salary в URL
 */
export function resolveHhSearchSalary(prefs = {}) {
  const raw = process.env.HH_SEARCH_SALARY;
  if (raw === '0' || raw === '') return 0;

  if (raw !== undefined && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
    if (Number.isFinite(n) && n <= 0) return 0;
  }

  const from = String(process.env.HH_SEARCH_SALARY_FROM || 'none').toLowerCase();
  if (from === 'none' || from === 'off') return 0;
  if (from === 'min') return Math.round(Number(prefs.minMonthlyRub) || 0);
  if (from === 'target') return Math.round(Number(prefs.targetMonthlyRub) || 0);
  if (from === 'max') return Math.round(Number(prefs.maxMonthlyRubSearch) || 0);
  return 0;
}

/**
 * @param {string} keyword
 * @returns {string}
 */
export function buildHhSearchText(keyword) {
  const base = String(keyword || '').trim();
  return base;
}

/**
 * @param {string} keyword
 * @param {object} [prefs]
 * @param {number} [periodDays]
 * @returns {string}
 */
export function buildHhSearchUrl(keyword, prefs = {}, periodDays = 0) {
  const params = new URLSearchParams();
  params.set('text', buildHhSearchText(keyword));
  const excludes = searchExcludeTokens()
    .map((t) => String(t || '').replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  if (excludes.length) {
    // Штатный параметр hh: исключённые слова/фразы (надежнее, чем "-слова" внутри text).
    params.set('excluded_text', excludes.join(','));
  }
  params.set('ored_clusters', 'true');
  const area = (process.env.HH_AREA || '').trim();
  if (area) params.set('area', area);
  const salarySearch = resolveHhSearchSalary(prefs);
  if (salarySearch > 0) params.set('salary', String(salarySearch));
  applySearchPeriodToParams(params, periodDays);
  const orderBy = (process.env.HH_SEARCH_ORDER_BY || 'publication_time').trim();
  if (orderBy) params.set('order_by', orderBy);
  return `https://hh.ru/search/vacancy?${params.toString()}`;
}

/**
 * Пояснение для лога harvest (почему URL «узкий»).
 */
export function describeHhSearchUrlPolicy(prefs = {}) {
  const excludes = searchExcludeTokens();
  const salary = resolveHhSearchSalary(prefs);
  const mode = String(process.env.HH_SEARCH_EXCLUDE_MODE || 'url-safe');
  const envLen = parseTokenList(process.env.HH_SEARCH_EXCLUDE_TOKENS).length;
  const notes = [];
  if (mode !== 'all' && envLen > 8) {
    notes.push(
      `минус-слова в URL: ${excludes.length} (полный список ${envLen} — только фильтр заголовка при сборе)`
    );
  } else if (excludes.length) {
    notes.push(`минус-слова в URL: ${excludes.join(', ')}`);
  } else {
    notes.push('минус-слова в URL: нет');
  }
  if (salary > 0) {
    notes.push(`зарплата в URL: от ${salary.toLocaleString('ru-RU')} ₽`);
  } else {
    notes.push('зарплата в URL: не задана (фильтр по preferences при разборе карточек)');
  }
  return notes.join(' · ');
}
