/**
 * Гигиена грязного пула: pending с низким fit → skipped (не удаляем);
 * pending + already_applied → applied (drift sync).
 *   npm run devops:queue-hygiene:emil -- --dry-run
 *   npm run devops:queue-hygiene:emil -- --apply --min-score=50
 */

import { loadQueue, saveQueue } from './store.mjs';

/**
 * @param {object} rec
 */
export function vacancyFitScore(rec) {
  const n = Number(
    rec?.scoreOverall ?? rec?.matchScore?.scoreFit ?? rec?.matchScore?.overall ?? NaN
  );
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} rec
 * @param {{ minScore?: number }} opts
 */
export function vacancyShouldHygieneSkipLowFit(rec, opts = {}) {
  const minScore = Number(opts.minScore);
  const threshold = Number.isFinite(minScore) ? minScore : 50;
  if (String(rec?.status || '') !== 'pending') return false;
  if (rec?.hhApply?.responseSubmitted || rec?.hhApply?.hhSiteState) return false;
  const score = vacancyFitScore(rec);
  if (score == null) return false;
  return score < threshold;
}

/**
 * pending + already_applied/applied_on_hh → нужен status=applied (не skipped).
 * @param {object} rec
 */
export function vacancyShouldHygieneBackfillApplied(rec) {
  if (String(rec?.status || '') !== 'pending') return false;
  const site = String(rec?.hhApply?.hhSiteState || rec?.hhSiteState || '').toLowerCase();
  return site === 'already_applied' || site === 'applied_on_hh';
}

/**
 * @param {{ dryRun?: boolean, minScore?: number, log?: (msg: string) => void }} [opts]
 */
export function hygieneSkipLowFitPending(opts = {}) {
  const log = opts.log || (() => {});
  const dryRun = Boolean(opts.dryRun);
  const minScore = Number(opts.minScore);
  const threshold = Number.isFinite(minScore) ? minScore : 50;
  const q = loadQueue();
  let skipped = 0;
  let backfilled = 0;
  /** @type {Array<{ id: string, company?: string, title?: string, score: number, action: string }>} */
  const samples = [];
  /** @type {string[]} */
  const skipIds = [];
  /** @type {string[]} */
  const driftIds = [];

  const next = q.map((rec) => {
    if (vacancyShouldHygieneBackfillApplied(rec)) {
      backfilled++;
      driftIds.push(String(rec.id));
      if (samples.length < 40) {
        samples.push({
          id: String(rec.id),
          company: rec.company,
          title: rec.title,
          score: vacancyFitScore(rec) ?? 0,
          action: 'backfill-applied',
        });
      }
      if (dryRun) return rec;
      return {
        ...rec,
        status: 'applied',
        queueHygieneAt: new Date().toISOString(),
        queueHygieneAction: 'backfill-applied',
      };
    }
    if (!vacancyShouldHygieneSkipLowFit(rec, { minScore: threshold })) return rec;
    skipped++;
    skipIds.push(String(rec.id));
    const score = vacancyFitScore(rec) ?? 0;
    if (samples.length < 40) {
      samples.push({
        id: String(rec.id),
        company: rec.company,
        title: rec.title,
        score,
        action: 'skip-low-fit',
      });
    }
    if (dryRun) return rec;
    return {
      ...rec,
      status: 'skipped',
      skipReason: `hygiene:low-fit<${threshold}`,
      queueHygieneAt: new Date().toISOString(),
      queueHygieneAction: 'skip-low-fit',
    };
  });

  const changed = skipped + backfilled;
  if (!dryRun && changed > 0) {
    saveQueue(next);
    log(
      `[queue-hygiene] skipped ${skipped} (fit < ${threshold}), backfill-applied ${backfilled}`
    );
  } else if (dryRun) {
    log(
      `[queue-hygiene] dry-run: would skip ${skipped}, backfill-applied ${backfilled} (fit < ${threshold})`
    );
  }

  const pendingLeft = next.filter((r) => r.status === 'pending').length;
  return {
    total: q.length,
    changed,
    skipped,
    backfilled,
    dryRun,
    minScore: threshold,
    pendingLeft,
    samples,
    skipIds,
    driftIds,
  };
}
