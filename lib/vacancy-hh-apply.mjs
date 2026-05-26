/**
 * Отметка об отклике на hh.ru (пишется scripts/hh-apply-chat-letter.mjs).
 */

import { hhSiteStateBlocksApply, hhSiteStateLabel } from './hh-vacancy-response-state.mjs';
import { recordNeedsQuestionnaireWork } from './questionnaire-labels.mjs';

/**
 * @param {{ hhApply?: { responseSubmitted?: boolean, lastAt?: string } } | null | undefined} rec
 */
export function vacancyHasHhApply(rec) {
  const h = rec?.hhApply;
  if (!h || typeof h !== 'object') return false;
  if (Boolean(h.responseSubmitted)) return true;
  if (h.questionnaire?.status === 'pending_manual') return false;
  return false;
}

export function vacancyQuestionnairePending(rec) {
  if (rec?.hhApply?.responseSubmitted) return false;
  return recordNeedsQuestionnaireWork(rec);
}

/** Уже есть исход на hh.ru (отклик / приглашение / отказ) — не слать повторно. */
export function vacancyHhSiteBlocked(rec) {
  return hhSiteStateBlocksApply(rec?.hhApply?.hhSiteState);
}

export function vacancyHasEmployerOutcome(rec) {
  const s = rec?.hhApply?.hhSiteState;
  return s === 'invited' || s === 'declined';
}

/** Вкладка «Отклики»: наш отклик или статус с hh.ru. */
export function vacancyShownInAppliedTab(rec) {
  if (vacancyHasHhApply(rec)) return true;
  const s = rec?.hhApply?.hhSiteState;
  return s === 'already_applied' || s === 'invited' || s === 'declined';
}

/**
 * @param {object} [rec]
 */
export function hhSiteStateBadgeText(rec) {
  const h = rec?.hhApply;
  if (!h?.hhSiteState || h.hhSiteState === 'none') return '';
  const label = h.hhSiteStateLabel || hhSiteStateLabel(h.hhSiteState);
  const when = h.hhSiteStateAt
    ? new Date(h.hhSiteStateAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return when ? `${label} · ${when}` : label;
}

/**
 * @param {object} [prevHh]
 * @param {object} patch
 */
export function buildHhApplyAfterSuccess(prevHh = {}, patch = {}) {
  const questionnaire = prevHh.questionnaire
    ? { ...prevHh.questionnaire, status: 'completed', needsProbe: false }
    : undefined;
  return {
    ...prevHh,
    ...patch,
    ...(questionnaire ? { questionnaire } : {}),
  };
}

/**
 * @param {{ hhApply?: { lastAt?: string, letterDelivered?: boolean, letterInForm?: boolean, chatSent?: boolean, responseSubmitted?: boolean } } | null | undefined} rec
 */
export function hhApplySummary(rec) {
  const h = rec?.hhApply;
  if (!h?.lastAt) return null;
  const parts = [];
  if (h.hhSiteState === 'invited') parts.push('приглашение hh.ru');
  else if (h.hhSiteState === 'declined') parts.push('отказ hh.ru');
  else if (h.hhSiteState === 'already_applied') parts.push('отклик на hh.ru');
  if (h.letterDelivered) parts.push('письмо доставлено');
  else if (h.letterInForm) parts.push('письмо в форме');
  else if (h.chatSent) parts.push('письмо в чате');
  else if (h.responseSubmitted) parts.push('отклик без письма');
  const when = new Date(h.lastAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { parts, when, text: `${parts.join(' · ') || 'отклик'} · ${when}` };
}
