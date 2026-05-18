/**
 * Отметка об отклике на hh.ru (пишется scripts/hh-apply-chat-letter.mjs).
 */

/**
 * @param {{ hhApply?: { responseSubmitted?: boolean, lastAt?: string } } | null | undefined} rec
 */
export function vacancyHasHhApply(rec) {
  const h = rec?.hhApply;
  if (!h || typeof h !== 'object') return false;
  if (h.questionnaire?.status === 'pending_manual') return false;
  return Boolean(h.responseSubmitted);
}

export function vacancyQuestionnairePending(rec) {
  return rec?.hhApply?.questionnaire?.status === 'pending_manual';
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
