/**
 * Превью влияния порога авто-откликов на очередь.
 */

import { loadPreferences } from './preferences.mjs';
import { listBatchCandidates } from './batch-candidates.mjs';
import { loadQueue } from './store.mjs';
import { recordPassesRoleFiltersForList } from './filters.mjs';

function scoreOf(rec) {
  return Number(rec.scoreOverall ?? rec.geminiScore ?? 0) || 0;
}

/**
 * @param {number} [threshold]
 * @param {object} [prefs]
 * @param {string} [batchScope]
 */
export function computeApplyThresholdPreview(threshold, prefs, batchScope = 'noQuestionnaire') {
  let p = prefs;
  if (!p) {
    try {
      p = loadPreferences();
    } catch {
      p = {};
    }
  }
  const raw = Number(threshold);
  const min =
    Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : Number(p.dashboardMinScoreFilter) || 50;

  const pending = listBatchCandidates({ prefs: p, batchScope, minScore: 0 });
  let recommended = 0;
  let below = 0;
  for (const rec of pending) {
    if (scoreOf(rec) >= min) recommended += 1;
    else below += 1;
  }

  return {
    threshold: min,
    batchScope,
    totalPending: pending.length,
    recommended,
    belowThreshold: below,
  };
}

/**
 * Сколько pending скрыто правилами роли (S-07b MVP).
 * @param {object} [prefs]
 */
export function computeTargetingRolePreview(prefs) {
  let p = prefs;
  if (!p) {
    try {
      p = loadPreferences();
    } catch {
      p = {};
    }
  }
  const q = loadQueue().filter((x) => x.status === 'pending' || x.status === 'approved');
  let visible = 0;
  let hidden = 0;
  for (const rec of q) {
    if (recordPassesRoleFiltersForList(rec, p)) visible += 1;
    else hidden += 1;
  }
  return { total: q.length, visible, hiddenByRole: hidden };
}
