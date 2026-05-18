import { loadQueue, updateVacancyRecord } from './store.mjs';
import { appendFeedback } from './feedback-context.mjs';
import {
  DEFAULT_REJECT_RULES,
  findSimilarToReject,
  ruleIdsFromFeedbackReason,
} from './reject-role-patterns.mjs';

export function isAutoRejectSimilarEnabled() {
  const v = process.env.HH_AUTO_REJECT_SIMILAR;
  if (v === undefined || v === null || v === '') return true;
  return !/^(0|false|no|off)$/i.test(String(v).trim());
}

/**
 * Каноническая причина для записи в очереди (из правила, если распознали).
 * @param {string} feedbackReason
 */
export function canonicalRejectReason(feedbackReason) {
  const ids = ruleIdsFromFeedbackReason(feedbackReason);
  if (!ids.length) return String(feedbackReason || '').trim();
  const rule = DEFAULT_REJECT_RULES.find((r) => r.id === ids[0]);
  return rule?.reason || String(feedbackReason || '').trim();
}

/**
 * Отклонить pending-вакансии по правилам, выведенным из комментария.
 * @param {{ feedbackReason: string, excludeRecordId?: string, source?: string }} opts
 * @returns {{ applied: { id: string, title: string, reason: string }[], skippedNoRules: boolean }}
 */
export function rejectSimilarPendingFromReason(opts) {
  const reasonRaw = String(opts.feedbackReason || '').trim();
  const excludeRecordId = opts.excludeRecordId || '';
  const source = opts.source || 'auto-reject-similar';

  if (!reasonRaw) {
    return { applied: [], skippedNoRules: true };
  }

  const ruleIds = ruleIdsFromFeedbackReason(reasonRaw);
  if (!ruleIds.length) {
    return { applied: [], skippedNoRules: true };
  }

  const storeReason = canonicalRejectReason(reasonRaw);
  const queue = loadQueue();
  const matches = findSimilarToReject(queue, { ruleIds }).filter(
    ({ item }) => item.id !== excludeRecordId
  );

  const applied = [];
  for (const { item, rule } of matches) {
    updateVacancyRecord(item.id, {
      status: 'rejected',
      feedbackReason: storeReason || rule.reason,
    });
    appendFeedback({
      at: new Date().toISOString(),
      action: 'reject',
      reason: storeReason || rule.reason,
      vacancyId: item.vacancyId,
      title: item.title,
      recordId: item.id,
      url: item.url,
      source,
      ruleId: rule.id,
      triggeredByReason: reasonRaw,
    });
    applied.push({
      id: item.id,
      title: item.title,
      reason: storeReason || rule.reason,
    });
  }

  return { applied, skippedNoRules: false };
}
