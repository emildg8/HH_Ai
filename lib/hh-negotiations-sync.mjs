/**
 * Синхронизация «Отклики и приглашения» / переписок с hh.ru.
 */

import fs from 'fs';
import { HH_NEGOTIATIONS_CACHE_FILE, DATA_DIR } from './paths.mjs';
import { loadQueue, updateVacancyRecord } from './store.mjs';
import { buildHhApplySiteStatePatch, hhSiteStateLabel } from './hh-vacancy-response-state.mjs';
import {
  parseNegotiationStatusParsed,
  resolveInviteKind,
  negotiationStatusToHhSiteState,
  inviteKindLabelRu,
} from './hh-invite-kind.mjs';
import { statusPatchFromNegotiation } from './work-format-truth.mjs';

export {
  parseNegotiationStatusParsed,
  resolveInviteKind,
  negotiationStatusToHhSiteState,
  inviteKindLabelRu,
  INVITE_KINDS,
} from './hh-invite-kind.mjs';
export { statusPatchFromNegotiation } from './work-format-truth.mjs';

/** @typedef {'none' | 'submitted' | 'viewed' | 'invited' | 'declined' | 'archived' | 'awaiting'} NegotiationStatus */

/**
 * @param {string} text
 * @returns {NegotiationStatus}
 */
export function parseNegotiationStatusText(text) {
  return parseNegotiationStatusParsed(text).status;
}

/**
 * @param {import('playwright').Page} page
 */
export async function scrapeHhNegotiationsList(page) {
  await page.goto('https://hh.ru/applicant/negotiations', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

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

  return items.map((it) => {
    const parsed = parseNegotiationStatusParsed(it.statusRaw);
    return {
      ...it,
      status: parsed.status,
      inviteKind: parsed.inviteKind,
      syncedAt: new Date().toISOString(),
    };
  });
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

/**
 * @param {object} payload
 * @param {{ allowEmpty?: boolean }} [opts]
 * @returns {boolean} false если запись пропущена (защита от пустого scrape)
 */
export function saveNegotiationsCache(payload, opts = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length && !opts.allowEmpty) {
    const existing = loadNegotiationsCache();
    if ((existing.items || []).length > 0) {
      console.warn(
        `[negotiations-cache] skip empty write — keeping ${existing.items.length} cached items`
      );
      return false;
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    HH_NEGOTIATIONS_CACHE_FILE,
    `${JSON.stringify({ ...payload, syncedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
  return true;
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
  /** @type {string[]} */
  const updatedIds = [];
  const now = new Date().toISOString();
  for (const rec of queue) {
    let vid = String(rec.vacancyId || '');
    if (!vid && rec.url) {
      const m = String(rec.url).match(/vacancy\/(\d+)/);
      if (m) vid = m[1];
    }
    const neg = byVacancy.get(vid);
    if (!neg) continue;

    const prevApply = rec.hhApply || {};
    const { inviteKind, inviteEvidence } = resolveInviteKind({
      negotiationStatusRaw: neg.statusRaw,
      negotiationStatus: neg.status,
      questionnaire: prevApply.questionnaire,
      chatMessages: neg.chatMessages || prevApply.chatMessages,
      chatSummary: neg.chatSummary || prevApply.chatSummary,
    });
    // statusRaw «Отказ …» важнее enum из парсера списка (СПБ Биржа: awaiting при raw=Отказ)
    const statusFromRaw = parseNegotiationStatusText(neg.statusRaw);
    const negStatus =
      statusFromRaw === 'declined' || neg.status === 'declined' ? 'declined' : neg.status;
    const hhState = negotiationStatusToHhSiteState(negStatus, inviteKind);
    const inviteLabel = inviteKindLabelRu(inviteKind);
    const label =
      inviteLabel ||
      (hhState === 'viewed'
        ? 'Резюме просмотрели'
        : hhState === 'awaiting'
          ? 'Ждём ответа работодателя'
          : hhSiteStateLabel(hhState));
    const hhApply = buildHhApplySiteStatePatch(prevApply, {
      state: hhState,
      label,
      source: 'negotiations-sync',
    });
    hhApply.negotiationStatus = negStatus;
    hhApply.negotiationStatusRaw = neg.statusRaw;
    hhApply.chatUrl = neg.chatUrl || prevApply.chatUrl;
    hhApply.inviteKind = inviteKind;
    hhApply.inviteKindAt = now;
    hhApply.inviteKindSource = inviteEvidence.source || 'status_raw';
    hhApply.inviteEvidence = inviteEvidence;

    /** Уже в переговорах hh → не pending/approved ready; отказ → declined (не оставлять pending). */
    const patch = { hhApply, ...statusPatchFromNegotiation(rec.status, negStatus) };

    updateVacancyRecord(rec.id, patch);
    updated++;
    updatedIds.push(rec.id);
  }
  return { updated, total: queue.length, negotiations: (cache.items || []).length, updatedIds };
}
