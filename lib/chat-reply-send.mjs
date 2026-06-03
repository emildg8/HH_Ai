/**
 * Отправка ответа в чат hh.ru через Playwright.
 */

import { sendLetterInChat, selectNegotiationThread } from './hh-chat-selectors.mjs';
import { summarizeChatThread } from './chat-message-classify.mjs';
import { enrichChatSummary } from './chat-thread.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {object} rec
 * @param {string} text
 * @param {(msg: string) => void} [log]
 */
export async function sendChatReplyInBrowser(page, rec, text, log = () => {}) {
  const reply = String(text || '').trim();
  if (!reply) throw new Error('Пустой текст ответа');

  const chatUrl = rec.hhApply?.chatUrl || '';
  const ctx = {
    text: reply,
    vacancyId: rec.vacancyId || '',
    vacancyTitle: rec.title || '',
    company: rec.company || '',
    log,
  };

  if (chatUrl) {
    await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1500);
  } else {
    await page.goto('https://hh.ru/applicant/negotiations', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    const picked = await selectNegotiationThread(page, ctx);
    if (!picked) throw new Error('Не найден диалог в списке откликов');
    await page.waitForTimeout(800);
  }

  await sendLetterInChat(page, ctx, 35_000);
  return true;
}

/**
 * @param {object} rec
 * @param {string} text
 */
export function buildChatSendPatch(rec, text) {
  const reply = String(text || '').trim();
  const at = new Date().toISOString();
  const messages = [
    ...(rec.hhApply?.chatMessages || []),
    { text: reply, isMine: true, kind: 'mine', at },
  ];
  const chatSummary = enrichChatSummary(summarizeChatThread(messages), messages);
  return {
    hhApply: {
      ...(rec.hhApply || {}),
      chatMessages: messages.slice(-30),
      chatSummary: { ...chatSummary, needsReply: false, questionNeedsReply: false },
      chatLastSentAt: at,
      chatReplyDraft: { reply, source: 'sent-playwright', at },
    },
  };
}
