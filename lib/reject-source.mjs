/** @typedef {'manual' | 'auto-similar' | 'cli'} RejectSourceKind */

export const REJECT_SOURCE = {
  manual: 'manual',
  autoSimilar: 'auto-similar',
  cli: 'cli',
};

/** Источники в feedback.jsonl и legacy, считающиеся авто-отклонением. */
const AUTO_FEEDBACK_SOURCES = new Set([
  'auto-reject-similar',
  'dashboard-reject',
]);

const AUTO_RECORD_SOURCES = new Set([
  REJECT_SOURCE.autoSimilar,
  REJECT_SOURCE.cli,
  'auto-reject-similar',
  'dashboard-reject',
  'reject-similar-cli',
]);

/**
 * @param {string} [feedbackSource]
 * @returns {RejectSourceKind}
 */
export function rejectSourceFromFeedbackSource(feedbackSource) {
  const s = String(feedbackSource || '').trim();
  if (s === 'reject-similar-cli') return REJECT_SOURCE.cli;
  if (AUTO_FEEDBACK_SOURCES.has(s)) return REJECT_SOURCE.autoSimilar;
  return REJECT_SOURCE.manual;
}

/**
 * @param {object | null | undefined} rec
 */
export function isAutoRejectRecord(rec) {
  const src = String(rec?.rejectSource || '').trim();
  return AUTO_RECORD_SOURCES.has(src);
}

/**
 * @param {object | null | undefined} rec
 */
export function isManualRejectRecord(rec) {
  if (rec?.status !== 'rejected') return false;
  const src = String(rec?.rejectSource || '').trim();
  if (!src) return true;
  return src === REJECT_SOURCE.manual;
}

/**
 * @param {object | null | undefined} rec
 * @param {'all' | 'auto' | 'manual'} filter
 */
export function passesRejectSourceFilter(rec, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'auto') return isAutoRejectRecord(rec);
  if (filter === 'manual') return isManualRejectRecord(rec);
  return true;
}

/**
 * @param {string} [source]
 * @returns {RejectSourceKind}
 */
export function normalizeAutoRejectSource(source) {
  const s = String(source || '').trim();
  if (s === 'reject-similar-cli') return REJECT_SOURCE.cli;
  return REJECT_SOURCE.autoSimilar;
}

/**
 * @param {string} [ruleId]
 * @param {string} [source]
 */
export function rejectSourcePatchForAuto(ruleId, source) {
  return {
    rejectSource: normalizeAutoRejectSource(source),
    rejectRuleId: ruleId || null,
    rejectedAt: new Date().toISOString(),
  };
}

/**
 * @param {string | null | undefined} [ruleId]
 */
export function rejectSourcePatchForManual(ruleId) {
  return {
    rejectSource: REJECT_SOURCE.manual,
    rejectRuleId: ruleId || null,
    rejectedAt: new Date().toISOString(),
  };
}

export function clearRejectSourcePatch() {
  return {
    rejectSource: null,
    rejectRuleId: null,
    rejectedAt: null,
  };
}
