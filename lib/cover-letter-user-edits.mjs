import fs from 'fs';
import { COVER_LETTER_USER_EDITS_FILE, DATA_DIR } from './paths.mjs';

/**
 * Добавляет фрагмент в jsonl — учитывается при следующей генерации (buildStyleContextBlock).
 */
export function appendCoverLetterUserEditSnippet(snippet) {
  const s = String(snippet || '').trim().slice(0, 4000);
  if (!s) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(
    COVER_LETTER_USER_EDITS_FILE,
    `${JSON.stringify({ at: new Date().toISOString(), snippet: s })}\n`,
    'utf8'
  );
}

/**
 * @param {number} maxLines
 * @returns {string[]}
 */
export function readRecentUserEditSnippets(maxLines = 6) {
  if (!fs.existsSync(COVER_LETTER_USER_EDITS_FILE)) return [];
  const raw = fs.readFileSync(COVER_LETTER_USER_EDITS_FILE, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split('\n').filter(Boolean);
  const tail = lines.slice(-Math.max(1, Math.min(30, maxLines)));
  const out = [];
  for (const line of tail) {
    try {
      const o = JSON.parse(line);
      if (o.snippet && String(o.snippet).trim()) out.push(String(o.snippet).trim());
    } catch {
      /* skip */
    }
  }
  return out;
}
