/**
 * Фактическая роль резюме для аналитики (план vs выбор в форме hh.ru).
 */

import { classifyVacancyResumeRole, loadResumeRoutingConfig } from './resume-routing.mjs';

/**
 * @param {object} rec
 * @returns {string}
 */
export function recordResumeRoleForAnalytics(rec) {
  const h = rec?.hhApply;
  const explicit = String(h?.resumeRole || h?.resumeRolePlanned || '').trim();
  if (explicit) return explicit;

  const selected = String(h?.resumeTitleSelected || '').toLowerCase();
  if (selected) {
    const cfg = loadResumeRoutingConfig();
    for (const [role, entry] of Object.entries(cfg.resumes || {})) {
      const title = String(entry?.title || '').toLowerCase();
      if (title && selected.includes(title)) return role;
      if (role === 'devops' && /\bdevops\b/i.test(selected)) return role;
      if (role === 'data' && /data engineer/i.test(selected)) return role;
      if (role === 'support' && /поддержк/i.test(selected)) return role;
    }
  }

  return classifyVacancyResumeRole(rec);
}

/**
 * @param {object} rec
 * @returns {number|null} days since apply
 */
export function daysSinceApply(rec) {
  const raw = rec?.hhApply?.lastAt || rec?.queuePrunedAt || rec?.createdAt;
  const t = Date.parse(String(raw || ''));
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Отклик без ответа работодателя дольше порога (HR follow-up).
 * @param {object} rec
 * @param {number} [thresholdDays=7]
 */
export function isStaleFollowUp(rec, thresholdDays = 7) {
  const st = rec?.hhApply?.hhSiteState;
  if (st === 'invited' || st === 'declined' || st === 'viewed') return false;
  if (!rec?.hhApply?.responseSubmitted && st !== 'already_applied') return false;
  const days = daysSinceApply(rec);
  return days != null && days >= thresholdDays;
}
