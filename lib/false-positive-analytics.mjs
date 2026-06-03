/**
 * False positives: rejected вручную, но eligible по таргетингу + снимки для трендов.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { assessVacancyForApply } from './vacancy-targeting.mjs';

export const FALSE_POSITIVE_SNAPSHOTS_FILE = path.join(
  DATA_DIR,
  'false-positive-snapshots.jsonl'
);

/**
 * @param {object} rec
 */
export function falsePositiveBucketLabel(rec) {
  const t = String(rec?.title || '').toLowerCase();
  if (!t.trim()) return 'прочее';
  if (/\bsenior\b|\blead\b|ведущ|архитект|head of/.test(t)) return 'senior/lead';
  if (
    /разработ|developer|programmer|backend|frontend|full[\s-]?stack|android|ios|java|php|python|go|golang|\.net|c#/.test(
      t
    )
  ) {
    return 'dev вне профиля';
  }
  if (/analyst|аналитик|qa|тестиров|product|project|scrum|agile/.test(t)) return 'смежные IT роли';
  if (/инженер|проектиров|монтаж|сервисн|field|пусконалад|кипиа|scada|плк/.test(t)) {
    return 'индустриальные роли';
  }
  if (/sales|продаж|presale|account|bizdev/.test(t)) return 'sales/presale';
  if (/support|поддержк|helpdesk|service desk/.test(t)) return 'support';
  return 'прочее';
}

/**
 * @param {object[]} rejected
 * @param {object} [prefs]
 * @param {{ limit?: number }} [opts]
 */
export function summarizeFalsePositives(rejected, prefs = {}, opts = {}) {
  const limit = Math.min(10, Math.max(1, Number(opts.limit) || 5));
  /** @type {Record<string, number>} */
  const buckets = {};
  /** @type {Record<string, Array<{ id: string, title: string }>>} */
  const samples = {};
  let totalFalsePositives = 0;

  for (const rec of rejected) {
    const a = assessVacancyForApply(rec, { userApproved: false, prefs });
    if (!a.eligible) continue;
    totalFalsePositives++;
    const key = falsePositiveBucketLabel(rec);
    buckets[key] = (buckets[key] || 0) + 1;
    if (!samples[key]) samples[key] = [];
    if (samples[key].length < 3) {
      samples[key].push({
        id: String(rec.id || ''),
        title: String(rec.title || rec.id || '').slice(0, 90),
      });
    }
  }

  const top = Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
      samples: samples[key] || [],
    }));

  const rate =
    rejected.length > 0 ? Math.round((totalFalsePositives / rejected.length) * 100) : 0;

  return {
    totalRejected: rejected.length,
    totalFalsePositives,
    falsePositiveRate: rate,
    top,
    buckets,
  };
}

/**
 * @param {object} summary
 */
