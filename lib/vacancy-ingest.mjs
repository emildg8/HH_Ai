/**
 * Единый контур ingest: нормализация → фильтры → score → очередь.
 */

import crypto from 'crypto';
import { runHardFilters } from './filters.mjs';
import { scoreVacancyLocally } from './local-vacancy-score.mjs';
import { loadPreferences } from './preferences.mjs';
import { addVacancyRecord, loadQueue, knownExternalKeys } from './store.mjs';
import { parseUrlMetadata, resolveRecordExternalKey } from './vacancy-id.mjs';
import { scoreSource } from './source-quality.mjs';
import { loadCvBundle } from './cv-load.mjs';
import { emitConversionEvent, runConversionHooks } from './conversion-glue.mjs';

/**
 * Минимальное описание для ingest без полного парсинга (Telegram URL, jobboards).
 * @param {object} parsed
 * @param {string} source
 */
function ensureIngestDescription(parsed, source) {
  const d = String(parsed.description || '').trim();
  if (d.length >= 40) return parsed;
  const title = String(parsed.title || '').trim();
  const url = String(parsed.url || '').trim();
  const tail = title.length >= 8 ? `${title}.` : url ? `Ссылка: ${url}.` : `Импорт (${source}).`;
  const fallback = `${tail} Канал ${source} — описание уточните в карточке или при обогащении.`;
  return {
    ...parsed,
    description: d.length > 0 ? `${d} ${fallback}`.trim().slice(0, 6000) : fallback,
  };
}

/**
 * @param {object} payload
 * @param {string} [payload.source]
 * @param {string} [payload.externalKey]
 * @param {string} payload.url
 * @param {string} [payload.title]
 * @param {string} [payload.company]
 * @param {string} [payload.description]
 * @param {string} [payload.salaryRaw]
 * @param {string} [payload.publishedAt]
 * @param {string} [payload.searchQuery]
 * @param {object} [payload.ingestMeta]
 * @param {{ prefs?: object, skipFilters?: boolean, skipScore?: boolean, cvBundle?: object }} [opts]
 */
