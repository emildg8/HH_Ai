import fs from 'fs';

/**
 * Читает файл ключей: одна фраза поиска на строку, # — комментарий до конца строки.
 */
export function loadSearchKeywords(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = [];
  for (const line of raw.split('\n')) {
    const hash = line.indexOf('#');
    const part = (hash === -1 ? line : line.slice(0, hash)).trim();
    if (part) lines.push(part);
  }
  return lines;
}
