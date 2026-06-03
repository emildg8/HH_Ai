/**
 * Сводные метрики качества: таргетинг, false positives, письма, отклики.
 */

import { loadQueue } from './store.mjs';
import { assessVacancyForApply } from './vacancy-targeting.mjs';
import { summarizeFalsePositives } from './false-positive-analytics.mjs';
import { listBatchCandidates } from './batch-candidates.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { runTargetingGoldenRegression } from './targeting-golden-set.mjs';
import { readBatchRunReport } from './batch-run-report.mjs';

/**
 * @param {object} [prefs]
 */
export function computeQualityBaseline(prefs = {}) {
  const queue = loadQueue();
  const pending = queue.filter((x) => x.status === 'pending' && !x.hidden);
  const approved = queue.filter((x) => x.status === 'approved' && !x.hidden);
  const rejected = queue.filter((x) => x.status === 'rejected' && !x.hidden);
  const responded = queue.filter(
    (x) =>
      x.status === 'responded' ||
      x.hhApply?.hhSiteState === 'invited' ||
      x.hhApply?.hhSiteState === 'already_applied'
  );

  let pendingEligible = 0;
  for (const rec of pending) {
    if (assessVacancyForApply(rec, { userApproved: false, prefs }).eligible) pendingEligible++;
  }
  let approvedEligible = 0;
  for (const rec of approved) {
    if (assessVacancyForApply(rec, { userApproved: true, prefs }).eligible) approvedEligible++;
  }

  const fp = summarizeFalsePositives(rejected, prefs);

  const batchCandidates = listBatchCandidates({
    batchScope: 'noQuestionnaire',
    queueStatus: 'pending',
    minScore: 0,
    maxScore: 0,
    prefs,
  });
  let batchReady = 0;
  let batchLetterFail = 0;
  const batchScan = batchCandidates.slice(0, 400);
  for (const rec of batchScan) {
    const t = assessVacancyForApply(rec, { userApproved: false, prefs });
    if (!t.eligible) continue;
    const letter = String(rec.coverLetter?.approvedText || '').trim();
    if (!letter || rec.coverLetter?.status !== 'approved') {
      batchLetterFail++;
      continue;
    }
    const ev = evaluateLetterQuality(rec, letter, t.resumeRole || classifyVacancyResumeRole(rec), prefs);
    if (ev.pass) batchReady++;
    else batchLetterFail++;
  }

  const invited = responded.filter((x) => x.hhApply?.hhSiteState === 'invited').length;
  const replyRate =
    responded.length > 0 ? Math.round((invited / responded.length) * 100) : null;

  const golden = runTargetingGoldenRegression(prefs);
  const lastBatch = readBatchRunReport();
  const letterSkips = Number(lastBatch?.skipReasons?.['letter-quality'] || 0);

  return {
    ok: true,
    at: new Date().toISOString(),
    queue: {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      responded: responded.length,
    },
    targeting: {
      pendingEligibleRate:
        pending.length > 0 ? Math.round((pendingEligible / pending.length) * 100) : null,
      approvedEligibleRate:
        approved.length > 0 ? Math.round((approvedEligible / approved.length) * 100) : null,
    },
    falsePositives: {
      total: fp.totalFalsePositives,
      rate: fp.falsePositiveRate,
    },
    letters: {
      batchCandidates: batchCandidates.length,
      batchReady,
      batchLetterFail,
      batchReadyRate:
        batchCandidates.length > 0
          ? Math.round((batchReady / batchCandidates.length) * 100)
          : null,
    },
    outcomes: {
      invited,
      responded: responded.length,
      inviteRate: replyRate,
    },
    golden: {
      ok: golden.ok,
      passed: golden.passed,
      total: golden.total,
    },
    lastBatch: lastBatch
      ? {
          done: lastBatch.done,
          skipped: lastBatch.skipped,
          letterQualitySkips: letterSkips,
          finishedAt: lastBatch.finishedAt,
        }
      : null,
  };
}
