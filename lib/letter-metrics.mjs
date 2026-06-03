/**
 * События качества сопроводительных (JSONL для аналитики).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';

export const LETTER_METRICS_FILE = path.join(DATA_DIR, 'letter-metrics.jsonl');

/**
 * @param {string} event
 * @param {Record<string, unknown>} payload
 */
export function appendLetterMetric(event, payload = {}) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event: String(event),
    ...payload,
  });
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LETTER_METRICS_FILE, `${line}\n`, 'utf8');
  } catch {
    /* ignore */
  }
}
