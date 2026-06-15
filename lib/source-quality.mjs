/**
 * Оценка качества канала/карточки до отклика (tier A/B/C/D).
 */

import { getEmployerScore } from './employer-intelligence.mjs';

const OUTSTAFF_RE =
  /аутстафф|outstaff|staffing|аутсорс|рекрутингов|кадров(ое|ого)\s+агент|huntflow|подбор\s+персонал/i;

/**
 * @param {string|Date|null} publishedAt
 */
export function computeFreshnessHours(publishedAt) {
  if (!publishedAt) return null;
  const t = Date.parse(String(publishedAt));
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / (60 * 60 * 1000)));
}

/**
 * @param {object} record
 * @param {{ allRecords?: object[], prefs?: object }} [opts]
 */
export function scoreSource(record, opts = {}) {
  const source = String(record?.source || 'hh').toLowerCase();
  const freshnessHours = computeFreshnessHours(record?.publishedAt || record?.createdAt);
  const companyBlob = [record?.company, record?.title, record?.descriptionPreview].filter(Boolean).join(' ');
  const isOutstaff = OUTSTAFF_RE.test(companyBlob) || record?.ingestMeta?.employerType === 'outstaff';
  const employerScore = getEmployerScore(record?.company, opts.allRecords || []);

  let tier = 'C';
  let score = 50;
  const reasons = [];

  if (source === 'ats') {
    tier = 'A';
    score = 85;
    reasons.push('прямой ATS');
  } else if (source === 'hh') {
    if (freshnessHours != null && freshnessHours <= 72 && !isOutstaff) {
      tier = 'A';
      score = 80;
      reasons.push('свежая hh');
    } else if (freshnessHours != null && freshnessHours > 168) {
      tier = 'C';
      score = 35;
      reasons.push('старая hh');
    } else {
      tier = isOutstaff ? 'C' : 'B';
      score = isOutstaff ? 30 : 60;
    }
  } else if (source === 'habr') {
    tier = 'B';
    score = 70;
    reasons.push('Habr IT');
  } else if (source === 'telegram') {
    tier = 'C';
    score = 40;
    reasons.push('Telegram агрегатор');
  } else if (source === 'jobboard') {
    tier = 'D';
    score = 45;
    reasons.push('международная доска');
  }

  if (isOutstaff) {
    tier = 'C';
    score = Math.min(score, 25);
    reasons.push('аутстафф/агентство');
  }

  if (freshnessHours != null && freshnessHours <= 72) {
    score += 10;
    reasons.push('свежесть <72ч');
  } else if (freshnessHours != null && freshnessHours > 336) {
    score -= 15;
    reasons.push('старше 14 дней');
  }

  score = Math.round(score * 0.7 + employerScore * 0.3);
  score = Math.max(0, Math.min(100, score));

  if (employerScore >= 70 && tier === 'B') tier = 'A';
  if (employerScore < 25 && tier === 'A') tier = 'B';

  return {
    sourceQualityTier: tier,
    sourceQualityScore: score,
    freshnessHours,
    reasons,
    isOutstaff,
    employerScore,
  };
}

/**
 * @param {object[]} records
 * @param {{ limit?: number, tiers?: string[] }} [opts]
 */
export function listTopTierRecords(records, opts = {}) {
  const tiers = opts.tiers || ['A', 'B'];
  const limit = opts.limit ?? 20;
  return (records || [])
    .map((rec) => ({ rec, q: scoreSource(rec, { allRecords: records }) }))
    .filter(({ rec, q }) => tiers.includes(q.sourceQualityTier) && rec?.status !== 'responded')
    .sort((a, b) => {
      const tierOrder = { A: 0, B: 1, C: 2, D: 3 };
      const td = tierOrder[a.q.sourceQualityTier] - tierOrder[b.q.sourceQualityTier];
      if (td !== 0) return td;
      const fa = a.q.freshnessHours ?? 9999;
      const fb = b.q.freshnessHours ?? 9999;
      if (fa !== fb) return fa - fb;
      return (b.rec?.scoreOverall || 0) - (a.rec?.scoreOverall || 0);
    })
    .slice(0, limit)
    .map(({ rec, q }) => ({ ...rec, ...q }));
}
