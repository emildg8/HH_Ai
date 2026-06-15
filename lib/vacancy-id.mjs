/**
 * Идентификаторы вакансий из URL и externalKey для мульти-источникового ingest.
 */

import crypto from 'crypto';
import { vacancyIdFromUrl as hhVacancyIdFromUrl } from './vacancy-parse.mjs';

const JOB_URL_RE =
  /https?:\/\/(?:[\w.-]+\.)?(?:hh\.ru|career\.habr\.com|boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|myworkdayjobs\.com|dice\.com|welcometothejungle\.com)[^\s<>"')]+/gi;

/**
 * @param {string} url
 */
export function normalizeVacancyUrl(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  try {
    const parsed = new URL(u);
    parsed.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'from'].forEach((k) => parsed.searchParams.delete(k));
    u = parsed.toString();
  } catch {
    /* keep raw */
  }
  return u.replace(/\/$/, '');
}

/**
 * @param {string} source
 * @param {string} id
 */
export function buildExternalKey(source, id) {
  const s = String(source || 'unknown').toLowerCase();
  const key = String(id || '').trim();
  if (!key) return '';
  return `${s}:${key}`;
}

/**
 * @param {string} url
 */
export function urlHashKey(url) {
  const n = normalizeVacancyUrl(url);
  if (!n) return '';
  return crypto.createHash('sha256').update(n).digest('hex').slice(0, 16);
}

/**
 * @param {string} url
 * @returns {{ source: string, externalKey: string, vacancyId: string|null, applyMode: string, normalizedUrl: string }}
 */
export function parseUrlMetadata(url) {
  const normalizedUrl = normalizeVacancyUrl(url);
  const u = normalizedUrl.toLowerCase();

  if (/\/vacancy\/\d+/i.test(u) || /[?&]vacancyid=\d+/i.test(u)) {
    const vacancyId = hhVacancyIdFromUrl(normalizedUrl);
    return {
      source: 'hh',
      externalKey: buildExternalKey('hh', vacancyId),
      vacancyId,
      applyMode: 'hh_auto',
      normalizedUrl,
    };
  }

  const habr = normalizedUrl.match(/career\.habr\.com\/vacancies\/(\d+)/i);
  if (habr) {
    return {
      source: 'habr',
      externalKey: buildExternalKey('habr', habr[1]),
      vacancyId: habr[1],
      applyMode: 'manual_link',
      normalizedUrl,
    };
  }

  const gh = normalizedUrl.match(/boards\.greenhouse\.io\/[^/]+\/jobs\/(\d+)/i);
  if (gh) {
    return {
      source: 'ats',
      externalKey: buildExternalKey('greenhouse', gh[1]),
      vacancyId: null,
      applyMode: 'ats_form',
      normalizedUrl,
    };
  }

  const lever = normalizedUrl.match(/jobs\.lever\.co\/[^/]+\/([a-f0-9-]{36})/i);
  if (lever) {
    return {
      source: 'ats',
      externalKey: buildExternalKey('lever', lever[1]),
      vacancyId: null,
      applyMode: 'ats_form',
      normalizedUrl,
    };
  }

  const ashby = normalizedUrl.match(/jobs\.ashbyhq\.com\/[^/]+\/([a-f0-9-]{36})/i);
  if (ashby) {
    return {
      source: 'ats',
      externalKey: buildExternalKey('ashby', ashby[1]),
      vacancyId: null,
      applyMode: 'ats_form',
      normalizedUrl,
    };
  }

  const workday = normalizedUrl.match(/myworkdayjobs\.com\/[^/]+\/job\/([^/?#]+)/i);
  if (workday) {
    return {
      source: 'ats',
      externalKey: buildExternalKey('workday', workday[1]),
      vacancyId: null,
      applyMode: 'ats_form',
      normalizedUrl,
    };
  }

  const dice = normalizedUrl.match(/dice\.com\/job-detail\/([a-f0-9-]+)/i);
  if (dice) {
    return {
      source: 'jobboard',
      externalKey: buildExternalKey('dice', dice[1]),
      vacancyId: null,
      applyMode: 'manual_link',
      normalizedUrl,
    };
  }

  const jungle = normalizedUrl.match(/welcometothejungle\.com\/[^/]+\/jobs\/([^/?#]+)/i);
  if (jungle) {
    return {
      source: 'jobboard',
      externalKey: buildExternalKey('jungle', jungle[1]),
      vacancyId: null,
      applyMode: 'manual_link',
      normalizedUrl,
    };
  }

  const hash = urlHashKey(normalizedUrl);
  return {
    source: 'unknown',
    externalKey: buildExternalKey('url', hash),
    vacancyId: null,
    applyMode: 'manual_link',
    normalizedUrl,
  };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractJobUrlsFromText(text) {
  const found = String(text || '').match(JOB_URL_RE) || [];
  return [...new Set(found.map((u) => normalizeVacancyUrl(u)).filter(Boolean))];
}

/**
 * @param {object} rec
 */
export function resolveRecordExternalKey(rec) {
  if (rec?.externalKey) return rec.externalKey;
  if (rec?.url) {
    const meta = parseUrlMetadata(rec.url);
    if (meta.externalKey) return meta.externalKey;
  }
  if (rec?.vacancyId) return buildExternalKey(rec?.source || 'hh', rec.vacancyId);
  return '';
}
