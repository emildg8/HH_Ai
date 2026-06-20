/**
 * Полный контекст кандидата для генерации ответов на собеседовании.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadCvBundle } from './cv-load.mjs';
import { loadInterviewNotes, interviewPrepInsights } from './interview-notes.mjs';
import { loadEmployerRagBlock } from './employer-rag.mjs';
import { loadPreferences } from './preferences.mjs';
import { findPrepContextForTranscriptBase, getInterviewDataDir } from './interview-prep-context.mjs';
import { ROOT } from './paths.mjs';

const CHUNK_SIZE = 400;

/** @type {Map<string, object>} */
const sessionCache = new Map();

function hashText(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex').slice(0, 16);
}

function walkTextFiles(dir, maxDepth = 4, depth = 0) {
  const parts = [];
  if (!dir || !fs.existsSync(dir) || depth > maxDepth) return parts;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      parts.push(...walkTextFiles(fp, maxDepth, depth + 1));
      continue;
    }
    const low = name.toLowerCase();
    if (!low.endsWith('.md') && !low.endsWith('.txt')) continue;
    if (/transcript|\.srt$/i.test(low)) continue;
    const text = fs.readFileSync(fp, 'utf8').trim();
    if (text.length < 30) continue;
    parts.push({ path: fp, title: name, text: text.slice(0, 6000) });
  }
  return parts;
}

function loadVoiceProfile() {
  const fp = path.join(ROOT, 'data', 'candidate-voice-profile.json');
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function extractFocusFromText(text, title = '') {
  const blob = `${title} ${text}`.toLowerCase();
  const tags = [];
  const patterns = [
    ['ITIL', /itil/],
    ['инциденты', /инцидент/],
    ['VMware', /vmware|виртуализац/],
    ['Kubernetes', /kubernetes|k8s/],
    ['CI/CD', /ci\/?cd|gitlab|jenkins/],
    ['мониторинг', /мониторинг|grafana|zabbix|prometheus/],
    ['клиентский сервис', /клиент|tam|account/],
    ['DevOps', /devops/],
  ];
  for (const [label, re] of patterns) {
    if (re.test(blob)) tags.push(label);
  }
  return tags.slice(0, 6);
}

/**
 * @param {object} opts
 */
export async function buildCandidateContext(opts = {}) {
  const cacheKey = [
    opts.vacancyId || '',
    opts.recordId || '',
    hashText(opts.prepContext),
    opts.interviewStage || '',
    hashText(JSON.stringify(opts.prepPack || null)),
  ].join('|');
  if (!opts.force && sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey);
  }

  const cvBundle = opts.cvText ? { text: opts.cvText } : await loadCvBundle();
  const notes = loadInterviewNotes();
  const insights = interviewPrepInsights();
  const voice = loadVoiceProfile();

  let prepSummary = String(opts.prepContext || '').trim();
  if (!prepSummary && opts.transcriptBase) {
    prepSummary = findPrepContextForTranscriptBase(opts.transcriptBase);
  }

  const extraDirs = String(process.env.HH_CANDIDATE_CONTEXT_DIRS || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const myDir = getInterviewDataDir();
  const extraTexts = [];
  for (const dir of [myDir, ...extraDirs]) {
    for (const item of walkTextFiles(dir)) {
      if (item.title.toLowerCase().includes('interview_summary')) continue;
      extraTexts.push(item);
    }
  }

  const prepPack = opts.prepPack || null;
  const vacancyText = String(opts.vacancyText || opts.description || '').trim();
  const title = opts.title || prepPack?.vacancyTitle || '';
  const company = opts.company || prepPack?.company || '';

  let employerRagBlock = '';
  try {
    employerRagBlock = loadEmployerRagBlock(company, { prefs: loadPreferences() });
  } catch {
    /* optional */
  }

  const focus =
    (opts.focus && opts.focus.length ? opts.focus : null) ||
    extractFocusFromText(`${vacancyText}\n${prepSummary}`, title);

  const starCases = buildStarCases(cvBundle.text, notes, prepPack);

  const bundle = {
    cvText: cvBundle.text.slice(0, 12000),
    vacancyText: vacancyText.slice(0, 8000),
    prepSummary: [prepSummary, employerRagBlock].filter(Boolean).join('\n\n').slice(0, 5000),
    employerRagBlock: employerRagBlock.slice(0, 1400),
    notesSnippet: (notes.topics || [])
      .slice(0, 8)
      .map((t) => `### ${t.title}\n${(t.excerpt || '').slice(0, 400)}`)
      .join('\n\n')
      .slice(0, 3500),
    portfolioText: extraTexts
      .filter((x) => /portfolio|project|кейс/i.test(x.title))
      .map((x) => x.text)
      .join('\n')
      .slice(0, 4000),
    trainingText: extraTexts
      .filter((x) => /cert|курс|обучен/i.test(x.title + x.path))
      .map((x) => x.text)
      .join('\n')
      .slice(0, 3000),
    lessons: insights.lessons.slice(0, 6),
    mistakes: insights.mistakes.slice(0, 4),
    typicalQuestions: insights.typicalQuestions.slice(0, 6),
    voiceProfile: voice,
    prepPack,
    focus,
    starCases,
    title,
    company,
    vacancyId: opts.vacancyId || null,
    recordId: opts.recordId || null,
    interviewStage: opts.interviewStage || 'tech',
    hash: '',
  };

  bundle.hash = hashText(
    JSON.stringify({
      cv: hashText(bundle.cvText),
      prep: hashText(bundle.prepSummary),
      vac: hashText(bundle.vacancyText),
      notes: hashText(bundle.notesSnippet),
    })
  );

  bundle.chunks = chunkBundle(bundle);
  sessionCache.set(cacheKey, bundle);
  return bundle;
}

function buildStarCases(cvText, notes, prepPack) {
  const cases = [];
  const pitch = String(prepPack?.llm?.pitch || prepPack?.pitch || '').trim();
  if (pitch) {
    cases.push({ title: 'Самопитч', situation: pitch, action: '', result: '', tags: ['pitch'] });
  }
  for (const t of (notes.topics || []).slice(0, 3)) {
    cases.push({
      title: t.title,
      situation: String(t.excerpt || '').slice(0, 300),
      action: '',
      result: '',
      tags: ['notes'],
    });
  }
  if (!cases.length && cvText) {
    cases.push({
      title: 'Опыт из резюме',
      situation: cvText.slice(0, 280).replace(/\s+/g, ' '),
      action: '',
      result: '',
      tags: ['cv'],
    });
  }
  return cases.slice(0, 5);
}

function chunkBundle(bundle) {
  const parts = [
    ['CV', bundle.cvText],
    ['Вакансия', bundle.vacancyText],
    ['Сводка собеса', bundle.prepSummary],
    ['Заметки', bundle.notesSnippet],
    ['Портфолио', bundle.portfolioText],
    ['Обучение', bundle.trainingText],
  ];
  const chunks = [];
  for (const [label, text] of parts) {
    if (!text) continue;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push({ label, text: text.slice(i, i + CHUNK_SIZE) });
    }
  }
  for (const c of bundle.starCases || []) {
    const t = [c.title, c.situation, c.action, c.result].filter(Boolean).join(' — ');
    if (t) chunks.push({ label: 'STAR', text: t.slice(0, CHUNK_SIZE) });
  }
  return chunks;
}

