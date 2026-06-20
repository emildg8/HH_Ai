/**
 * Извлечение текста из резюме (PDF) и структурирование для подготовки к собеседованию.
 */

import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { CV_DIR, DATA_DIR, ROOT } from './paths.mjs';

const BUNDLE_MAX = 56_000;
const PER_FILE_TEXT_MAX = 24_000;
const PROFILES_DIR = path.join(DATA_DIR, 'candidate-profiles');

/**
 * @param {string} filePath
 */
export async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  try {
    const { text } = await parser.getText();
    return normalizeResumeText(text || '');
  } finally {
    await parser.destroy();
  }
}

/**
 * @param {string} text
 */
export function normalizeResumeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} pdfPath
 */
export function sidecarPathForPdf(pdfPath) {
  return `${pdfPath}.txt`;
}

/**
 * @param {string} pdfPath
 * @param {{ force?: boolean }} [opts]
 */
export async function writeSidecarCache(pdfPath, opts = {}) {
  const sidecar = sidecarPathForPdf(pdfPath);
  if (!opts.force && fs.existsSync(sidecar)) {
    const pdfMtime = fs.statSync(pdfPath).mtimeMs;
    const txtMtime = fs.statSync(sidecar).mtimeMs;
    if (txtMtime >= pdfMtime) {
      return { path: sidecar, created: false, text: fs.readFileSync(sidecar, 'utf8') };
    }
  }
  const text = await extractPdfText(pdfPath);
  fs.writeFileSync(sidecar, text, 'utf8');
  return { path: sidecar, created: true, text };
}

/**
 * @param {string} text
 */
