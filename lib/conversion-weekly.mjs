/**
 * Конверсия invited/applied по неделям (K-02).
 */

import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { isApplied, recordApplyDate } from './funnel-analytics.mjs';
import { HH_SITE_STATES } from './hh-vacancy-response-state.mjs';

/**
 * @param {number} [weeks]
 * @returns {{ weeks: Array<{ label: string, applied: number, invited: number, invitePct: number }>, trendDelta: number | null, currentInvitePct: number | null }}
 */
export function computeWeeklyInviteTrend(weeks = 2) {
  const nWeeks = Math.max(1, Math.min(8, Math.floor(Number(weeks) || 2)));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  /** @type {Array<{ label: string, applied: number, invited: number, invitePct: number }>} */
  const out = [];
  for (let w = nWeeks - 1; w >= 0; w -= 1) {
    const end = new Date(today);
    end.setDate(end.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    let applied = 0;
    let invited = 0;
    for (const rec of loadAnalyticsUnionRecords().records) {
      if (!isApplied(rec)) continue;
      const iso = recordApplyDate(rec);
      if (!iso || iso.length < 10) continue;
      const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
      if (d < start || d > end) continue;
      applied++;
      if (rec.hhApply?.hhSiteState === HH_SITE_STATES.INVITED) invited++;
    }
    const label = `${start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}–${end.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;
    out.push({
      label,
      applied,
      invited,
      invitePct: applied > 0 ? Math.round((invited / applied) * 1000) / 10 : 0,
    });
  }
  let trendDelta = null;
  if (out.length >= 2) {
    trendDelta =
      Math.round((out[out.length - 1].invitePct - out[out.length - 2].invitePct) * 10) / 10;
  }
  const currentInvitePct = out.length ? out[out.length - 1].invitePct : null;
  return { weeks: out, trendDelta, currentInvitePct };
}