function readLastSnapshots(maxLines = 30) {
  if (!fs.existsSync(FALSE_POSITIVE_SNAPSHOTS_FILE)) return [];
  const lines = fs.readFileSync(FALSE_POSITIVE_SNAPSHOTS_FILE, 'utf8').split(/\n/).filter(Boolean);
  const out = [];
  for (const line of lines.slice(-maxLines)) {
    try {
      out.push(JSON.parse(line));
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * @param {object} current
 * @param {object|null} previous
 */
function buildTrendDelta(current, previous) {
  if (!previous) {
    return {
      deltaTotal: 0,
      deltaRate: 0,
      bucketDeltas: {},
      direction: 'flat',
    };
  }
  const deltaTotal = (current.totalFalsePositives || 0) - (previous.totalFalsePositives || 0);
  const deltaRate = (current.falsePositiveRate || 0) - (previous.falsePositiveRate || 0);
  /** @type {Record<string, number>} */
  const bucketDeltas = {};
  const keys = new Set([
    ...Object.keys(current.buckets || {}),
    ...Object.keys(previous.buckets || {}),
  ]);
  for (const k of keys) {
    const d = (current.buckets?.[k] || 0) - (previous.buckets?.[k] || 0);
    if (d !== 0) bucketDeltas[k] = d;
  }
  const direction = deltaTotal > 0 ? 'up' : deltaTotal < 0 ? 'down' : 'flat';
  return { deltaTotal, deltaRate, bucketDeltas, direction };
}

/**
 * @param {object} summary — результат summarizeFalsePositives
 */
export function computeFalsePositiveTrend(summary) {
  const snaps = readLastSnapshots(40);
  const prev = snaps.length >= 2 ? snaps[snaps.length - 2] : snaps[0] || null;
  const trend = buildTrendDelta(summary, prev);
  return {
    ...trend,
    previousAt: prev?.at || null,
    previousTotal: prev?.totalFalsePositives ?? null,
  };
}

/**
 * Sparkline FP за 7 дней (последний снимок на день).
 * @returns {Array<{ date: string, label: string, total: number | null, rate: number | null }>}
 */
export function computeFalsePositiveSparkline7d() {
  const snaps = readLastSnapshots(200);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  /** @type {Array<{ date: string, label: string, total: number | null, rate: number | null }>} */
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const daySnaps = snaps.filter((s) => String(s.at || '').startsWith(date));
    const latest = daySnaps.length ? daySnaps[daySnaps.length - 1] : null;
    out.push({
      date,
      label: d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit' }).replace('.', ''),
      total: latest?.totalFalsePositives ?? null,
      rate: latest?.falsePositiveRate ?? null,
    });
  }
  return out;
}

/**
 * Сохраняет снимок не чаще раза в час (или при изменении total).
 * @param {object} summary
 */
export function recordFalsePositiveSnapshot(summary) {
  const now = Date.now();
  const snaps = readLastSnapshots(5);
  const last = snaps[snaps.length - 1];
  if (last?.at) {
    const age = now - Date.parse(last.at);
    const sameTotal = last.totalFalsePositives === summary.totalFalsePositives;
    if (age < 3600_000 && sameTotal) return;
  }
  const row = {
    at: new Date().toISOString(),
    totalRejected: summary.totalRejected,
    totalFalsePositives: summary.totalFalsePositives,
    falsePositiveRate: summary.falsePositiveRate,
    buckets: summary.buckets,
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(FALSE_POSITIVE_SNAPSHOTS_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  } catch {
    /* ignore */
  }
}

/**
 * Предложения паттернов из топ-корзин false positives (для learning API).
 * @param {object} summary
 * @param {object} prefs
 * @param {number} limit
 */
export function learningSuggestionsFromFalsePositives(summary, prefs, limit = 4) {
  const existingDev = new Set(
    (prefs.excludeDeveloperRolePatterns || []).map((x) => String(x).toLowerCase())
  );
  const existingSen = new Set(
    (prefs.excludeSeniorRolePatterns || []).map((x) => String(x).toLowerCase())
  );
  const existingIr = new Set(
    (prefs.excludeIrrelevantTitlePatterns || []).map((x) => String(x).toLowerCase())
  );
  /** @type {Array<{ pattern: string, target: string, count: number, sample: string, source: string }>} */
  const out = [];
  const top = summary.top || [];

  for (const row of top) {
    const key = String(row.key || '').toLowerCase();
    const sampleTitle = String(row.samples?.[0]?.title || '').toLowerCase();
    let pattern = '';
    let target = 'irrelevant';
    if (key.includes('senior') || key.includes('lead')) {
      target = 'senior';
      const m = sampleTitle.match(/\b((?:team|tech)\s*lead|head of [a-zа-я]+|senior [a-zа-я]+)/i);
      pattern = (m?.[1] || 'team lead').trim();
      if (existingSen.has(pattern.toLowerCase())) continue;
    } else if (key.includes('dev вне')) {
      target = 'developer';
      const m = sampleTitle.match(
        /\b(go|java|python|android|php|frontend|backend)[\s-]?(?:разработ|developer)?/i
      );
      pattern = (m?.[0] || 'go-разработ').trim();
      if (existingDev.has(pattern.toLowerCase())) continue;
    } else if (key.includes('смежные')) {
      const m = sampleTitle.match(/\b(тестировщик|qa|аналитик|product manager)\b/i);
      pattern = (m?.[1] || 'тестировщик').trim();
      if (existingIr.has(pattern.toLowerCase())) continue;
    } else if (key.includes('индустриальные')) {
      const m = sampleTitle.match(/\b(инженер-проектировщик|сервисный инженер|сметчик)\b/i);
      pattern = (m?.[1] || 'инженер-проектировщик').trim();
      if (existingIr.has(pattern.toLowerCase())) continue;
    } else if (key.includes('sales')) {
      pattern = 'менеджер по продажам';
      if (existingIr.has(pattern)) continue;
    } else {
      continue;
    }
    if (!pattern || pattern.length < 2) continue;
    out.push({
      pattern,
      target,
      count: Number(row.count || 0),
      sample: String(row.samples?.[0]?.title || '').slice(0, 90),
      source: 'false-positive',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {number} totalFalsePositives
 * @param {object} prefs
 */
export function isFalsePositiveGuardrailTriggered(totalFalsePositives, prefs = {}) {
  const max = Number(prefs.batchFalsePositiveMax ?? 20);
  if (!Number.isFinite(max) || max <= 0) return false;
  return Number(totalFalsePositives) > max;
}
