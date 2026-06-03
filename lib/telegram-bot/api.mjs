/**
 * Telegram Bot API (fetch, без сторонних SDK).
 */

import fs from 'node:fs';
import path from 'node:path';
import { telegramFetch } from '../telegram-fetch.mjs';
import { getTelegramApiBase, telegramApiHeaders } from '../telegram-api-base.mjs';

/** @typedef {{ keyboard: { text: string }[][], resize_keyboard?: boolean, is_persistent?: boolean, input_field_placeholder?: string }} ReplyKeyboardMarkup */
/** @typedef {{ inline_keyboard: { text: string, callback_data: string }[][] }} InlineKeyboardMarkup */

/**
 * @param {string} botToken
 * @param {string} method
 * @param {Record<string, unknown>} [body]
 * @param {number} [attempts]
 */
async function callTelegram(botToken, method, body, attempts = 3) {
  const url = `${getTelegramApiBase()}/bot${botToken}/${method}`;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
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
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      if (i < attempts - 1 && /fetch failed|timeout|ECONNRESET|ETIMEDOUT/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
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
    parse_mode: opts.parseMode,
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

/** @param {string} botToken @param {{ command: string, description: string }[]} commands */
export async function setBotCommands(botToken, commands) {
  return callTelegram(botToken, 'setMyCommands', { commands });
}

/** @param {string} botToken @param {string} name */
export async function setBotName(botToken, name) {
  return callTelegram(botToken, 'setMyName', { name: String(name).slice(0, 64) });
}

/** @param {string} botToken @param {string} text */
export async function setBotShortDescription(botToken, text) {
  return callTelegram(botToken, 'setMyShortDescription', {
    short_description: String(text).slice(0, 120),
  });
}

/** @param {string} botToken @param {string} text */
export async function setBotDescription(botToken, text) {
  return callTelegram(botToken, 'setMyDescription', {
    description: String(text).slice(0, 512),
  });
}

/** @param {string} botToken @param {{ type: 'commands' | 'default' }} menuButton */
export async function setBotMenuButton(botToken, menuButton) {
  return callTelegram(botToken, 'setChatMenuButton', { menu_button: menuButton });
}

/**
 * @param {string} botToken
 * @param {string} filePath
 */
export async function setBotProfilePhoto(botToken, filePath) {
  const abs = path.resolve(filePath);
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const attempts = [
    () => uploadProfilePhotoJson(botToken, buf, abs, mime),
    () => uploadProfilePhotoMultipart(`${getTelegramApiBase()}/bot${botToken}/setMyProfilePhoto`, buf, abs, mime),
    () => uploadProfilePhotoMultipart(`https://api.telegram.org/bot${botToken}/setMyProfilePhoto`, buf, abs, mime),
  ];
  let lastErr;
  for (const tryUpload of attempts) {
    try {
      return await tryUpload();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('setMyProfilePhoto failed');
}

/**
 * @param {string} botToken
 * @param {Buffer} buf
 * @param {string} abs
 * @param {string} mime
 */
async function uploadProfilePhotoJson(botToken, buf, abs, mime) {
  const base = getTelegramApiBase();
  if (base === 'https://api.telegram.org') {
    throw new Error('no proxy upload endpoint');
  }
  const url = `${base}/upload/bot-profile-photo`;
  const res = await fetch(url, {
    method: 'POST',
    headers: telegramApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      token: botToken,
      image: buf.toString('base64'),
      filename: path.basename(abs),
      mime,
    }),
    signal: AbortSignal.timeout(20000),
  });
  return parseProfilePhotoResponse(res);
}

/**
 * @param {string} url
 * @param {Buffer} buf
 * @param {string} abs
 * @param {string} mime
 */
async function uploadProfilePhotoMultipart(url, buf, abs, mime) {
  const form = new FormData();
  form.append(
    'photo',
    new Blob([JSON.stringify({ type: 'static', photo: 'attach://avatar' })], {
      type: 'application/json',
    })
  );
  form.append('avatar', new Blob([buf], { type: mime }), path.basename(abs));
  const res = await fetch(url, {
    method: 'POST',
    headers: telegramApiHeaders({}),
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  return parseProfilePhotoResponse(res);
}

/** @param {Response} res */
async function parseProfilePhotoResponse(res) {
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`setMyProfilePhoto: ${raw.slice(0, 200)}`);
  }
  if (!data.ok) {
    throw new Error(data.description || 'setMyProfilePhoto failed');
  }
  return data.result;
}
