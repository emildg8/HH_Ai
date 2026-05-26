/**
 * Синхронизация «Отклики и приглашения» / переписок с hh.ru.
 */

import fs from 'fs';
import { HH_NEGOTIATIONS_CACHE_FILE, DATA_DIR } from './paths.mjs';
import { loadQueue, updateVacancyRecord } from './store.mjs';
import { HH_SITE_STATES, buildHhApplySiteStatePatch, hhSiteStateLabel } from './hh-vacancy-response-state.mjs';

/** @typedef {'none' | 'submitted' | 'viewed' | 'invited' | 'declined' | 'archived' | 'awaiting'} NegotiationStatus */

/**
 * @param {string} text
 * @returns {NegotiationStatus}
 */
export function parseNegotiationStatusText(text) {
  const raw = String(text || '').trim();
  const t = raw.toLowerCase();
  if (/приглаш|собеседован|интервью|хотим познаком|приглашаем/i.test(t)) return 'invited';
  if (/^просмотрен/i.test(raw) || /^просмотрел/i.test(raw)) return 'viewed';
  if (/^отказ\b/i.test(raw) || (/\bотказ\b/i.test(t) && !/отказаться/i.test(t) && t.indexOf('отказ') < 25)) {
    return 'declined';
  }
  if (/не готовы|отклонил|не подход/i.test(t)) return 'declined';
  if (/просмотрел|просмотрен|открыли резюме|резюме просмотр/i.test(t)) return 'viewed';
  if (/жд[её]м|ожидаем ответ|без ответа/i.test(t)) return 'awaiting';
  if (/отклик|отправлен|доставлен/i.test(t)) return 'submitted';
  return 'submitted';
}

/**
 * @param {NegotiationStatus} st
 */
export function negotiationStatusToHhSiteState(st) {
  switch (st) {
    case 'invited':
      return HH_SITE_STATES.INVITED;
    case 'declined':
      return HH_SITE_STATES.DECLINED;
    case 'viewed':
      return 'viewed';
    case 'awaiting':
      return 'awaiting';
    case 'submitted':
      return HH_SITE_STATES.ALREADY_APPLIED;
    default:
      return HH_SITE_STATES.NONE;
  }
}

/**
 * @param {import('playwright').Page} page
 */
export async function scrapeHhNegotiationsList(page) {
  await page.goto('https://hh.ru/applicant/negotiations', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);

  const items = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const nodes = document.querySelectorAll(
      '[data-qa="negotiations-item"], [data-qa="negotiation-item"], [data-qa^="negotiation"]'
    );
    const pushFromEl = (el) => {
      const a =
        el.querySelector('a[href*="/vacancy/"]') ||
        el.closest('a[href*="/vacancy/"]') ||
        el.querySelector('a[href*="vacancyId"]');
      const href = a?.getAttribute('href') || '';
      const m = href.match(/vacancy[/=](\d+)/i) || href.match(/vacancyId=(\d+)/i);
      const vacancyId = m ? m[1] : '';
      if (!vacancyId || seen.has(vacancyId)) return;
      seen.add(vacancyId);
      const title =
        el.querySelector('[data-qa="negotiations-item-title"]')?.innerText?.trim() ||
        el.querySelector('span[class*="title"]')?.innerText?.trim() ||
        a?.innerText?.trim() ||
        '';
      const company =
        el.querySelector('[data-qa="negotiations-item-company"]')?.innerText?.trim() || '';
      const statusRaw =
        el.querySelector('[data-qa="negotiations-item-status"]')?.innerText?.trim() ||
        el.querySelector('[class*="status"]')?.innerText?.trim() ||
        el.innerText?.slice(0, 200) ||
        '';
      const chatHref =
        el.querySelector('a[href*="/chat/"]')?.getAttribute('href') ||
        el.querySelector('a[href*="negotiation"]')?.getAttribute('href') ||
        '';
      out.push({
        vacancyId,
        title: title.replace(/\s+/g, ' ').trim(),
        company: company.replace(/\s+/g, ' ').trim(),
        statusRaw: statusRaw.replace(/\s+/g, ' ').trim(),
        chatUrl: chatHref.startsWith('http') ? chatHref : chatHref ? `https://hh.ru${chatHref}` : '',
      });
    };

    if (nodes.length) {
      for (const el of nodes) pushFromEl(el);
    } else {
      for (const a of document.querySelectorAll('a[href*="/vacancy/"]')) {
        const row = a.closest('div[class*="item"], li, article') || a.parentElement;
        if (row) pushFromEl(row);
      }
    }
    return out;
  });

  return items.map((it) => ({
    ...it,
    status: parseNegotiationStatusText(it.statusRaw),
    syncedAt: new Date().toISOString(),
  }));
}

export function loadNegotiationsCache() {
  if (!fs.existsSync(HH_NEGOTIATIONS_CACHE_FILE)) {
    return { items: [], syncedAt: null };
  }
  try {
    return JSON.parse(fs.readFileSync(HH_NEGOTIATIONS_CACHE_FILE, 'utf8'));
  } catch {
    return { items: [], syncedAt: null };
  }
}

export function saveNegotiationsCache(payload) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    HH_NEGOTIATIONS_CACHE_FILE,
    `${JSON.stringify({ ...payload, syncedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

/**
 * Обновить карточки очереди по vacancyId из кэша переговоров.
 * @param {{ items: object[] }} cache
 */
export function mergeNegotiationsIntoQueue(cache) {
  const byVacancy = new Map();
  for (const it of cache.items || []) {
    if (it.vacancyId) byVacancy.set(String(it.vacancyId), it);
  }
  const queue = loadQueue();
  let updated = 0;
  for (const rec of queue) {
    let vid = String(rec.vacancyId || '');
    if (!vid && rec.url) {
      const m = String(rec.url).match(/vacancy\/(\d+)/);
      if (m) vid = m[1];
    }
    const neg = byVacancy.get(vid);
    if (!neg) continue;
    const hhState = negotiationStatusToHhSiteState(neg.status);
    const label =
      hhState === 'viewed'
        ? 'Резюме просмотрели'
        : hhState === 'awaiting'
          ? 'Ждём ответа работодателя'
          : hhSiteStateLabel(hhState);
    const hhApply = buildHhApplySiteStatePatch(rec.hhApply || {}, {
      state: hhState,
      label,
      source: 'negotiations-sync',
    });
    hhApply.negotiationStatus = neg.status;
    hhApply.negotiationStatusRaw = neg.statusRaw;
    hhApply.chatUrl = neg.chatUrl || rec.hhApply?.chatUrl;
    updateVacancyRecord(rec.id, { hhApply });
    updated++;
  }
  return { updated, total: queue.length, negotiations: (cache.items || []).length };
}
