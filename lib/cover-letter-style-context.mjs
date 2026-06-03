import fs from 'fs';
import path from 'path';
import { loadQueue } from './store.mjs';
import { ROOT } from './paths.mjs';
import { readRecentUserEditSnippets } from './cover-letter-user-edits.mjs';
import { loadStyleExamplesByRole } from './cover-letter-style-by-role.mjs';

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
 * Письма с вакансий, где пришло приглашение — сильные эталоны для промпта.
 * @param {{ maxItems?: number }} opts
 * @returns {string[]}
 */
export function loadStyleExamplesFromInvited(opts = {}) {
  const maxItems = Math.max(1, Math.min(8, Number(opts.maxItems) || 3));
  const q = loadQueue();
  const invited = q.filter(
    (x) =>
      x.hhApply?.hhSiteState === 'invited' &&
      String(x.coverLetter?.approvedText || '').trim().length > 80
  );
  invited.sort((a, b) => {
    const ta = Date.parse(a.hhApply?.hhSiteStateAt || a.hhApply?.lastAt || '') || 0;
    const tb = Date.parse(b.hhApply?.hhSiteStateAt || b.hhApply?.lastAt || '') || 0;
    return tb - ta;
  });
  return invited.slice(0, maxItems).map((x) => {
    const title = String(x.title || '').slice(0, 60);
    return `[Письмо → приглашение: «${title}»]\n${String(x.coverLetter.approvedText).trim()}`;
  });
}

/**
 * Собирает текстовый блок для промпта: примеры из `cover-letter.example.txt`, затем
 * `cover-letter-style-examples.txt`, фрагменты правок, утверждённые письма из очереди.
 * Обрезает по maxChars.
 * @param {{ maxChars?: number, maxItemsFromQueue?: number, record?: object }} opts
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
  const fromInvited = loadStyleExamplesFromInvited({ maxItems: 3 });
  const fromRole = opts.record ? loadStyleExamplesByRole(opts.record, { maxItems: 3 }) : [];
  const fromQueue = loadStyleExamplesFromQueue({ maxItems: maxItemsFromQueue });
  /** @type {Array<{ text: string, weight: number }>} */
  const weighted = [
    ...fromCoverExample.map((text) => ({ text, weight: 2 })),
    ...fromFile.map((text) => ({ text, weight: 2 })),
    ...fromRole.map((text) => ({ text, weight: 3 })),
    ...fromInvited.map((text) => ({ text, weight: 5 })),
    ...fromUserEdits.map((text) => ({ text, weight: 4 })),
    ...fromQueue.map((text) => ({ text, weight: 1 })),
  ];
  weighted.sort((a, b) => b.weight - a.weight);
  const combined = weighted.map((x) => x.text);

  if (!combined.length) return '';

  const parts = [];
  let used = 0;
  let n = 0;
  for (const text of combined) {
    n += 1;
    const header = `[Пример манеры письма ${n} — не копировать заголовок, только стиль]\n`;
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
