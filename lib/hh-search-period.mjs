/**
 * Период публикации в поиске вакансий hh.ru (query search_period).
 * 0 / пусто — «За всё время» (параметр не передаётся).
 * 1, 3, 7, 30 — как в UI hh.ru (сутки, 3 дня, неделя, месяц).
 */

/** @param {unknown} raw */
export function parseHarvestPeriodDays(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'all' || s === '0') return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 7;
  if (n === 0) return 0;
  return Math.min(365, Math.floor(n));
}

/**
 * @param {URLSearchParams} params
 * @param {number} periodDays
 */
export function applySearchPeriodToParams(params, periodDays) {
  if (periodDays > 0) params.set('search_period', String(periodDays));
}

/** @param {number} periodDays */
export function harvestPeriodLabel(periodDays) {
  if (periodDays === 0) return 'за всё время';
  if (periodDays === 1) return 'за сутки';
  if (periodDays === 3) return 'за 3 дня';
  if (periodDays === 7) return 'за неделю';
  if (periodDays === 30) return 'за 30 дней';
  return `${periodDays} дн.`;
}
