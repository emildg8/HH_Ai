/**
 * Сводка конверсии откликов: все файлы очереди + кэш переговоров hh.ru.
 */

import { HH_SITE_STATES } from './hh-vacancy-response-state.mjs';
import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';

/**
 * @returns {{
 *   total: number,
 *   applied: number,
 *   invited: number,
 *   declined: number,
 *   viewed: number,
 *   awaiting: number,
 *   pending: number,
 *   unionVacancyIds: number,
 *   dataSources: { file: string, count: number }[],
 *   rates: { invitePct: number, declinePct: number, viewPct: number },
 * }}
 */
export function computeConversionStats() {
  const union = loadAnalyticsUnionRecords();
  const q = union.records;
  const stats = {
    total: q.length,
    applied: 0,
    invited: 0,
    declined: 0,
    viewed: 0,
    awaiting: 0,
    pending: 0,
    unionVacancyIds: union.uniqueVacancyIds,
    dataSources: union.sources,
  };

  for (const rec of q) {
    const st = rec.hhApply?.hhSiteState;
    const submitted = rec.hhApply?.responseSubmitted || rec.status === 'responded';
    if (submitted || st === HH_SITE_STATES.ALREADY_APPLIED) stats.applied++;
    if (st === HH_SITE_STATES.INVITED) stats.invited++;
    else if (st === HH_SITE_STATES.DECLINED) stats.declined++;
    else if (st === 'viewed') stats.viewed++;
    else if (st === 'awaiting') stats.awaiting++;
    else if (rec.status === 'pending' && !submitted) stats.pending++;
  }

  const base = stats.applied || 1;
  return {
    ...stats,
    rates: {
      invitePct: Math.round((stats.invited / base) * 1000) / 10,
      declinePct: Math.round((stats.declined / base) * 1000) / 10,
      viewPct: Math.round((stats.viewed / base) * 1000) / 10,
    },
  };
}
