/**
 * Статический обход import './…mjs' от точки входа app.js (без esbuild).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const IMPORT_RE = /^\s*import\s+(?:[\s\S]*?\sfrom\s+)?['"](\.\/[^'"]+)['"]/gm;

/**
 * @param {string} filePath абсолютный путь к .mjs
 * @param {Set<string>} seen
 * @param {string[]} missing
 */
function walk(filePath, seen, missing) {
  const norm = filePath.replace(/\\/g, '/');
  if (seen.has(norm)) return;
  seen.add(norm);
  if (!existsSync(filePath)) {
    missing.push(filePath);
    return;
  }
  const src = readFileSync(filePath, 'utf8');
  const dir = dirname(filePath);
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const rel = m[1];
    if (!rel.startsWith('./')) continue;
    walk(join(dir, rel), seen, missing);
  }
}

/**
 * @param {string} publicDir
 * @returns {string[]} сообщения об ошибках
 */
export function collectDashboardImportGraphIssues(publicDir) {
  const entry = join(publicDir, 'app.js');
  const seen = new Set();
  const missing = [];
  walk(entry, seen, missing);
  const issues = [];
  for (const p of missing) {
    issues.push(`app.js graph: нет файла ${p.replace(/\\/g, '/')}`);
  }
  return issues;
}
