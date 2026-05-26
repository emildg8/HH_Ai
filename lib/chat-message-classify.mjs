/**
 * Классификация сообщений в переписке hh.ru.
 */

/** @typedef {'question' | 'auto_reply' | 'invite' | 'decline' | 'other' | 'mine'} MessageKind */

/**
 * @param {{ text: string, fromEmployer?: boolean, isMine?: boolean }} msg
 * @returns {MessageKind}
 */
export function classifyChatMessage(msg) {
  if (msg.isMine) return 'mine';
  const t = String(msg.text || '').trim();
  const low = t.toLowerCase();
  if (!t) return 'other';

  if (/приглаш|собеседован|интервью|звонок в zoom|teams|google meet/i.test(low)) return 'invite';
  if (/отказ|не готовы|не подход|к сожалению/i.test(low)) return 'decline';

  if (
    /\?$/.test(t.trim()) ||
    /уточните|подскажите|какой опыт|готовы ли|зарплат|ожидан|когда сможете|расскажите/i.test(low)
  ) {
    return 'question';
  }

  if (
    /получили ваш отклик|рассмотрим резюме|свяжемся с вами|спасибо за интерес|автоматическ/i.test(
      low
    ) ||
    (t.length < 120 && /спасибо|получили|рассмотрим/i.test(low))
  ) {
    return 'auto_reply';
  }

  return 'other';
}

/**
 * @param {Array<{ kind?: string }>} messages
 */
export function summarizeChatThread(messages) {
  const employer = messages.filter((m) => m.kind !== 'mine');
  const questions = employer.filter((m) => m.kind === 'question');
  const autoReplies = employer.filter((m) => m.kind === 'auto_reply');
  const needsReply = questions.length > 0 && !messages.some((m) => m.kind === 'mine' && m.afterQuestion);

  return {
    total: messages.length,
    employerCount: employer.length,
    questionCount: questions.length,
    autoReplyCount: autoReplies.length,
    needsReply: questions.length > 0,
    lastKind: employer[employer.length - 1]?.kind || 'none',
  };
}
