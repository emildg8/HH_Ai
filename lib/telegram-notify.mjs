/**
 * Отправка сообщений в Telegram (опционально).
 */

import { telegramFetch } from './telegram-fetch.mjs';
import { telegramApiUrl, telegramApiHeaders } from './telegram-api-base.mjs';

export async function sendTelegramMessage(text, opts = {}) {
  const botToken = String(opts.botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(opts.chatId || process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!botToken || !chatId) {
    return { ok: false, skipped: true, reason: 'TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы' };
  }
  const res = await telegramFetch(telegramApiUrl(botToken, 'sendMessage'), {
    method: 'POST',
    headers: telegramApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text || '').slice(0, 4000),
      disable_web_page_preview: true,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, error: raw.slice(0, 200) };
  }
  return { ok: true };
}
