import { loadQueue, updateVacancyRecord } from './store.mjs';
import { appendFeedback } from './feedback-context.mjs';
import { rejectSourcePatchForAuto } from './reject-source.mjs';
import {
  DEFAULT_REJECT_RULES,
  findSimilarToReject,
  inferRejectReasonFromRecord,
  matchRejectRule,
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
      ...rejectSourcePatchForAuto(rule.id, source),
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

/**
 * Отклонить pending по набору rule id (после ручного reject или CLI).
 * @param {{ ruleIds: string[], feedbackReason?: string, excludeRecordId?: string, source?: string }} opts
 */
export function rejectSimilarPendingFromRuleIds(opts) {
  const ruleIds = [...new Set((opts.ruleIds || []).filter(Boolean))];
  const excludeRecordId = opts.excludeRecordId || '';
  const source = opts.source || 'auto-reject-similar';

  if (!ruleIds.length) {
    return { applied: [], skippedNoRules: true, storeReason: '' };
  }

  const storeReason =
    String(opts.feedbackReason || '').trim() ||
    canonicalRejectReason(opts.feedbackReason || '') ||
    DEFAULT_REJECT_RULES.find((r) => r.id === ruleIds[0])?.reason ||
    '';

  const queue = loadQueue();
  const matches = findSimilarToReject(queue, { ruleIds }).filter(
    ({ item }) => item.id !== excludeRecordId
  );

  const applied = [];
  for (const { item, rule } of matches) {
    updateVacancyRecord(item.id, {
      status: 'rejected',
      feedbackReason: storeReason || rule.reason,
      ...rejectSourcePatchForAuto(rule.id, source),
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
      triggeredByReason: storeReason || rule.reason,
    });
    applied.push({
      id: item.id,
      title: item.title,
      reason: storeReason || rule.reason,
    });
  }

  return { applied, skippedNoRules: false, storeReason };
}

/**
 * После ручного «Не подходит»: правила из комментария и/или заголовка карточки.
 * @param {object} rec — отклонённая запись (уже со status rejected)
 * @param {{ feedbackReason?: string, excludeRecordId?: string, source?: string }} opts
 */
export function rejectSimilarAfterRecordReject(rec, opts = {}) {
  if (!isAutoRejectSimilarEnabled()) {
    return { applied: [], skippedNoRules: true, storeReason: inferRejectReasonFromRecord(rec) };
  }

  const reasonRaw = String(opts.feedbackReason ?? rec.feedbackReason ?? '').trim();
  const ruleIds = new Set(ruleIdsFromFeedbackReason(reasonRaw));
  const titleHit = matchRejectRule(rec, DEFAULT_REJECT_RULES);
  if (titleHit) ruleIds.add(titleHit.rule.id);

  const storeReason = reasonRaw || titleHit?.rule?.reason || '';
  if (!ruleIds.size) {
    return { applied: [], skippedNoRules: true, storeReason };
  }

  return rejectSimilarPendingFromRuleIds({
    ruleIds: [...ruleIds],
    feedbackReason: storeReason,
    excludeRecordId: opts.excludeRecordId || rec.id,
    source: opts.source || 'dashboard-reject',
  });
}
