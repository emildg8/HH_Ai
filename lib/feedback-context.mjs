import fs from 'fs';
import { FEEDBACK_FILE, DATA_DIR } from './paths.mjs';

export function loadRecentFeedback(maxLines = 25) {
  if (!fs.existsSync(FEEDBACK_FILE)) return [];
  const lines = fs.readFileSync(FEEDBACK_FILE, 'utf8').trim().split('\n').filter(Boolean);
  const tail = lines.slice(-maxLines);
  return tail.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function appendFeedback(entry) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(FEEDBACK_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * Сводка по feedback.jsonl для дашборда и аналитики.
 * @param {{ maxLines?: number }} [opts]
 */
export function computeFeedbackStats(opts = {}) {
  const maxLines = Math.max(10, Number(opts.maxLines) || 400);
  const entries = loadRecentFeedback(maxLines);
  const count = (action) => entries.filter((e) => e.action === action).length;
  return {
    total: entries.length,
    invited: count('invited'),
    declined: count('declined'),
    approved: count('approve'),
    rejected: count('reject'),
    lastAt: entries.length ? entries[entries.length - 1]?.at || null : null,
  };
}
