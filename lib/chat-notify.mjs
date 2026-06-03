/**
 * Telegram-уведомления по чатам hh.ru.
 */

import { sendTelegramMessage } from './telegram-notify.mjs';
import { countByFilter } from './chat-inbox.mjs';
import { loadChatFollowUpState, saveChatFollowUpState } from './chat-follow-up-schedule.mjs';

/**
 * @param {string} slotKey
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function notifyChatFollowUpTelegram(slotKey) {
  if (String(process.env.HH_CHAT_FOLLOW_UP_TELEGRAM ?? '1').trim() === '0') {
    return { ok: false, skipped: true, reason: 'disabled' };
  }

  const state = loadChatFollowUpState();
  if (state.lastTelegramSlot === slotKey) {
    return { ok: false, skipped: true, reason: 'already_sent' };
  }

  const counts = countByFilter();
  if (!counts.needs_reply && !counts.invite_nudge) {
    return { ok: false, skipped: true, reason: 'nothing_to_notify' };
  }

  const text = [
    '💬 Чаты hh.ru',
    '',
    `Нужен ответ: ${counts.needs_reply}`,
    `Напомнить о себе: ${counts.invite_nudge}`,
    '',
    'Дашборд → «Чаты» или Ctrl+K → «Чаты hh.ru»',
  ].join('\n');

  const res = await sendTelegramMessage(text);
  if (res.ok) {
    state.lastTelegramSlot = slotKey;
    state.lastTelegramAt = new Date().toISOString();
    saveChatFollowUpState(state);
  }
  return res;
}