export async function ingestVacancyPayload(payload, opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  const urlMeta = parseUrlMetadata(payload.url || '');
  const url = urlMeta.normalizedUrl || payload.url;
  const source = payload.source || urlMeta.source || 'unknown';
  const externalKey = payload.externalKey || urlMeta.externalKey;
  const applyMode = payload.applyMode || urlMeta.applyMode;
  const vacancyId = payload.vacancyId ?? urlMeta.vacancyId ?? null;

  if (!url) {
    return { added: false, reason: 'empty_url' };
  }

  const known = knownExternalKeys();
  if (externalKey && known.has(externalKey)) {
    return { added: false, reason: 'duplicate_external_key', externalKey };
  }

  const parsed = ensureIngestDescription(
    {
      title: payload.title || '',
      company: payload.company || '',
      salaryRaw: payload.salaryRaw || '',
      description: payload.description || '',
      employment: payload.employment || '',
      workFormat: payload.workFormat || '',
      address: payload.address || '',
      url,
    },
    source
  );

  let filter = { pass: true, stage: 'ingest', reason: 'ok' };
  if (!opts.skipFilters) {
    filter = runHardFilters(parsed, prefs);
    if (!filter.pass) {
      return { added: false, reason: filter.reason, stage: filter.stage };
    }
  }

  let cvBundle = opts.cvBundle;
  if (!cvBundle && !opts.skipScore) {
    try {
      cvBundle = await loadCvBundle();
    } catch {
      cvBundle = { text: '' };
    }
  }

  const vacancyPayload = {
    title: parsed.title,
    company: parsed.company,
    salaryRaw: parsed.salaryRaw,
    description: parsed.description,
    url,
  };

  let llm = { scoreOverall: 0, scoreVacancy: 0, scoreCvMatch: 0, summary: '', risks: '', matchCv: 'unknown', tags: [] };
  if (!opts.skipScore) {
    llm = scoreVacancyLocally(vacancyPayload, cvBundle);
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    source,
    externalKey,
    vacancyId,
    url,
    applyMode,
    ingestMeta: payload.ingestMeta || {},
    searchQuery: payload.searchQuery || '',
    title: parsed.title,
    company: parsed.company,
    salaryRaw: parsed.salaryRaw,
    salaryEstimate: filter.salaryEstimate,
    remoteNote: filter.workFormatNote || filter.remoteReason,
    workFormat: filter.workFormat,
    salaryNote: filter.salaryReason,
    employment: parsed.employment || '',
    workFormatLine: parsed.workFormat || '',
    address: parsed.address || '',
    descriptionPreview: String(parsed.description).slice(0, 600),
    descriptionForLlm: String(parsed.description).slice(0, 6000),
    llmProvider: 'local-heuristic',
    scoreVacancy: llm.scoreVacancy,
    scoreCvMatch: llm.scoreCvMatch,
    scoreOverall: llm.scoreOverall,
    geminiScore: llm.scoreOverall,
    geminiSummary: llm.summary || '',
    geminiRisks: llm.risks || '',
    geminiMatchCv: llm.matchCv || 'unknown',
    geminiTags: llm.tags || [],
    status: 'pending',
    feedbackReason: '',
    publishedAt: payload.publishedAt || now,
    createdAt: now,
    updatedAt: null,
  };

  const quality = scoreSource(record, { allRecords: loadQueue(), prefs });
  Object.assign(record, {
    sourceQualityTier: quality.sourceQualityTier,
    sourceQualityScore: quality.sourceQualityScore,
    freshnessHours: quality.freshnessHours,
  });

  const tierLimit = prefs.ingestMaxTierCPerDay;
  if (tierLimit && quality.sourceQualityTier === 'C') {
    const todayC = loadQueue().filter(
      (r) =>
        r.sourceQualityTier === 'C' &&
        String(r.createdAt || '').slice(0, 10) === now.slice(0, 10)
    ).length;
    if (todayC >= tierLimit) {
      return { added: false, reason: 'tier_c_daily_limit', tier: 'C' };
    }
  }

  if (!addVacancyRecord(record)) {
    return { added: false, reason: 'duplicate', externalKey };
  }

  const ingestPayload = {
    recordId: record.id,
    source: record.source,
    externalKey: record.externalKey,
    employerId: record.company || undefined,
    applyMode: record.applyMode,
    sourceQualityTier: quality?.sourceQualityTier,
    scoreOverall: record.scoreOverall,
  };
  emitConversionEvent('vacancy.ingested', ingestPayload, {
    correlationId: record.id,
    recordId: record.id,
    phase: 'vacancy.ingested',
  });
  await runConversionHooks('vacancy.ingested', { record, quality, payload: ingestPayload });

  return { added: true, record, quality };
}

/**
 * @param {string} url
 * @param {object} [opts]
 */
export async function ingestUrl(url, opts = {}) {
  const meta = parseUrlMetadata(url);
  const payload = { url };
  if (!opts.title && meta.vacancyId && meta.source === 'hh') {
    payload.title = `Вакансия hh ${meta.vacancyId}`;
  }
  return ingestVacancyPayload(payload, opts);
}

/**
 * @param {string} text
 * @param {object} [opts]
 */
export async function ingestUrlsFromText(text, opts = {}) {
  const { extractJobUrlsFromText } = await import('./vacancy-id.mjs');
  const urls = extractJobUrlsFromText(text);
  const results = [];
  for (const url of urls) {
    results.push({ url, ...(await ingestUrl(url, opts)) });
  }
  return results;
}

/**
 * @param {object} rec
 */
export function enrichRecordWithSourceMeta(rec) {
  const externalKey = resolveRecordExternalKey(rec);
  const meta = rec?.url ? parseUrlMetadata(rec.url) : {};
  const patch = {
    source: rec?.source || meta.source || 'hh',
    externalKey: externalKey || rec?.externalKey,
    applyMode: rec?.applyMode || meta.applyMode || 'hh_auto',
  };
  const quality = scoreSource({ ...rec, ...patch });
  return { ...patch, ...quality };
}
