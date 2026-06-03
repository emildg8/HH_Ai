import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { prepareCoverLetterForSend } from './cover-letter-prepare.mjs';

const POOL_FILES = [
  path.join(ROOT, 'config', 'cover-letter.txt'),
  path.join(ROOT, 'config', 'cover-letter.example.txt'),
];

const ROLE_LETTER_HINTS = {
  devops: /\bdevops\b|\bsre\b|kubernetes|terraform|grafana|infra/i,
  support: /поддержк|helpdesk|service desk|\bl2\b|\bl3\b|help desk/i,
  data: /data engineer|\bdwh\b|\betl\b|big data/i,
  tam: /account manager|\btam\b|technical account/i,
};

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

/**
 * Письмо из пула с учётом роли вакансии (fallback — round-robin).
 * @param {object} rec
 * @param {number} index
 */
export function pickCoverLetterForVacancy(rec, index) {
  const pool = loadCoverLetterPool();
  if (!pool.length) return '';
  const role = classifyVacancyResumeRole(rec);
  const hint = ROLE_LETTER_HINTS[role];
  if (hint) {
    const matched = pool.filter((b) => hint.test(b.slice(0, 400)));
    if (matched.length) {
      const raw = matched[((index % matched.length) + matched.length) % matched.length];
      return prepareCoverLetterForSend(rec, raw, role);
    }
  }
  const raw = pickCoverLetterFromPool(index);
  return prepareCoverLetterForSend(rec, raw, role);
}
