/**
 * Целевость вакансии для автоматического отклика + план резюме.
 */

import { titleLooksTargetRole, titleLooksNonItRole } from './role-classify.mjs';
import { classifyVacancyResumeRole, resolveResumeForVacancy } from './resume-routing.mjs';

/**
 * @param {object} rec
 * @returns {{ eligible: boolean, skipReason?: string, category?: string, resumeRole?: string, resumePick?: ReturnType<typeof resolveResumeForVacancy> }}
 */
export function assessVacancyForApply(rec) {
  const title = String(rec?.title || '').trim();
  const resumePick = resolveResumeForVacancy(rec);
  const resumeRole = resumePick.role;

  if (titleLooksNonItRole(title)) {
    return {
      eligible: false,
      skipReason: `нецелевая вакансия: «${title.slice(0, 48)}»`,
      category: 'off-target',
      resumeRole,
      resumePick,
    };
  }

  if (title && !titleLooksTargetRole(title)) {
    const blob = [
      rec?.descriptionPreview,
      rec?.geminiSummary,
      ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const itHints =
      /\bdevops\b|\bsre\b|\bmlops\b|kubernetes|docker|linux|мониторинг|grafana|ansible|terraform|helpdesk|service desk|l2|l3|data engineer|platform engineer|облак|cloud/i.test(
        `${title} ${blob}`
      );
    if (!itHints) {
      return {
        eligible: false,
        skipReason: `нет IT-профиля в названии: «${title.slice(0, 48)}»`,
        category: 'off-target',
        resumeRole,
        resumePick,
      };
    }
  }

  return { eligible: true, resumeRole, resumePick };
}

/** @param {string} formTitle @param {ReturnType<typeof resolveResumeForVacancy>} planned */
export function resumeSelectionMatches(formTitle, planned) {
  const t = String(formTitle || '').toLowerCase();
  const want = String(planned?.title || '').toLowerCase();
  if (!t || !want) return null;
  if (t.includes(want) || want.includes(t.split('.')[0]?.trim())) return true;
  if (planned.role === 'devops' && /\bdevops\b/i.test(t)) return true;
  if (planned.role === 'data' && /data engineer/i.test(t)) return true;
  if (planned.role === 'support' && /поддержк/i.test(t)) return true;
  return false;
}
