/**
 * Синхронизация сообщений переписки hh.ru для одной вакансии / чата.
 */

import { classifyChatMessage } from './chat-message-classify.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {string} chatUrl
 */
export async function scrapeChatMessages(page, chatUrl) {
  if (!chatUrl) return [];
  await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1500);

  const raw = await page.evaluate(() => {
    const out = [];
    const bubbles = document.querySelectorAll(
      '[data-qa="chat-message"], [data-qa^="chat-message"], [class*="chat-message"]'
    );
    for (const el of bubbles) {
      const text = (el.innerText || '').trim();
      if (!text || text.length < 2) continue;
      const cls = String(el.className || '');
      const isMine =
        el.getAttribute('data-qa')?.includes('outgoing') ||
        /outgoing|mine|my-message|от меня/i.test(cls) ||
        el.closest('[class*="outgoing"]') != null;
      out.push({ text: text.slice(0, 4000), isMine: Boolean(isMine) });
    }
    if (!out.length) {
      const body = document.body.innerText || '';
      const lines = body.split('\n').map((l) => l.trim()).filter((l) => l.length > 8);
      for (const line of lines.slice(-30)) {
        out.push({ text: line, isMine: false });
      }
    }
    return out;
  });

  return raw.map((m) => ({
    ...m,
    kind: classifyChatMessage(m),
    at: new Date().toISOString(),
  }));
}

/**
 * @param {import('playwright').Page} page
 * @param {number} [limit]
 */
export async function scrapeChatsFromNegotiations(page, limit = 15) {
  await page.goto('https://hh.ru/applicant/negotiations', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);

  const links = await page.evaluate((max) => {
    const hrefs = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/chat/"], a[href*="negotiation"]')) {
      const h = a.getAttribute('href') || '';
      if (!h || seen.has(h)) continue;
      seen.add(h);
      hrefs.push(h.startsWith('http') ? h : `https://hh.ru${h}`);
      if (hrefs.length >= max) break;
    }
    return hrefs;
  }, limit);

  const threads = [];
  for (const url of links) {
    const messages = await scrapeChatMessages(page, url);
    threads.push({ chatUrl: url, messages, syncedAt: new Date().toISOString() });
  }
  return threads;
}
