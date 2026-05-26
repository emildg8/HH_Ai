import fs from 'fs';
import { QUESTIONNAIRE_USER_EDITS_FILE, DATA_DIR } from './paths.mjs';
import { questionnaireTopicKey, formatQuestionLabel } from './questionnaire-labels.mjs';

function normAnswer(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {{ question: string, answer: string, topic?: string, vacancyTitle?: string }} entry
 */
export function appendQuestionnaireUserEdit(entry) {
  const question = formatQuestionLabel(entry.question);
  const answer = String(entry.answer || '').trim().slice(0, 2000);
  if (!question || answer.length < 12) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(
    QUESTIONNAIRE_USER_EDITS_FILE,
    `${JSON.stringify({
      at: new Date().toISOString(),
      topic: entry.topic || questionnaireTopicKey(question),
      question,
      answer,
      vacancyTitle: String(entry.vacancyTitle || '').slice(0, 120) || undefined,
    })}\n`,
    'utf8'
  );
}

/**
 * @param {number} maxLines
 * @returns {Array<{ question: string, answer: string, topic?: string }>}
 */
export function readRecentQuestionnaireEdits(maxLines = 24) {
  if (!fs.existsSync(QUESTIONNAIRE_USER_EDITS_FILE)) return [];
  const lines = fs.readFileSync(QUESTIONNAIRE_USER_EDITS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  const tail = lines.slice(-Math.max(1, Math.min(80, maxLines)));
  const out = [];
  const seen = new Set();
  for (const line of tail.reverse()) {
    try {
      const o = JSON.parse(line);
      const question = formatQuestionLabel(o.question);
      const answer = String(o.answer || '').trim();
      if (!question || answer.length < 12) continue;
      const key = `${o.topic || questionnaireTopicKey(question)}::${normAnswer(answer).slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ question, answer, topic: o.topic });
      if (out.length >= 10) break;
    } catch {
      /* skip */
    }
  }
  return out.reverse();
}

/**
 * Блок few-shot для LLM (ваши сохранённые ответы).
 * @param {{ topic?: string }} [opts]
 */
export function buildQuestionnaireExamplesBlock(opts = {}) {
  const examples = readRecentQuestionnaireEdits();
  if (!examples.length) return '';
  const topic = opts.topic;
  const picked = topic
    ? [...examples.filter((e) => e.topic === topic), ...examples.filter((e) => e.topic !== topic)]
    : examples;
  const slice = picked.slice(0, 6);
  const lines = slice.map(
    (e, i) => `Пример ${i + 1}:\nВ: ${e.question}\nО: ${e.answer}`
  );
  return (
    '\n\nУдачные ответы кандидата (ориентируйся на стиль и длину, не копируй дословно):\n' +
    lines.join('\n\n')
  );
}

/**
 * При «Сохранить» в дашборде — запомнить правки относительно suggestedAnswers.
 * @param {object} rec
 * @param {Array<{ index: number, answer: string }>} savedAnswers
 */
export function captureQuestionnaireEditsOnSave(rec, savedAnswers) {
  const q = rec?.hhApply?.questionnaire;
  if (!q || !Array.isArray(savedAnswers)) return 0;
  const questions = Array.isArray(q.questions) ? q.questions : [];
  const byIndex = new Map(questions.map((row) => [Number(row.index), row]));
  const suggested = new Map(
    (q.suggestedAnswers || []).map((a) => [Number(a.index), String(a.answer || '').trim()])
  );
  let n = 0;
  for (const row of savedAnswers) {
    const ans = String(row.answer ?? '').trim();
    if (ans.length < 12) continue;
    const prev = suggested.get(Number(row.index));
    if (prev && normAnswer(prev) === normAnswer(ans)) continue;
    const questionRow = byIndex.get(Number(row.index));
    const label = formatQuestionLabel(questionRow?.label);
    if (!label) continue;
    appendQuestionnaireUserEdit({
      question: label,
      answer: ans,
      vacancyTitle: rec.title,
    });
    n++;
  }
  return n;
}
