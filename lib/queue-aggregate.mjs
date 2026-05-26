/**
 * Объединение всех файлов очереди и кэша переговоров hh.ru для аналитики
 * (воронка / конверсия по всем вакансиям и резюме, без привязки к активному HH_VACANCIES_QUEUE_FILE).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR, DEFAULT_QUEUE_FILE, ROOT, getQueueFile } from './paths.mjs';
import { loadNegotiationsCache, negotiationStatusToHhSiteState } from './hh-negotiations-sync.mjs';
import { HH_SITE_STATES } from './hh-vacancy-response-state.mjs';

const EXCLUDE_FILES = new Set(['vacancies-queue.example.json']);

const HH_APPLIED_STATUSES = new Set(['submitted', 'viewed', 'invited', 'declined', 'awaiting']);

function vacancyIdOf(rec) {
  let v = String(rec?.vacancyId || '').trim();
  if (!v && rec?.url) {
    const m = String(rec.url).match(/vacancy\/(\d+)/i);
    if (m) v = m[1];
  }
  return v;
}

function recordScore(rec) {
  let s = 0;
  const st = rec.hhApply?.hhSiteState;
  if (st && st !== HH_SITE_STATES.NONE) s += 20;
  if (rec.hhApply?.responseSubmitted || rec.status === 'responded') s += 10;
  if (rec.hhApply?.negotiationStatus) s += 5;
  if (rec.title) s += 1;
  const t = Date.parse(
    rec.hhApply?.hhSiteStateUpdatedAt || rec.hhApply?.lastAt || rec.updatedAt || rec.createdAt || ''
  );
  return { s, t: Number.isFinite(t) ? t : 0 };
}

/**
 * @param {object} a
 * @param {object} b
 */
function mergeVacancyRecords(a, b) {
  const sa = recordScore(a);
  const sb = recordScore(b);
  const pickB = sb.s > sa.s || (sb.s === sa.s && sb.t > sa.t);
  const base = pickB ? { ...b } : { ...a };
  const other = pickB ? a : b;
  base.hhApply = { ...(other.hhApply || {}), ...(base.hhApply || {}) };
  const st = base.hhApply.hhSiteState || other.hhApply?.hhSiteState;
  if (st) base.hhApply.hhSiteState = st;
  if (other.hhApply?.responseSubmitted || base.hhApply?.responseSubmitted) {
    base.hhApply.responseSubmitted = true;
  }
  if (other.status === 'responded') base.status = 'responded';
  base._queueSources = [...new Set([...(a._queueSources || []), ...(b._queueSources || [])])];
  return base;
}

/**
 * Все JSON-очереди в data/ + активная + основная.
 * @returns {string[]}
 */
export function discoverQueueFiles() {
  const files = new Set();
  const active = getQueueFile();
  files.add(path.resolve(active));
  files.add(path.resolve(DEFAULT_QUEUE_FILE));

  if (fs.existsSync(DATA_DIR)) {
    for (const name of fs.readdirSync(DATA_DIR)) {
      if (!name.startsWith('vacancies') || !name.endsWith('.json')) continue;
      if (EXCLUDE_FILES.has(name)) continue;
      files.add(path.join(DATA_DIR, name));
    }
  }

  const envList = (process.env.HH_FUNNEL_QUEUE_FILES || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const rel of envList) {
    files.add(path.isAbsolute(rel) ? path.normalize(rel) : path.normalize(path.join(ROOT, rel)));
  }

  return [...files].filter((f) => fs.existsSync(f));
}

/**
 * @returns {{ records: object[], sources: { file: string, count: number }[], uniqueVacancyIds: number }}
 */
export function loadAllQueuesForAnalytics() {
  /** @type {Map<string, object>} */
  const byVid = new Map();
  /** @type {Map<string, object>} */
  const byRecordId = new Map();
  const sources = [];

  for (const filePath of discoverQueueFiles()) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    const file = path.basename(filePath);
    sources.push({ file, count: arr.length });

    for (const rec of arr) {
      if (!rec || typeof rec !== 'object') continue;
      const tagged = {
        ...rec,
        _queueSources: [...new Set([...(rec._queueSources || []), file])],
      };
      const vid = vacancyIdOf(tagged);
      if (vid) {
        const prev = byVid.get(vid);
        byVid.set(vid, prev ? mergeVacancyRecords(prev, tagged) : tagged);
      } else if (tagged.id) {
        const prev = byRecordId.get(tagged.id);
        byRecordId.set(tagged.id, prev ? mergeVacancyRecords(prev, tagged) : tagged);
      }
    }
  }

  return {
    records: [...byVid.values(), ...byRecordId.values()],
    sources,
    uniqueVacancyIds: byVid.size,
  };
}

/**
 * @param {object} it
 */
function syntheticRecordFromNegotiation(it) {
  const hhState = negotiationStatusToHhSiteState(it.status);
  return {
    vacancyId: it.vacancyId,
    title: it.title,
    company: it.company,
    status: 'responded',
    hhApply: {
      responseSubmitted: true,
      hhSiteState: hhState,
      lastAt: it.appliedAt || it.syncedAt || null,
      negotiationStatus: it.status,
      negotiationStatusRaw: it.statusRaw,
      chatUrl: it.chatUrl,
    },
    _source: 'hh-cache',
    _queueSources: ['hh-negotiations-cache.json'],
  };
}

/**
 * Очереди + переговоры hh.ru (все отклики с аккаунта, любое резюме).
 * @returns {{
 *   records: object[],
 *   sources: { file: string, count: number }[],
 *   uniqueVacancyIds: number,
 *   hhCacheItems: number,
 *   hhOnlyVacancyIds: number,
 * }}
 */
export function loadAnalyticsUnionRecords() {
  const merged = loadAllQueuesForAnalytics();
  /** @type {Map<string, object>} */
  const byVid = new Map();
  for (const rec of merged.records) {
    const vid = vacancyIdOf(rec);
    if (vid) byVid.set(vid, rec);
  }

  const negCache = loadNegotiationsCache();
  const hhItems = negCache.items || [];
  let hhOnlyVacancyIds = 0;

  for (const it of hhItems) {
    const vid = String(it.vacancyId || '').trim();
    if (!vid || !HH_APPLIED_STATUSES.has(it.status)) continue;
    const prev = byVid.get(vid);
    if (!prev) {
      byVid.set(vid, syntheticRecordFromNegotiation(it));
      hhOnlyVacancyIds++;
      continue;
    }
    const hhState = negotiationStatusToHhSiteState(it.status);
    const st = prev.hhApply?.hhSiteState;
    if (!st || st === HH_SITE_STATES.NONE || st === HH_SITE_STATES.ALREADY_APPLIED) {
      prev.hhApply = {
        ...(prev.hhApply || {}),
        hhSiteState: hhState,
        negotiationStatus: it.status,
        negotiationStatusRaw: it.statusRaw,
        chatUrl: it.chatUrl || prev.hhApply?.chatUrl,
      };
    }
    if (!prev.hhApply?.responseSubmitted && HH_APPLIED_STATUSES.has(it.status)) {
      prev.hhApply = { ...(prev.hhApply || {}), responseSubmitted: true };
    }
  }

  const sources = [...merged.sources];
  if (hhItems.length) {
    sources.push({ file: 'hh-negotiations-cache.json', count: hhItems.length });
  }

  return {
    records: [...byVid.values()],
    sources,
    uniqueVacancyIds: byVid.size,
    hhCacheItems: hhItems.length,
    hhOnlyVacancyIds,
  };
}
