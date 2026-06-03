/**
 * Отчёт по качеству писем после батча — data/letter-quality-report.json
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';

export const LETTER_QUALITY_REPORT_FILE = path.join(DATA_DIR, 'letter-quality-report.json');

/**
 * @param {{
 *   startedAt?: string,
 *   finishedAt?: string,
 *   batchScope?: string,
 *   skipReasons?: Record<string, number>,
 *   items?: Array<{ title?: string, status: string, reason?: string }>,
 * }} batchReport
 */
export function writeLetterQualityReport(batchReport) {
  const items = Array.isArray(batchReport?.items) ? batchReport.items : [];
  const letterItems = items.filter(
    (it) => it.status === 'letter-quality' || /письм/i.test(String(it.reason || ''))
  );
  const skipReasons = batchReport?.skipReasons || {};
  const payload = {
    version: 1,
    finishedAt: batchReport?.finishedAt || new Date().toISOString(),
    startedAt: batchReport?.startedAt,
    batchScope: batchReport?.batchScope || '',
    letterQualitySkips: Number(skipReasons['letter-quality'] || letterItems.length),
    skipReasons: Object.fromEntries(
      Object.entries(skipReasons).filter(([k]) => /letter|письм/i.test(k))
    ),
    samples: letterItems.slice(-15).map((it) => ({
      id: String(it.id || it.vacancyId || ''),
      title: String(it.title || '').slice(0, 100),
      reason: String(it.reason || it.status || '').slice(0, 160),
    })),
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LETTER_QUALITY_REPORT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

export function readLetterQualityReport() {
  try {
    if (!fs.existsSync(LETTER_QUALITY_REPORT_FILE)) return null;
    return JSON.parse(fs.readFileSync(LETTER_QUALITY_REPORT_FILE, 'utf8'));
  } catch {
    return null;
  }
}
