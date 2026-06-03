/**
 * Чаты hh.ru в Telegram-боте: список, просмотр, черновик, отправка.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../paths.mjs';
import { buildChatInbox, getChatThreadDetail } from '../chat-inbox.mjs';
import { draftChatReply } from '../chat-reply-draft.mjs';
import { getVacancyRecord, updateVacancyRecord } from '../store.mjs';
import { getBrowserBusyState } from '../browser-guard.mjs';
import { checkChatSendRateLimit, recordChatSendLaunch } from '../chat-send-rate.mjs';
import { spawnSideJob } from '../side-job-runner.mjs';
import { sendBotMessage, answerCallbackQuery } from './api.mjs';
import { esc, section, statusIcon } from './format.mjs';
import { actionResultText } from './copy.mjs';
import { chatInboxKeyboard, chatListKeyboard, chatThreadKeyboard, confirmSendKeyboard } from './ui.mjs';
import { clearPending, getSession, patchSession } from './session.mjs';
import { launchSyncChats } from './jobs.mjs';

const PAGE_SIZE = 7;

/** @param {string} title @param {number} max */
function shortTitle(title, max = 42) {
  const t = String(title || '—').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {'needs_reply' | 'all'} [filter]
 */
export async function showChatInbox(cfg, chatId, filter = 'needs_reply') {
  const inbox = buildChatInbox({ filter, limit: 100 });
  patchSession(chatId, { filter, page: 0, threads: inbox.items.map((r) => ({ id: r.id, title: r.title })) });
  const counts = inbox.counts;
  const html = [
    section('Inbox чатов hh.ru', [
      `${statusIcon(counts.needs_reply ? 'warn' : 'ok')} ${esc(String(counts.needs_reply))} ждут ответа`,
      `${esc(String(counts.invite_nudge))} напомнить · ${esc(String(counts.declined))} отказы · ${esc(String(counts.all))} всего`,
    ]),
    '',
    '<i>Выберите фильтр или чат ниже. Для актуальных данных — синхронизация.</i>',
  ].join('\n');
  await sendBotMessage(cfg.botToken, chatId, html, {
    replyMarkup: chatInboxKeyboard(filter, counts),
    parseMode: 'HTML',
  });
  await sendChatListPage(cfg, chatId);
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 */
export async function sendChatListPage(cfg, chatId) {
  const session = getSession(chatId);
  const filter = session.filter || 'needs_reply';
  const page = Math.max(0, Number(session.page) || 0);
  const inbox = buildChatInbox({ filter, limit: 100 });
  const items = inbox.items;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  patchSession(chatId, {
    filter,
    page: safePage,
    threads: slice.map((r) => ({ id: r.id, title: r.title })),
  });

  if (!slice.length) {
    await sendBotMessage(cfg.botToken, chatId, '<i>Нет чатов в этом фильтре. Запустите синхронизацию.</i>', {
      replyMarkup: chatListKeyboard(safePage, totalPages, 0),
      parseMode: 'HTML',
    });
    return;
  }

  const lines = [`<b>Чаты</b> · ${filter === 'needs_reply' ? 'нужен ответ' : 'все'} · стр. ${safePage + 1}/${totalPages}`, ''];
  slice.forEach((row, i) => {
    const icon = row.followUpKind === 'question' ? '❗' : row.followUpKind === 'invite_nudge' ? '🔔' : '💬';
    lines.push(`${icon} <b>${i + 1}.</b> ${esc(shortTitle(row.title))}`);
    if (row.lastPreview) lines.push(`   <i>${esc(row.lastPreview.slice(0, 80))}</i>`);
  });
  await sendBotMessage(cfg.botToken, chatId, lines.join('\n'), {
    replyMarkup: chatListKeyboard(safePage, totalPages, slice.length),
    parseMode: 'HTML',
  });
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {number} index
 */
export async function showChatThread(cfg, chatId, index) {
  const session = getSession(chatId);
  const thread = session.threads?.[index];
  if (!thread) {
    await sendBotMessage(cfg.botToken, chatId, 'Чат не найден — обновите список.', { parseMode: 'HTML' });
    return;
  }
  const detail = getChatThreadDetail(thread.id);
  if (!detail) {
    await sendBotMessage(cfg.botToken, chatId, 'Поток не найден в данных.', { parseMode: 'HTML' });
    return;
  }
  patchSession(chatId, { threadId: thread.id, threadIndex: index });

  const lines = [
    `<b>${esc(detail.title)}</b>`,
    detail.company ? `<i>${esc(detail.company)}</i>` : null,
    detail.followUpLabel ? `${statusIcon('warn')} ${esc(detail.followUpLabel)}` : null,
    '',
  ].filter(Boolean);

  const messages = detail.messages || [];
  if (!messages.length) {
    lines.push('<i>Сообщений нет — синхронизируйте чаты.</i>');
  } else {
    lines.push('<b>Переписка</b>');
    for (const m of messages.slice(-8)) {
      const who = esc(m.who || 'HR');
      const text = esc(String(m.text || '').slice(0, 500));
      lines.push(`\n<b>${who}:</b>\n${text}`);
    }
  }

  const draft = detail.chatReplyDraft || '';
  if (draft) {
    lines.push('', '<b>Черновик</b>', esc(String(draft).slice(0, 900)));
  }

  await sendBotMessage(cfg.botToken, chatId, lines.join('\n'), {
    replyMarkup: chatThreadKeyboard(index, Boolean(draft)),
    parseMode: 'HTML',
  });
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {number} index
 */
export async function draftChatReplyForThread(cfg, chatId, index) {
  const session = getSession(chatId);
  const thread = session.threads?.[index];
  if (!thread) return { ok: false, error: 'Чат не найден' };

  await sendBotMessage(cfg.botToken, chatId, '⏳ Генерирую черновик ответа…', { parseMode: 'HTML' });

  const detail = getChatThreadDetail(thread.id);
  if (!detail) return { ok: false, error: 'Поток не найден' };

  try {
    const draft = await draftChatReply({
      vacancyTitle: detail.title,
      company: detail.company,
      messages: detail.messages || [],
    });
    const rec = getVacancyRecord(thread.id);
    if (rec && !String(thread.id).startsWith('hh-neg-')) {
      updateVacancyRecord(thread.id, {
        hhApply: { ...(rec.hhApply || {}), chatReplyDraft: draft },
      });
    }
    patchSession(chatId, { threadId: thread.id, threadIndex: index, text: draft.reply });
    await sendBotMessage(cfg.botToken, chatId, `<b>Черновик готов</b>\n\n${esc(draft.reply)}`, {
      replyMarkup: confirmSendKeyboard(index),
      parseMode: 'HTML',
    });
    return { ok: true };
  } catch (e) {
    await sendBotMessage(cfg.botToken, chatId, actionResultText(false, e.message || String(e)), {
      parseMode: 'HTML',
    });
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {number} index
 * @param {string} [textOverride]
 */
export async function sendChatReplyFromBot(cfg, chatId, index, textOverride) {
  const session = getSession(chatId);
  const thread = session.threads?.[index];
  if (!thread) return { ok: false, error: 'Чат не найден' };

  const rec = getVacancyRecord(thread.id);
  if (!rec) {
    return {
      ok: false,
      error: 'Запись только в кэше hh.ru — откройте дашборд или дождитесь синхронизации в очередь',
    };
  }

  const text = String(textOverride || session.text || rec.hhApply?.chatReplyDraft?.reply || '').trim();
  if (!text) return { ok: false, error: 'Нет текста ответа' };
  if (text.length > 4000) return { ok: false, error: 'Слишком длинный текст (макс. 4000)' };

  const rateErr = checkChatSendRateLimit();
  if (rateErr) return { ok: false, error: rateErr };

  const busy = getBrowserBusyState();
  if (busy.busy) return { ok: false, error: busy.message || 'Браузер занят' };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'chat-send-request.json'),
    `${JSON.stringify({ id: rec.id, text, requestedAt: new Date().toISOString() })}\n`,
    'utf8'
  );
  recordChatSendLaunch();
  const child = spawnSideJob('chatReplySend', 'send-chat-reply.mjs', [], { HH_HEADLESS: '0' });
  clearPending(chatId);
  return {
    ok: true,
    pid: child.pid,
    message: `Отправка запущена (pid ${child.pid}) — проверьте окно Chromium`,
  };
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {string} text
 */
export async function handlePendingTextInput(cfg, chatId, text) {
  const session = getSession(chatId);
  if (session.mode !== 'await_reply_text') return false;

  const raw = String(text || '').trim();
  if (!raw || raw.startsWith('/')) {
    await sendBotMessage(cfg.botToken, chatId, 'Введите текст ответа или /cancel для отмены.', {
      parseMode: 'HTML',
    });
    return true;
  }

  const index = Number(session.threadIndex);
  patchSession(chatId, { mode: 'confirm_send', text: raw });
  await sendBotMessage(cfg.botToken, chatId, `<b>Отправить этот ответ?</b>\n\n${esc(raw.slice(0, 3500))}`, {
    replyMarkup: confirmSendKeyboard(index),
    parseMode: 'HTML',
  });
  return true;
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {string} data
 * @param {string} callbackQueryId
 */
export async function handleChatCallback(cfg, chatId, data, callbackQueryId) {
  const botToken = cfg.botToken;

  if (data === 'cb:inbox') {
    await answerCallbackQuery(botToken, callbackQueryId);
    await showChatInbox(cfg, chatId, getSession(chatId).filter || 'needs_reply');
    return true;
  }

  if (data === 'cs:sync') {
    const r = launchSyncChats();
    await answerCallbackQuery(botToken, callbackQueryId, r.ok ? 'Запущено' : 'Ошибка');
    await sendBotMessage(botToken, chatId, actionResultText(r.ok, r.ok ? r.message : r.error), {
      parseMode: 'HTML',
    });
    return true;
  }

  if (data.startsWith('cf:')) {
    const filter = data.slice(3) === 'all' ? 'all' : 'needs_reply';
    await answerCallbackQuery(botToken, callbackQueryId);
    await showChatInbox(cfg, chatId, filter);
    return true;
  }

  if (data.startsWith('cp:')) {
    const page = Math.max(0, Number(data.slice(3)) || 0);
    patchSession(chatId, { page });
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendChatListPage(cfg, chatId);
    return true;
  }

  if (data.startsWith('ct:')) {
    const index = Number(data.slice(3));
    await answerCallbackQuery(botToken, callbackQueryId);
    await showChatThread(cfg, chatId, index);
    return true;
  }

  if (data.startsWith('cd:')) {
    const index = Number(data.slice(3));
    await answerCallbackQuery(botToken, callbackQueryId, 'Черновик…');
    await draftChatReplyForThread(cfg, chatId, index);
    return true;
  }

  if (data.startsWith('cw:')) {
    const index = Number(data.slice(3));
    patchSession(chatId, { mode: 'await_reply_text', threadIndex: index });
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendBotMessage(botToken, chatId, '✏️ <b>Введите текст ответа</b> одним сообщением.\n\n/cancel — отмена', {
      parseMode: 'HTML',
    });
    return true;
  }

  if (data.startsWith('cx:')) {
    const index = Number(data.slice(3));
    const session = getSession(chatId);
    const r = await sendChatReplyFromBot(cfg, chatId, index, session.text);
    await answerCallbackQuery(botToken, callbackQueryId, r.ok ? 'Отправка' : 'Ошибка');
    await sendBotMessage(botToken, chatId, actionResultText(r.ok, r.ok ? r.message : r.error), {
      parseMode: 'HTML',
    });
    if (r.ok) await showChatThread(cfg, chatId, index);
    return true;
  }

  if (data.startsWith('cl:')) {
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendChatListPage(cfg, chatId);
    return true;
  }

  return false;
}
