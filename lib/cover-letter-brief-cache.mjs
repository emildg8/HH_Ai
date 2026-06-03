/**
 * Кэш LLM-брифа «вакансия ↔ резюме» на карточке (без повторного запроса при той же вакансии).
 */

import crypto from 'node:crypto';

/**
 * @param {object} record
 * @param {string} desc
 */
export function matchingBriefCacheKey(record, desc) {
  const blob = [
    String(record?.id || ''),
    String(record?.title || '').slice(0, 200),
    String(desc || '').slice(0, 12_000),
  ].join('\n');
  return crypto.createHash('sha256').update(blob, 'utf8').digest('hex').slice(0, 20);
}

/**
 * @param {object} record
 * @param {string} desc
 * @returns {object|null}
 */
export function getCachedMatchingBrief(record, desc) {
  const cached = record?.coverLetter?.matchingBrief;
  if (!cached?.brief || typeof cached.brief !== 'object') return null;
  const key = matchingBriefCacheKey(record, desc);
  if (String(cached.key || '') !== key) return null;
  const maxAgeMs = Math.max(
    3600_000,
    Number(process.env.COVER_LETTER_BRIEF_CACHE_MS) || 14 * 24 * 3600_000
  );
  const at = Date.parse(cached.cachedAt || '');
  if (at && Date.now() - at > maxAgeMs) return null;
  return cached.brief;
}

/**
 * @param {object} record
 * @param {string} desc
 * @param {object} brief
 */
export function buildMatchingBriefPatch(record, desc, brief) {
  return {
    coverLetter: {
      ...(record.coverLetter || {}),
      matchingBrief: {
        key: matchingBriefCacheKey(record, desc),
        brief,
        cachedAt: new Date().toISOString(),
      },
    },
  };
}