/**
 * @param {string} question
 * @param {object} bundle
 * @param {number} [limit]
 */
export function ragChunksForQuestion(question, bundle, limit = 5) {
  const q = String(question || '').toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return (bundle.chunks || []).slice(0, limit);

  const scored = (bundle.chunks || []).map((ch) => {
    const t = ch.text.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += 1;
    }
    if (ch.label === 'STAR') score += 0.5;
    return { ch, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((x) => x.score > 0)
    .slice(0, limit)
    .map((x) => x.ch);
}

export function bundleToAnswerContext(bundle, question) {
  const rag = ragChunksForQuestion(question, bundle, 5);
  const ragText = rag.map((c) => `[${c.label}] ${c.text}`).join('\n');
  const spokenBlock = bundle.spokenSnippet || '';
  const stage = bundle.interviewStage || 'tech';
  return {
    title: bundle.title,
    company: bundle.company,
    focus: bundle.focus,
    prepContext: [bundle.prepSummary, ragText].filter(Boolean).join('\n\n').slice(0, 4500),
    cvText: bundle.cvText,
    notes: bundle.notesSnippet,
    lessons: (bundle.lessons || []).join('; '),
    mistakes: (bundle.mistakes || []).join('; '),
    interviewStage: stage,
    spokenSnippet: spokenBlock,
    prepPack: bundle.prepPack,
  };
}

export function clearContextCache() {
  sessionCache.clear();
}