export function parseResumeSections(text) {
  const raw = normalizeResumeText(text);
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  const skillsIdx = lines.findIndex((l) => /^Навыки\b/i.test(l));
  const eduIdx = lines.findIndex((l) => /^Образование\b/i.test(l));
  const aboutIdx = lines.findIndex((l) => /^Обо мне\b/i.test(l));

  const headerEnd = [skillsIdx, eduIdx, aboutIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? Math.min(25, lines.length);
  const header = lines.slice(0, headerEnd).join('\n');

  const nameMatch = raw.match(/^([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/m);

  const experience = [];
  const expBlock = raw.split(/Опыт работы/i)[1]?.split(/Образование|Навыки|Обо мне/i)[0] || '';
  const chunks = expBlock.split(/\n(?=[А-Яа-яЁё].{3,40}\n)/).filter((c) => c.trim().length > 40);
  for (const chunk of chunks.slice(0, 12)) {
    const titleLine = chunk.trim().split('\n')[0] || '';
    experience.push({
      title: titleLine.slice(0, 120),
      excerpt: chunk.trim().slice(0, 1500),
    });
  }

  let skills = [];
  if (skillsIdx >= 0) {
    const end = [eduIdx, aboutIdx].filter((i) => i > skillsIdx).sort((a, b) => a - b)[0] ?? lines.length;
    const block = lines.slice(skillsIdx + 1, end).join(' ');
    skills = block.split(/\s{2,}|\t|,/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 80);
  } else {
    const inline = raw.match(/(?:Навыки|Ключевые навыки)\s*\n([\s\S]*?)(?=\n(?:Образование|Опыт работы|Обо мне)\b)/i);
    if (inline?.[1]) {
      skills = inline[1]
        .split(/[,;•·]|\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 80);
    }
  }

  return {
    name: nameMatch?.[1] || '',
    header,
    experience,
    skills: [...new Set(skills)].slice(0, 60),
    education: eduIdx >= 0 ? lines.slice(eduIdx, eduIdx + 15).join('\n') : '',
    about: aboutIdx >= 0 ? lines.slice(aboutIdx).join('\n').slice(0, 3000) : '',
    rawLength: raw.length,
  };
}

/**
 * @param {string} profileId
 */
export function loadCandidateProfile(profileId) {
  const id = String(profileId || '').trim();
  if (!id) return null;
  const fp = path.join(PROFILES_DIR, `${id}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {object} [opts]
 */
export function resolveResumeSource(opts = {}) {
  const profile = opts.profileId ? loadCandidateProfile(opts.profileId) : null;
  const envProfile = process.env.HH_RESUME_PROFILE?.trim();
  const envDir = process.env.HH_RESUME_DIR?.trim();

  const p = profile || (envProfile ? loadCandidateProfile(envProfile) : null);

  let dir = opts.dir;
  if (!dir && p?.resumeDir) {
    dir = path.isAbsolute(p.resumeDir) ? p.resumeDir : path.join(ROOT, p.resumeDir);
  }
  if (!dir && envDir) {
    dir = path.isAbsolute(envDir) ? envDir : path.join(ROOT, envDir);
  }
  if (!dir) dir = CV_DIR;

  const files = opts.files || (p?.resumeFile ? [p.resumeFile] : null);
  return { dir, files, profile: p };
}

function readTextFile(fp, name) {
  const t = fs.readFileSync(fp, 'utf8').trim();
  return t ? `=== ${name} ===\n${t.slice(0, PER_FILE_TEXT_MAX)}` : '';
}

/**
 * @param {object} [opts]
 */
export async function loadResumeBundle(opts = {}) {
  const { dir, files, profile } = resolveResumeSource(opts);
  const warnings = [];
  const parts = [];
  const structured = [];

  if (!fs.existsSync(dir)) {
    return {
      text: '',
      files: [],
      warnings: [`Папка резюме не найдена: ${dir}`],
      profile,
      sections: null,
    };
  }

  let names = fs.readdirSync(dir).sort();
  if (files?.length) {
    names = files.filter((f) => names.includes(f) || fs.existsSync(path.join(dir, f)));
  }

  for (const name of names) {
    const fp = path.join(dir, name);
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) continue;
    const lower = name.toLowerCase();

    try {
      if (lower.endsWith('.txt') && !lower.endsWith('.pdf.txt')) {
        const block = readTextFile(fp, name);
        if (block) parts.push(block);
        structured.push(parseResumeSections(fs.readFileSync(fp, 'utf8')));
      } else if (lower.endsWith('.md')) {
        const block = readTextFile(fp, name);
        if (block) parts.push(block);
        structured.push(parseResumeSections(fs.readFileSync(fp, 'utf8')));
      } else if (lower.endsWith('.pdf')) {
        const sidecar = sidecarPathForPdf(fp);
        let text = '';
        if (fs.existsSync(sidecar)) {
          const pdfMtime = fs.statSync(fp).mtimeMs;
          const txtMtime = fs.statSync(sidecar).mtimeMs;
          text = fs.readFileSync(sidecar, 'utf8');
          if (txtMtime < pdfMtime) {
            const cached = await writeSidecarCache(fp, { force: true });
            text = cached.text;
            warnings.push(`Обновлён кэш текста для «${name}».`);
          }
        } else {
          const cached = await writeSidecarCache(fp);
          text = cached.text;
          if (cached.created) warnings.push(`Создан кэш текста: ${path.basename(cached.path)}`);
        }
        if (text.length < 80) {
          warnings.push(`Мало текста из PDF «${name}» — проверьте файл или добавьте .txt.`);
        }
        if (text) {
          parts.push(`=== ${name} ===\n${text.slice(0, PER_FILE_TEXT_MAX)}`);
          structured.push(parseResumeSections(text));
        }
      }
    } catch (e) {
      warnings.push(`Не удалось прочитать «${name}»: ${e.message}`);
    }
  }

  const text = parts.join('\n\n');
  if (!text.trim()) {
    warnings.push(`Нет подходящих файлов резюме в ${dir} (ожидаются .pdf, .txt или .md).`);
  }

  return {
    text: text.slice(0, BUNDLE_MAX),
    files: names.filter((n) => /\.(pdf|txt|md)$/i.test(n) && !n.endsWith('.pdf.txt')),
    warnings,
    profile,
    sections: structured[0] || null,
    dir,
  };
}

/** Совместимость: прежнее имя функции */
export async function loadCvBundle(opts = {}) {
  return loadResumeBundle(opts);
}
