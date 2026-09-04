import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { CV_DIR, ROOT } from './paths.mjs';

/** Папка CV: HH_CV_DIR из профиля, иначе общая CV/. */
function cvDir() {
  const v = (process.env.HH_CV_DIR || '').trim();
  return v ? path.resolve(ROOT, v) : CV_DIR;
}

const BUNDLE_MAX = 56_000;
const PER_FILE_TEXT_MAX = 24_000;

async function extractPdf(filePath) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  try {
    const { text } = await parser.getText();
    return (text || '').replace(/\s+/g, ' ').trim();
  } finally {
    await parser.destroy();
  }
}

function readTextFile(fp, name) {
  const t = fs.readFileSync(fp, 'utf8').trim();
  return t ? `=== ${name} ===\n${t.slice(0, PER_FILE_TEXT_MAX)}` : '';
}

/**
 * Собирает текст всех .pdf, .txt и .md в папке CV (по алфавиту).
 */
export async function loadCvBundle() {
  if (!fs.existsSync(cvDir())) {
    return { text: '', files: [], warnings: ['Папка CV не найдена'] };
  }
  const names = fs.readdirSync(cvDir()).sort();
  const warnings = [];
  const parts = [];

  for (const name of names) {
    const fp = path.join(cvDir(), name);
    if (!fs.statSync(fp).isFile()) continue;
    const lower = name.toLowerCase();
    try {
      if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        const block = readTextFile(fp, name);
        if (block) parts.push(block);
      } else if (lower.endsWith('.pdf')) {
        const t = await extractPdf(fp);
        if (t.length < 80) {
          warnings.push(`Мало текста из PDF «${name}» — при необходимости добавьте .md или .txt.`);
        }
        if (t) parts.push(`=== ${name} ===\n${t.slice(0, PER_FILE_TEXT_MAX)}`);
      }
    } catch (e) {
      warnings.push(`Не удалось прочитать «${name}»: ${e.message}`);
    }
  }

  const text = parts.join('\n\n');
  if (!text.trim()) {
    warnings.push('Нет ни одного подходящего CV в CV/ (ожидаются .pdf, .txt или .md).');
  }

  return {
    text: text.slice(0, BUNDLE_MAX),
    files: names.filter((n) => /\.(pdf|txt|md)$/i.test(n)),
    warnings,
  };
}
