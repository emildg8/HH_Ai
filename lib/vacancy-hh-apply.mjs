/**
 * Отметка об отклике на hh.ru (пишется scripts/hh-apply-chat-letter.mjs).
 */

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
  const q = rec?.hhApply?.questionnaire;
  if (q?.status === 'pending_manual') return true;
  if (q?.likelyFromVacancyText) return true;
  return false;
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
