/**
 * Заметки по собеседованиям (импорт из HH_INTERVIEW_DIR или data/interview-notes.json).
 */

import fs from 'fs';
import path from 'path';
import { INTERVIEW_NOTES_FILE, DATA_DIR, ROOT } from './paths.mjs';

const DEFAULT_INTERVIEW_DIR = process.env.HH_INTERVIEW_DIR || path.join(ROOT, 'my');

/**
 * @returns {object}
 */
export function loadInterviewNotes() {
  if (fs.existsSync(INTERVIEW_NOTES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(INTERVIEW_NOTES_FILE, 'utf8'));
    } catch {
      /* */
    }
  }
  return { topics: [], importedAt: null, sourceDir: null };
}

export function saveInterviewNotes(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INTERVIEW_NOTES_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Импорт .md/.txt из папки собеседований (без видео).
 * @param {string} [dir]
 */
export function importInterviewNotesFromDir(dir = DEFAULT_INTERVIEW_DIR) {
  if (!fs.existsSync(dir)) {
    return { ok: false, error: `Папка не найдена: ${dir}`, topics: [] };
  }

  const topics = [];
  const walk = (base, depth = 0) => {
    if (depth > 4) return;
    for (const name of fs.readdirSync(base)) {
      const fp = path.join(base, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) {
        walk(fp, depth + 1);
        continue;
      }
      const low = name.toLowerCase();
      if (!low.endsWith('.md') && !low.endsWith('.txt')) continue;
      const text = fs.readFileSync(fp, 'utf8').trim().slice(0, 8000);
      if (text.length < 40) continue;
      topics.push({
        id: path.relative(dir, fp).replace(/\\/g, '/'),
        title: name.replace(/\.(md|txt)$/i, ''),
        excerpt: text.slice(0, 1200),
        path: fp,
      });
    }
  };
  walk(dir);

  const payload = {
    topics,
    importedAt: new Date().toISOString(),
    sourceDir: dir,
  };
  saveInterviewNotes(payload);
  return { ok: true, count: topics.length, ...payload };
}

/** Краткий контекст из заметок/транскриптов для LLM-черновиков. */
export function interviewNotesContextSnippet(maxLen = 2800) {
  const data = loadInterviewNotes();
  const parts = (data.topics || [])
    .slice(0, 10)
    .map((t) => `### ${t.title}\n${String(t.excerpt || '').slice(0, 500)}`);
  return parts.join('\n\n').slice(0, maxLen);
}

/**
 * Уроки и типовые вопросы из analyze-interviews для prep/чатов.
 * @param {{ maxLessons?: number, maxQuestions?: number }} opts
 */
export function interviewPrepInsights(opts = {}) {
  const data = loadInterviewNotes();
  const maxLessons = Math.max(1, Number(opts.maxLessons) || 12);
  const maxQuestions = Math.max(1, Number(opts.maxQuestions) || 15);
  const lessons = [];
  const mistakes = [];
  const typicalQuestions = [];
  const prepTips = [];

  for (const t of data.topics || []) {
    for (const x of t.lessons || []) if (x) lessons.push(String(x).trim());
    for (const x of t.mistakes || []) if (x) mistakes.push(String(x).trim());
    for (const x of t.typicalQuestions || []) if (x) typicalQuestions.push(String(x).trim());
    for (const x of t.prepTips || []) if (x) prepTips.push(String(x).trim());
  }
  for (const x of data.globalPrep || []) if (x) prepTips.push(String(x).trim());

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    lessons: uniq(lessons).slice(0, maxLessons),
    mistakes: uniq(mistakes).slice(0, 8),
    typicalQuestions: uniq(typicalQuestions).slice(0, maxQuestions),
    prepTips: uniq(prepTips).slice(0, 10),
  };
}
