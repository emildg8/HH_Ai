/**
 * Профили работодателей: конверсия, ghost, отказы.
 */

import { classifyRecordOutcome } from './outcome-classifier.mjs';

/**
 * @param {object[]} records
 */
export function buildEmployerProfiles(records) {
  /** @type {Record<string, { company: string, applied: number, invited: number, declined: number, ghost: number, dialogue: number }>} */
  const map = {};
  for (const rec of records || []) {
    const company = String(rec?.company || '—').trim();
    if (!company || company === '—') continue;
    const key = company.toLowerCase();
    if (!map[key]) {
      map[key] = { company, applied: 0, invited: 0, declined: 0, ghost: 0, dialogue: 0 };
    }
    const p = map[key];
    const applied =
      rec.hhApply?.responseSubmitted ||
      rec.status === 'responded' ||
      ['already_applied', 'invited', 'declined', 'viewed', 'awaiting'].includes(
        String(rec.hhApply?.hhSiteState || '')
      );
    if (!applied) continue;
    p.applied++;
    const o = classifyRecordOutcome(rec);
    if (o.bucket === 'E' || o.bucket === 'F') p.invited++;
    if (o.bucket === 'C') p.declined++;
    if (o.bucket === 'B') p.ghost++;
    if (o.bucket === 'D') p.dialogue++;
  }
  return Object.values(map).map((p) => ({
    ...p,
    score: getEmployerScoreFromStats(p),
  }));
}

/**
 * @param {{ applied: number, invited: number, ghost: number, declined: number, dialogue: number }} stats
 */
export function getEmployerScoreFromStats(stats) {
  const a = stats.applied || 1;
  const inviteRate = (stats.invited / a) * 40;
  const dialogueRate = (stats.dialogue / a) * 30;
  const ghostPenalty = (stats.ghost / a) * 20;
  const declinePenalty = (stats.declined / a) * 10;
  return Math.max(0, Math.min(100, Math.round(inviteRate + dialogueRate - ghostPenalty - declinePenalty)));
}

/**
 * @param {string} company
 * @param {object[]} records
 */
export function getEmployerScore(company, records) {
  const profiles = buildEmployerProfiles(records);
  const key = String(company || '').toLowerCase();
  const p = profiles.find((x) => x.company.toLowerCase() === key);
  return p?.score ?? 50;
}
