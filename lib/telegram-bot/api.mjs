/**
 * Telegram Bot API (fetch, без сторонних SDK).
 */

import { telegramFetch } from '../telegram-fetch.mjs';
import { getTelegramApiBase, telegramApiHeaders } from '../telegram-api-base.mjs';

/**
 * @param {string} botToken
 * @param {string} method
 * @param {Record<string, unknown>} [body]
 */
async function callTelegram(botToken, method, body) {
  const url = `${getTelegramApiBase()}/bot${botToken}/${method}`;
  const res = await telegramFetch(url, {
    method: 'POST',
    headers: telegramApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body || {}),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Telegram API ${method}: ${raw.slice(0, 200)}`);
  }
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed`);
  }
  return data.result;
}

/**
 * @param {string} botToken
 * @param {number} offset
 * @param {number} [timeoutSec]
 */
export async function getUpdates(botToken, offset, timeoutSec = 25) {
  return callTelegram(botToken, 'getUpdates', {
    offset,
    timeout: timeoutSec,
    allowed_updates: ['message', 'callback_query'],
  });
}

/** @param {string} botToken */
export async function getWebhookInfo(botToken) {
  return callTelegram(botToken, 'getWebhookInfo', {});
}

/**
 * Снять webhook — нужно перед long polling (конфликт с VPS/Wispbyte webhook).
 * @param {string} botToken
 * @param {boolean} [dropPending]
 */
export async function deleteWebhook(botToken, dropPending = false) {
  return callTelegram(botToken, 'deleteWebhook', { drop_pending_updates: dropPending });
}

/**
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} text
 * @param {{ replyMarkup?: object, disablePreview?: boolean }} [opts]
 */
export async function sendBotMessage(botToken, chatId, text, opts = {}) {
  return callTelegram(botToken, 'sendMessage', {
    chat_id: chatId,
    text: String(text || '').slice(0, 4000),
    disable_web_page_preview: opts.disablePreview !== false,
    reply_markup: opts.replyMarkup,
  });
}

/**
 * @param {string} botToken
 * @param {string} callbackQueryId
 * @param {string} [text]
 */
export async function answerCallbackQuery(botToken, callbackQueryId, text) {
  return callTelegram(botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text ? String(text).slice(0, 200) : undefined,
    show_alert: Boolean(text && text.length > 60),
  });
}
