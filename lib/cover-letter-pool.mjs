import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

function poolFiles() {
  const custom = String(process.env.HH_COVER_LETTER_FILE || '').trim();
  return [
    ...(custom ? [path.resolve(ROOT, custom)] : []),
    path.join(ROOT, 'config', 'cover-letter.txt'),
    path.join(ROOT, 'config', 'cover-letter.example.txt'),
  ];
}

/**
 * Блоки сопроводительных из config/cover-letter.txt (разделитель --- на отдельной строке).
 */
export function loadCoverLetterPool() {
  for (const fp of poolFiles()) {
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

/** Подстановка плейсхолдеров шаблона: {{ROLE}}, {{COMPANY}}. */
export function fillCoverLetterPlaceholders(text, vars = {}) {
  const role = String(vars.role || '').trim();
  const company = String(vars.company || '').trim();
  let out = String(text || '');
  out = role
    ? out.replace(/\{\{ROLE\}\}/g, role)
    : out.replace(/\s*(на|в)?\s*(позицию|вакансию|роль)?\s*\{\{ROLE\}\}/gi, '');
  out = out.replace(/\{\{COMPANY\}\}/g, company);
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

export function pickCoverLetterFromPool(index, vars = {}) {
  const pool = loadCoverLetterPool();
  if (!pool.length) return '';
  const raw = pool[((index % pool.length) + pool.length) % pool.length];
  return fillCoverLetterPlaceholders(raw, vars);
}
