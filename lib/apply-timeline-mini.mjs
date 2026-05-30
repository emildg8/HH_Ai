/**
 * Компактная лента откликов за последние N дней (для sidebar sparkline).
 */

import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { isApplied, recordApplyDate } from './funnel-analytics.mjs';

/**
 * @param {number} [days]
 * @returns {Array<{ date: string, applied: number, label: string, isToday: boolean }>}
 */
export function computeApplyTimelineLastDays(days = 7) {
  const n = Math.max(1, Math.min(31, Math.floor(Number(days) || 7)));
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  /** @type {Map<string, number>} */
  const byDay = new Map();
  for (const rec of loadAnalyticsUnionRecords().records) {
    if (!isApplied(rec)) continue;
    const iso = recordApplyDate(rec);
    if (!iso || iso.length < 10) continue;
    const day = iso.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }

  /** @type {Array<{ date: string, applied: number, label: string, isToday: boolean }>} */
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit' }).replace('.', '');
    out.push({
      date,
      applied: byDay.get(date) || 0,
      label,
      isToday: i === 0,
    });
  }
  return out;
}
