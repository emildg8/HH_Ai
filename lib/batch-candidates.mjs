/**
 * Подсчёт кандидатов для серии откликов (дашборд + API).
 */

import { loadQueue } from './store.mjs';
import { loadPreferences } from './preferences.mjs';
import { filterForBatchScope, normalizeBatchScope } from './batch-scope.mjs';

function scoreOf(rec) {
  return Number(rec.scoreOverall ?? rec.geminiScore ?? 0) || 0;
}

/**
 * @param {{
 *   batchScope?: string,
 *   queueStatus?: string,
 *   minScore?: number,
 *   maxScore?: number,
 *   prefs?: object,
 *   excludeProcessedIds?: string[],
 * }} [opts]
 */
export function listBatchCandidates(opts = {}) {
  const batchScope = normalizeBatchScope(opts.batchScope || 'noQuestionnaire');
  const queueStatus = opts.queueStatus === 'approved' ? 'approved' : 'pending';
  let prefs = opts.prefs;
  if (!prefs) {
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
  }
  const exclude = new Set(opts.excludeProcessedIds || []);

  const rawQueue = opts.queue ?? loadQueue();
  let items = filterForBatchScope(
    rawQueue
      .filter((x) => x.status === queueStatus)
      .filter((x) => x.url)
      .filter((x) => !exclude.has(x.id)),
    batchScope,
    prefs
  );

  const minScore = Number(opts.minScore) || 0;
  const maxScore = Number(opts.maxScore) || 0;
  if (minScore > 0) items = items.filter((x) => scoreOf(x) >= minScore);
  if (maxScore > 0) items = items.filter((x) => scoreOf(x) <= maxScore);
  return items;
}

/** @param {Parameters<typeof listBatchCandidates>[0]} [opts] */
export function countBatchCandidates(opts = {}) {
  return listBatchCandidates(opts).length;
}
