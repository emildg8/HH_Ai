/**
 * Ingest вакансий из Telegram-каналов (публичный t.me/s или текст поста).
 */

import { extractJobUrlsFromText, normalizeVacancyUrl, parseUrlMetadata } from './vacancy-id.mjs';
import { ingestVacancyPayload, ingestUrlsFromText } from './vacancy-ingest.mjs';

export const DEFAULT_TELEGRAM_CHANNELS = ['g_jobbot', 'EkleftJob'];

/**
 * @param {string} channel — без @
 * @param {{ fetchImpl?: typeof fetch, html?: string }} [opts]
 */
export async function fetchTelegramChannelHtml(channel, opts = {}) {
  if (opts.html) return opts.html;
  const fetchImpl = opts.fetchImpl || fetch;
  const name = String(channel || '').replace(/^@/, '');
  const res = await fetchImpl(`https://t.me/s/${name}`, {
    headers: { 'User-Agent': 'HH-Ai/3.2 ingest' },
  });
  if (!res.ok) throw new Error(`Telegram channel ${name}: HTTP ${res.status}`);
  return res.text();
}

/**
 * @param {string} html
 */
export function extractUrlsFromTelegramHtml(html) {
  const urls = extractJobUrlsFromText(html);
  const widgetRe = /href="(https:\/\/t\.me\/[^"]+)"/gi;
  let m;
  while ((m = widgetRe.exec(html))) {
    const u = m[1];
    if (u.includes('http')) urls.push(...extractJobUrlsFromText(u));
  }
  return [...new Set(urls.map(normalizeVacancyUrl).filter(Boolean))];
}

/**
 * @param {string} channel
 * @param {object} [opts]
 */
export async function ingestTelegramChannel(channel, opts = {}) {
  const html = await fetchTelegramChannelHtml(channel, opts);
  const urls = extractUrlsFromTelegramHtml(html);
  const results = [];
  for (const url of urls.slice(0, opts.limit ?? 30)) {
    const meta = parseUrlMetadata(url);
    const title =
      meta.source === 'hh' && meta.vacancyId ? `Вакансия hh ${meta.vacancyId}` : `Ссылка ${meta.source}`;
    const r = await ingestVacancyPayload(
      {
        url,
        title,
        source: 'telegram',
        ingestMeta: { channel: `@${String(channel).replace(/^@/, '')}` },
      },
      opts
    );
    results.push({ url, ...r });
  }
  return { channel, found: urls.length, results };
}

export { ingestUrlsFromText };
