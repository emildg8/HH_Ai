/**
 * Формирование текста суфлёра для интервью из prep/mock пакетов.
 */

import { normalizeInterviewLines } from './interview-text-lines.mjs';
import { promptPresetLabel, promptSourceLabel } from './interview-prompt-labels.mjs';
import { formatScriptPromptText } from './interview-copilot-answers.mjs';

/**
 * @param {object} pack
 * @param {'thesis'|'star'|'key5'|'full'|'script'|'live'} [preset]
 */
export function formatPromptText(pack, preset = 'thesis') {
  const normalized = {
    ...pack,
    questions: normalizeInterviewLines(pack.questions),
    checklist: normalizeInterviewLines(pack.checklist),
    tips: normalizeInterviewLines(pack.tips),
    focus: normalizeInterviewLines(pack.focus),
  };
  if (preset === 'script') return formatScriptPromptText(normalized);
  if (preset === 'live' && normalized.answerScripts?.length) {
    return formatScriptPromptText(normalized);
  }
  const lines = packToLines(normalized);
  if (preset === 'full') return lines.join('\n\n');
  if (preset === 'key5') {
    const items = [
      ...normalized.questions,
      ...normalized.checklist,
      ...normalized.tips,
      ...normalized.focus,
    ].slice(0, 5);
    if (items.length) return items.map((x, i) => `${i + 1}. ${x}`).join('\n');
    return lines.slice(0, 5).join('\n');
  }
  if (preset === 'star') return formatStar(lines, normalized);
  return formatThesis(lines, normalized);
}

/**
 * @param {object} pack
 */
function packToLines(pack) {
  const lines = [];
  if (pack.title) lines.push(`# ${pack.title}`);
  if (pack.company) lines.push(`Компания: ${pack.company}`);

  if (pack.pitch) lines.push(`\nО себе:\n${pack.pitch}`);

  for (const q of pack.questions || []) {
    lines.push(`\n• ${q}`);
  }
  for (const t of pack.tips || []) {
    lines.push(`\n→ ${t}`);
  }
  for (const c of pack.checklist || []) {
    lines.push(`\n☐ ${c}`);
  }
  if (pack.suggestedAnswers) {
    lines.push(`\nОтветы HR:\n${pack.suggestedAnswers}`);
  }
  if (pack.focus?.length) {
    lines.push(`\nФокус: ${pack.focus.join(', ')}`);
  }
  if (pack.llm?.pitch) lines.push(`\nО себе:\n${pack.llm.pitch}`);
  for (const q of pack.llm?.techQuestions || []) {
    lines.push(`\nТехнический: ${q}`);
  }
  for (const q of pack.llm?.behavioralQuestions || []) {
    lines.push(`\nПоведенческий: ${q}`);
  }
  for (const q of pack.llm?.questionsToEmployer || []) {
    lines.push(`\nСпросить у них: ${q}`);
  }

  return lines.filter(Boolean);
}

function formatThesis(lines, pack) {
  const bullets = [];
  const pitch = (pack.pitch || pack.llm?.pitch || '').trim();
  if (pitch) {
    bullets.push(`О себе (30 сек):\n${pitch.slice(0, 280)}`);
  }

  const questions = (pack.questions || []).slice(0, 6);
  if (questions.length) {
    bullets.push(
      'Вопросы собеседника:',
      ...questions.map((q, i) => `${i + 1}. ${q}`)
    );
  }

  const checklist = (pack.checklist || []).slice(0, 5);
  if (checklist.length) {
    bullets.push('Перед созвоном проверить:', ...checklist.map((c) => `☐ ${c}`));
  }

  if (pack.focus?.length) {
    bullets.push(`На что давить: ${pack.focus.slice(0, 6).join(', ')}`);
  }

  for (const t of (pack.tips || []).slice(0, 3)) {
    bullets.push(`💡 ${t}`);
  }

  return bullets.join('\n\n') || lines.slice(0, 8).join('\n\n');
}

function formatStar(lines, pack) {
  const qs = pack.questions || pack.llm?.behavioralQuestions || [];
  if (!qs.length) return formatThesis(lines, pack);
  return qs
    .slice(0, 5)
    .map(
      (q, i) =>
        `${i + 1}. ${q}\n   С — ситуация (контекст, команда)\n   Т — задача\n   Д — действия (инструменты, шаги)\n   Р — результат с цифрой`
    )
    .join('\n\n');
}

/**
 * @param {object} prep — interviewPrep pack
 * @param {object} [meta]
 */
export function buildPromptPackFromPrep(prep, meta = {}) {
  return {
    source: 'prep',
    title: prep.vacancyTitle || meta.title || 'Подготовка',
    company: prep.company || meta.company || '',
    checklist: normalizeInterviewLines(prep.checklist),
    llm: prep.llm || null,
    pitch: prep.llm?.pitch || '',
    questions: normalizeInterviewLines([
      ...(prep.llm?.techQuestions || []),
      ...(prep.llm?.behavioralQuestions || []),
    ]),
    tips: normalizeInterviewLines(prep.insights?.prepTips),
    vacancyId: meta.id || null,
  };
}

/**
 * @param {object} mock — technical mock
 * @param {object} [meta]
 */
export function buildPromptPackFromTechMock(mock, meta = {}) {
  return {
    source: 'mock-tech',
    title: meta.title || 'Тех. собес',
    company: meta.company || '',
    questions: normalizeInterviewLines(mock.questions),
    focus: normalizeInterviewLines(mock.focus),
    tips: normalizeInterviewLines(mock.tips),
    vacancyId: meta.id || null,
  };
}

/**
 * @param {object} hr — HR mock
 * @param {object} [meta]
 */
export function buildPromptPackFromHrMock(hr, meta = {}) {
  return {
    source: 'mock-hr',
    title: meta.title || hr.title || 'HR-скрининг',
    company: meta.company || hr.company || '',
    questions: normalizeInterviewLines(hr.questions),
    checklist: normalizeInterviewLines(hr.checklist),
    suggestedAnswers: hr.suggestedAnswers || '',
    salaryHint: hr.salaryHint || '',
    vacancyId: meta.id || null,
  };
}

/**
 * @param {object} pack
 * @param {'thesis'|'star'|'key5'|'full'} [preset]
 */
export function buildPromptState(pack, preset = 'thesis') {
  const text = formatPromptText(pack, preset);
  const mode = pack.mode || (preset === 'live' ? 'live' : 'prep');
  return {
    at: new Date().toISOString(),
    preset,
    presetLabel: promptPresetLabel(preset),
    source: pack.source || 'manual',
    sourceLabel: promptSourceLabel(pack.source || 'manual'),
    mode,
    title: pack.title || '',
    company: pack.company || '',
    vacancyId: pack.vacancyId || null,
    text,
    scrollSpeed: preset === 'live' || mode === 'live' ? 0 : 28,
    fontSize: 22,
    opacity: 0.88,
    mirror: false,
    autoScroll: preset !== 'live' && mode !== 'live',
  };
}
