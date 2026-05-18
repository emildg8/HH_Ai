import fs from 'fs';
import path from 'path';
import { loadQueue } from './store.mjs';
import { ROOT } from './paths.mjs';
import { readRecentUserEditSnippets } from './cover-letter-user-edits.mjs';

const STYLE_EXAMPLES_FILE = path.join(ROOT, 'config', 'cover-letter-style-examples.txt');
const COVER_LETTER_EXAMPLE_FILE = path.join(ROOT, 'config', 'cover-letter.example.txt');

/**
 * Примеры из `config/cover-letter.example.txt` — блоки через строку `---` на отдельной строке.
 * Используются при генерации сопроводительных как эталоны стиля (приоритетно).
 * @returns {string[]}
 */
export function loadCoverLetterExampleBlocks() {
  if (!fs.existsSync(COVER_LETTER_EXAMPLE_FILE)) return [];
  const raw = fs.readFileSync(COVER_LETTER_EXAMPLE_FILE, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split(/\n---\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Письма из файла: блоки через строку из трёх дефисов --- на отдельной строке.
 * @returns {string[]}
 */
export function loadStyleExamplesFromFile() {
  if (!fs.existsSync(STYLE_EXAMPLES_FILE)) return [];
  const raw = fs.readFileSync(STYLE_EXAMPLES_FILE, 'utf8');
  return raw
    .split(/\n---\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Утверждённые письма из очереди, новые первыми.
 * @param {{ maxItems?: number }} opts
 * @returns {string[]}
 */
export function loadStyleExamplesFromQueue(opts = {}) {
  const maxItems = Math.max(1, Math.min(20, Number(opts.maxItems) || 4));
  const q = loadQueue();
  const withText = q.filter(
    (x) =>
      x.coverLetter?.status === 'approved' && String(x.coverLetter?.approvedText || '').trim()
  );
  withText.sort((a, b) => {
    const ta = new Date(a.coverLetter?.updatedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.coverLetter?.updatedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });
  return withText.slice(0, maxItems).map((x) => String(x.coverLetter.approvedText).trim());
}

/**
 * Собирает текстовый блок для промпта: примеры из `cover-letter.example.txt`, затем
 * `cover-letter-style-examples.txt`, фрагменты правок, утверждённые письма из очереди.
 * Обрезает по maxChars.
 * @param {{ maxChars?: number, maxItemsFromQueue?: number }} opts
 * @returns {string}
 */
export function buildStyleContextBlock(opts = {}) {
  const maxChars = Math.max(500, Math.min(12_000, Number(opts.maxChars) || 5000));
  const maxItemsFromQueue = Math.max(1, Math.min(20, Number(opts.maxItemsFromQueue) || 4));

  const fromCoverExample = loadCoverLetterExampleBlocks();
  const fromFile = loadStyleExamplesFromFile();
  const fromUserEdits = readRecentUserEditSnippets(6).map(
    (s) => `[Фрагмент после правок пользователя в дашборде — стиль и формулировки]\n${s}`
  );
  const fromQueue = loadStyleExamplesFromQueue({ maxItems: maxItemsFromQueue });
  const combined = [...fromCoverExample, ...fromFile, ...fromUserEdits, ...fromQueue];

  if (!combined.length) return '';

  const parts = [];
  let used = 0;
  let n = 0;
  for (const text of combined) {
    n += 1;
    const header = `### Эталон ${n} (только стиль и манера, не содержание вакансии)\n`;
    const chunk = `${header}${text}\n\n`;
    if (used + chunk.length > maxChars) {
      const rest = maxChars - used - header.length;
      if (rest < 80) break;
      parts.push(`${header}${text.slice(0, rest)}…\n`);
      break;
    }
    parts.push(chunk);
    used += chunk.length;
  }

  return parts.join('').trim();
}
