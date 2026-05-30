/**
 * Обратная связь по исходам (приглашение / отказ) для LLM.
 */

import { loadRecentFeedback } from './feedback-context.mjs';

/**
 * @param {object[]} entries
 * @param {{ maxInvited?: number, maxDeclined?: number }} [opts]
 */
export function buildOutcomeFeedbackBlock(entries, opts = {}) {
  const maxInvited = Math.max(1, Number(opts.maxInvited) || 4);
  const maxDeclined = Math.max(1, Number(opts.maxDeclined) || 6);
  const invited = entries
    .filter((e) => e.action === 'invited')
    .slice(-maxInvited)
    .map((e) => {
      const letter = String(e.letterExcerpt || '').trim();
      const line = `• «${(e.title || '').slice(0, 72)}»${letter ? ` — фрагмент письма: «${letter.slice(0, 120)}…»` : ''}`;
      return line;
    });
  const declined = entries
    .filter((e) => e.action === 'declined' && (e.reason || e.title))
    .slice(-maxDeclined)
    .map((e) => `• «${(e.title || '').slice(0, 72)}»: ${String(e.reason || 'отказ работодателя').slice(0, 100)}`);

  const parts = [];
  if (invited.length) {
    parts.push(
      'Удачные исходы (приглашения — ориентир тона и структуры письма, не копируй дословно):',
      ...invited
    );
  }
  if (declined.length) {
    parts.push(
      'Отказы (не повторяй слабые паттерны — учитывай при выборе акцентов):',
      ...declined
    );
  }
  if (!parts.length) return '';
  return `\n${parts.join('\n')}\n`;
}

/** @param {{ maxLines?: number }} [opts] */
export function loadOutcomeFeedbackBlock(opts = {}) {
  const maxLines = Math.max(5, Number(opts.maxLines) || 30);
  return buildOutcomeFeedbackBlock(loadRecentFeedback(maxLines), opts);
}
