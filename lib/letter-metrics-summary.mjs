/**
 * Сводка по data/letter-metrics.jsonl
 */

import fs from 'fs';
import { LETTER_METRICS_FILE } from './letter-metrics.mjs';

/**
 * @param {{ maxLines?: number }} [opts]
 */
export function summarizeLetterMetrics(opts = {}) {
  const maxLines = Math.max(50, Number(opts.maxLines) || 2000);
  if (!fs.existsSync(LETTER_METRICS_FILE)) {
    return { ok: true, total: 0, byEvent: {}, recent: [] };
  }
  const raw = fs.readFileSync(LETTER_METRICS_FILE, 'utf8');
  const lines = raw.split(/\n/).filter(Boolean);
  const slice = lines.slice(-maxLines);
  /** @type {Record<string, number>} */
  const byEvent = {};
  /** @type {object[]} */
  const recent = [];
  let generateTotal = 0;
  let generateQualityPass = 0;
  let qualityRetry = 0;
  for (const line of slice) {
    try {
      const row = JSON.parse(line);
      const ev = String(row.event || 'unknown');
      byEvent[ev] = (byEvent[ev] || 0) + 1;
      if (ev === 'generate') {
        generateTotal++;
        if (row.qualityPass === true) generateQualityPass++;
      }
      if (ev === 'generate_quality_retry') qualityRetry++;
      if (recent.length < 15) recent.push(row);
      else {
        recent.shift();
        recent.push(row);
      }
    } catch {
      /* ignore */
    }
  }
  return {
    ok: true,
    total: slice.length,
    byEvent,
    recent: recent.reverse(),
    generate: {
      total: generateTotal,
      qualityPass: generateQualityPass,
      qualityPassRate:
        generateTotal > 0 ? Math.round((generateQualityPass / generateTotal) * 100) : null,
      qualityRetry,
    },
  };
}

/**
 * LLM pass rate по дням за 7 дней.
 * @returns {Array<{ date: string, label: string, passRate: number | null }>}
 */
export function computeLetterMetricsSparkline7d() {
  /** @type {Map<string, { pass: number, total: number }>} */
  const byDay = new Map();
  if (fs.existsSync(LETTER_METRICS_FILE)) {
    const raw = fs.readFileSync(LETTER_METRICS_FILE, 'utf8');
    const lines = raw.split(/\n/).filter(Boolean).slice(-5000);
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (row.event !== 'generate') continue;
        const at = String(row.at || row.ts || '');
        const day = at.slice(0, 10);
        if (day.length < 10) continue;
        const cur = byDay.get(day) || { pass: 0, total: 0 };
        cur.total++;
        if (row.qualityPass === true) cur.pass++;
        byDay.set(day, cur);
      } catch {
        /* ignore */
      }
    }
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  /** @type {Array<{ date: string, label: string, passRate: number | null }>} */
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const row = byDay.get(date);
    out.push({
      date,
      label: d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit' }).replace('.', ''),
      passRate: row && row.total > 0 ? Math.round((row.pass / row.total) * 100) : null,
    });
  }
  return out;
}
