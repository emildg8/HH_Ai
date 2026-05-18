import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

const POOL_FILES = [
  path.join(ROOT, 'config', 'cover-letter.txt'),
  path.join(ROOT, 'config', 'cover-letter.example.txt'),
];

/**
 * Блоки сопроводительных из config/cover-letter.txt (разделитель --- на отдельной строке).
 */
export function loadCoverLetterPool() {
  for (const fp of POOL_FILES) {
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, 'utf8');
    const blocks = raw
      .split(/\r?\n---\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 80);
    if (blocks.length) return blocks;
  }
  return [];
}

export function pickCoverLetterFromPool(index) {
  const pool = loadCoverLetterPool();
  if (!pool.length) return '';
  return pool[((index % pool.length) + pool.length) % pool.length];
}
