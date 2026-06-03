/**
 * Клиентские хелперы rejectSource (синхронизировать AUTO_RECORD_SOURCES с lib/reject-source.mjs).
 */

const AUTO_RECORD_SOURCES = new Set([
  'auto-similar',
  'cli',
  'auto-reject-similar',
  'dashboard-reject',
  'reject-similar-cli',
]);

/** @param {object | null | undefined} rec */
export function isAutoRejectRecord(rec) {
  const src = String(rec?.rejectSource || '').trim();
  return AUTO_RECORD_SOURCES.has(src);
}

/** @param {object | null | undefined} rec */
export function autoRejectChipLabel(rec) {
  const rule = String(rec?.rejectRuleId || '').trim();
  return rule ? `авто · ${rule}` : 'авто';
}

/** @param {object | null | undefined} rec */
export function autoRejectDoneReasonPrefix(rec) {
  if (!isAutoRejectRecord(rec)) return '';
  const rule = String(rec?.rejectRuleId || '').trim();
  return rule ? `Авто · ${rule}. ` : 'Авто. ';
}

export function rejectedSourceFilterActive(status, applyView, filter) {
  return status === 'rejected' && applyView === 'queue' && filter && filter !== 'all';
}
