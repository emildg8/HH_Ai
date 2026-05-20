import { vacancyHasHhApply, vacancyQuestionnairePending } from './vacancy-hh-apply.mjs';
import { recordNeedsQuestionnaireWork } from './questionnaire-labels.mjs';
import {
  recordPassesNot1C,
  recordPassesNotSenior,
  recordPassesNotDeveloper,
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

/**
 * @param {object[]} items
 * @param {string} scope
 * @param {object} [prefs]
 */
export function filterForBatchScope(items, scope, prefs = {}) {
  const normalized = normalizeBatchScope(scope);
  if (normalized === 'hidden') {
    return items
      .filter((x) => !vacancyHasHhApply(x))
      .filter((x) => recordIsHiddenByRoleFilters(x, prefs));
  }
  if (normalized === 'questionnaire') {
    return items
      .filter((x) => !vacancyHasHhApply(x))
      .filter((x) => vacancyQuestionnairePending(x));
  }
  let q = items
    .filter((x) => !vacancyHasHhApply(x))
    .filter((x) => recordPassesNot1C(x, prefs))
    .filter((x) => recordPassesNotSenior(x, prefs))
    .filter((x) => recordPassesNotDeveloper(x, prefs));
  if (normalized === 'noQuestionnaire') {
    q = q.filter((x) => !recordNeedsQuestionnaireWork(x));
  }
  return q;
}
