/**
 * Сводка: качество утверждённых писем vs исход отклика (приглашение / отклик без invite).
 */

import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';

/**
 * @param {object[]} rows
 */
function summarizeGroup(rows) {
  if (!rows.length) {
    return { count: 0, avgScore: 0, passRate: 0, rawPassRate: 0, avgLength: 0 };
  }
  const n = rows.length;
  const sumScore = rows.reduce((s, r) => s + (r.score || 0), 0);
  const pass = rows.filter((r) => r.pass).length;
  const rawPass = rows.filter((r) => r.rawPass).length;
  const sumLen = rows.reduce((s, r) => s + (r.length || 0), 0);
  return {
    count: n,
    avgScore: Math.round((sumScore / n) * 10) / 10,
    passRate: Math.round((pass / n) * 100),
    rawPassRate: Math.round((rawPass / n) * 100),
    avgLength: Math.round(sumLen / n),
  };
}

/**
 * @param {object} rec
 */
function letterOutcomeBucket(rec) {
  const st = String(rec?.hhApply?.hhSiteState || '').toLowerCase();
  if (st === 'invited') return 'invited';
  if (st === 'declined') return 'declined';
  if (st === 'already_applied' || rec?.status === 'responded') return 'applied';
  return 'other';
}

/**
 * @param {object[]} records
 * @param {object} [prefs]
 */
export function summarizeLetterInviteCorrelation(records, prefs = {}) {
  /** @type {Record<string, object[]>} */
  const buckets = { invited: [], applied: [], declined: [], other: [] };

  for (const rec of records) {
    const letter = String(rec?.coverLetter?.approvedText || '').trim();
    if (!letter || rec.coverLetter?.status !== 'approved') continue;
    const role = classifyVacancyResumeRole(rec);
    const ev = evaluateLetterQuality(rec, letter, role, prefs);
    const bucket = letterOutcomeBucket(rec);
    const row = {
      score: ev.score ?? 0,
      pass: ev.pass,
      rawPass: ev.rawPass,
      length: letter.length,
      role: ev.role,
    };
    (buckets[bucket] || buckets.other).push(row);
  }

  const invited = summarizeGroup(buckets.invited);
  const applied = summarizeGroup(buckets.applied);
  const declined = summarizeGroup(buckets.declined);
  const other = summarizeGroup(buckets.other);
  const withLetter =
    buckets.invited.length +
    buckets.applied.length +
    buckets.declined.length +
    buckets.other.length;

  let insight = '';
  if (invited.count >= 3 && applied.count >= 5) {
    const dScore = invited.avgScore - applied.avgScore;
    const dPass = invited.passRate - applied.passRate;
    if (dScore >= 1 || dPass >= 15) {
      insight =
        `Письма с приглашением в среднем сильнее (score +${dScore.toFixed(1)}, pass +${dPass}%).`;
    } else if (dScore <= -1) {
      insight = 'Приглашения не коррелируют с letter score — смотрите таргетинг и вакансию.';
    }
  }

  return {
    ok: true,
    withLetter,
    invited,
    applied,
    declined,
    other,
    insight,
  };
}
