import {
  vacancyHasHhApply,
  vacancyQuestionnairePending,
  vacancyHhSiteBlocked,
} from './vacancy-hh-apply.mjs';
import { QUEUE_STATUS_RESPONDED } from './queue-prune.mjs';

function isActiveQueueStatus(rec) {
  return String(rec?.status || '') !== QUEUE_STATUS_RESPONDED;
}
import { recordNeedsQuestionnaireWork } from './questionnaire-labels.mjs';
import { isVacancyDeferred } from './vacancy-defer.mjs';
import {
  recordPassesNot1C,
  recordPassesNotSenior,
  recordPassesNotDeveloper,
  recordPassesNotFieldRole,
  recordPassesRoleFiltersForList,
  recordIsHiddenByRoleFilters,
} from './filters.mjs';

export const BATCH_SCOPES = ['queue', 'noQuestionnaire', 'questionnaire', 'hidden'];

/** @param {string} [raw] */
export function normalizeBatchScope(raw) {
  const s = String(raw || 'noQuestionnaire').trim();
  if (s === 'no-questionnaire' || s.toLowerCase() === 'noquestionnaire') return 'noQuestionnaire';
  if (BATCH_SCOPES.includes(s)) return s;
  return 'noQuestionnaire';
}

/** @param {string} [applyView] */
export function applyViewToBatchScope(applyView) {
  if (applyView === 'hidden') return 'hidden';
  if (applyView === 'questionnaire') return 'questionnaire';
  if (applyView === 'noQuestionnaire') return 'noQuestionnaire';
  if (applyView === 'queue') return 'queue';
  return null;
}

/** @param {string} scope */
export function batchScopeUiLabel(scope) {
  switch (scope) {
    case 'hidden':
      return 'Скрытые';
    case 'questionnaire':
      return 'Анкета';
    case 'noQuestionnaire':
      return 'Без анкет';
    case 'queue':
    default:
      return 'Очередь';
  }
}

/** Подпись раздела в отчёте батча (раздел + вкладка очереди). */
export function batchScopeReportLabel(scope, queueStatus) {
  const base = batchScopeUiLabel(scope);
  if (normalizeBatchScope(scope) !== 'queue') return base;
  if (queueStatus === 'approved') return `${base} · Подходят`;
  if (queueStatus === 'pending') return `${base} · На проверке`;
  return base;
}

/**
 * @param {object[]} items
 * @param {string} scope
 * @param {object} [prefs]
 */
export function filterForBatchScope(items, scope, prefs = {}) {
  const active = items.filter((x) => !isVacancyDeferred(x));
  const normalized = normalizeBatchScope(scope);
  if (normalized === 'hidden') {
    return active
      .filter((x) => isActiveQueueStatus(x))
      .filter((x) => !vacancyHasHhApply(x))
      .filter((x) => !vacancyHhSiteBlocked(x))
      .filter((x) => recordIsHiddenByRoleFilters(x, prefs));
  }
  if (normalized === 'questionnaire') {
    return active
      .filter((x) => isActiveQueueStatus(x))
      .filter((x) => !vacancyHasHhApply(x))
      .filter((x) => !vacancyHhSiteBlocked(x))
      .filter((x) => vacancyQuestionnairePending(x));
  }
  let q = active
    .filter((x) => isActiveQueueStatus(x))
    .filter((x) => !vacancyHasHhApply(x))
    .filter((x) => !vacancyHhSiteBlocked(x))
    .filter((x) => recordPassesRoleFiltersForList(x, prefs));
  if (normalized === 'noQuestionnaire') {
    q = q.filter((x) => !recordNeedsQuestionnaireWork(x));
  }
  return q;
}
