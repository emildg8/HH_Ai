/**
 * Поиск записи вакансии: очередь, vacancyId, кэш переговоров hh.ru.
 */

import { getVacancyRecord, loadQueue } from './store.mjs';
import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import {
  loadNegotiationsCache,
  parseNegotiationStatusText,
  negotiationStatusToHhSiteState,
} from './hh-negotiations-sync.mjs';

/** @param {object} rec */
export function vacancyIdFromRecord(rec) {
  let v = String(rec?.vacancyId || '').trim();
  if (!v && rec?.url) {
    const m = String(rec.url).match(/vacancy\/(\d+)/i);
    if (m) v = m[1];
  }
  return v;
}

/** Стабильный id для API/UI (очередь или hh-neg-{vacancyId}). */
export function stableVacancyRecordId(rec) {
  if (rec?.id) return String(rec.id);
  const vid = vacancyIdFromRecord(rec);
  if (vid) return `hh-neg-${vid}`;
  return '';
}

/**
 * @param {string} recordId — id очереди, hh-neg-{vacancyId} или числовой vacancyId
 * @returns {object|null}
 */
export function resolveVacancyRecord(recordId) {
  if (!recordId) return null;
  const direct = getVacancyRecord(recordId);
  if (direct) return direct;

  const id = String(recordId);
  let vacancyId = '';
  if (id.startsWith('hh-neg-')) {
    vacancyId = id.slice('hh-neg-'.length);
  } else if (/^\d+$/.test(id)) {
    vacancyId = id;
  } else {
    return null;
  }

  const fromQueue = loadQueue().find((x) => String(x.vacancyId) === vacancyId);
  if (fromQueue) return fromQueue;

  const cache = loadNegotiationsCache();
  const it = (cache.items || []).find((x) => String(x.vacancyId) === vacancyId);
  if (it) {
    const st = parseNegotiationStatusText(it.statusRaw || it.status || '');
    return {
      id: `hh-neg-${vacancyId}`,
      vacancyId,
      title: it.title || `Вакансия ${vacancyId}`,
      company: it.company || '',
      url: `https://hh.ru/vacancy/${vacancyId}`,
      status: 'responded',
      hhApply: {
        hhSiteState: negotiationStatusToHhSiteState(st),
        hhSiteStateSource: 'negotiations-cache-only',
        chatUrl: it.chatUrl || '',
        responseSubmitted: true,
        lastAt: it.appliedAt || it.syncedAt || null,
      },
    };
  }

  const { records } = loadAnalyticsUnionRecords();
  const fromUnion = records.find((r) => vacancyIdFromRecord(r) === vacancyId);
  if (fromUnion) {
    return { ...fromUnion, id: stableVacancyRecordId(fromUnion) };
  }

  return null;
}
