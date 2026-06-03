/**
 * Список карточек с проблемами сопроводительных.
 */

import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { letterIssueSortKey } from './letter-score.mjs';

/**
 * @param {object} rec
 * @param {object} prefs
 * @returns {'missing'|'fail'|'fixable'|'ok'|null}
 */
export function classifyLetterIssueKind(rec, prefs = {}) {
  const approved = String(rec?.coverLetter?.approvedText || '').trim();
  const status = rec?.coverLetter?.status;
  if (!approved || status !== 'approved') {
    const hasDraft = (rec?.coverLetter?.variants || []).filter(Boolean).length > 0;
    if (!hasDraft) return 'missing';
    return 'missing';
  }
  const role = classifyVacancyResumeRole(rec);
  const ev = evaluateLetterQuality(rec, approved, role, prefs);
  if (!ev.pass) return 'fail';
  if (ev.fixable) return 'fixable';
  return 'ok';
}

/**
 * @param {object[]} records
 * @param {object} [prefs]
 * @param {{ kind?: string, limit?: number }} [opts]
 */
export function listLetterIssues(records, prefs = {}, opts = {}) {
  const kindFilter = String(opts.kind || 'issues').toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(opts.limit) || 80));
  /** @type {Array<{ id: string, title: string, kind: string, reason: string, score: number, letterScore10: number|null }>} */
  const out = [];

  for (const rec of records) {
    const kind = classifyLetterIssueKind(rec, prefs);
    if (!kind) continue;
    if (kindFilter === 'issues' && kind === 'ok') continue;
    if (kindFilter !== 'issues' && kindFilter !== 'all' && kind !== kindFilter) continue;

    const role = classifyVacancyResumeRole(rec);
    const letter = String(rec?.coverLetter?.approvedText || '').trim();
    const ev = letter
      ? evaluateLetterQuality(rec, letter, role, prefs)
      : { pass: false, reason: 'письмо не утверждено', score: 0, letterScore10: null };

    out.push({
      id: rec.id,
      title: String(rec.title || rec.id || '').slice(0, 100),
      kind,
      reason: kind === 'ok' ? '' : ev.reason || kind,
      score: ev.score ?? 0,
      letterScore10: ev.letterScore10 ?? null,
      hint: Array.isArray(ev.hints) && ev.hints[0] ? String(ev.hints[0]) : '',
    });
  }

  out.sort((a, b) => letterIssueSortKey(a) - letterIssueSortKey(b));
  const items = out.slice(0, limit);

  const counts = { missing: 0, fail: 0, fixable: 0, ok: 0 };
  for (const rec of records) {
    const k = classifyLetterIssueKind(rec, prefs);
    if (k && counts[k] !== undefined) counts[k]++;
  }

  return { items, counts };
}
