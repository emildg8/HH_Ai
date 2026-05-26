/**
 * Слияние ответов анкеты при смене списка вопросов (probe / отклик в браузере).
 */

import {
  formatQuestionLabel,
  normalizeQuestionLabel,
  questionnaireTopicKey,
  dedupeQuestionnaireQuestions,
  meaningfulQuestions,
} from './questionnaire-labels.mjs';

/**
 * @param {string} a
 * @param {string} b
 */
function labelsRoughlyMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const slice = Math.min(28, a.length, b.length);
  if (slice < 12) return false;
  return a.slice(0, slice) === b.slice(0, slice) || a.includes(b.slice(0, slice)) || b.includes(a.slice(0, slice));
}

/**
 * @param {Array<{ index?: number, label?: string }>} oldQuestions
 * @param {Array<{ index?: number, label?: string }>} newQuestions
 * @param {Array<{ index?: number, answer?: string }>} answerRows
 */
export function remapQuestionnaireAnswers(oldQuestions, newQuestions, answerRows) {
  if (!Array.isArray(answerRows) || !answerRows.length) return [];
  if (!Array.isArray(newQuestions) || !newQuestions.length) return [];

  const oldList = meaningfulQuestions(Array.isArray(oldQuestions) ? oldQuestions : []);
  const newList = meaningfulQuestions(newQuestions);
  const byOldIndex = new Map();
  const byOldNorm = new Map();
  const byOldTopic = new Map();
  const topicHits = new Map();

  for (const row of answerRows) {
    const ans = String(row?.answer ?? '').trim();
    if (!ans || !Number.isFinite(row?.index)) continue;
    byOldIndex.set(row.index, ans);
    const oq = oldList.find((q) => q.index === row.index);
    if (oq?.label) {
      const norm = normalizeQuestionLabel(oq.label);
      if (norm) byOldNorm.set(norm, ans);
      const topic = questionnaireTopicKey(oq.label);
      if (topic && !topic.startsWith('text:')) {
        topicHits.set(topic, (topicHits.get(topic) || 0) + 1);
        byOldTopic.set(topic, ans);
      }
    }
  }

  const out = [];

  for (let i = 0; i < newList.length; i++) {
    const q = newList[i];
    const idx = Number.isFinite(q?.index) ? q.index : i + 1;
    const norm = normalizeQuestionLabel(q?.label);
    const topic = questionnaireTopicKey(q?.label || '');
    let answer =
      (norm && byOldNorm.get(norm)) ||
      (topic && !topic.startsWith('text:') && topicHits.get(topic) === 1 && byOldTopic.get(topic)) ||
      '';

    if (!answer && norm) {
      for (const oq of oldList) {
        const on = normalizeQuestionLabel(oq.label);
        if (!on || !labelsRoughlyMatch(norm, on)) continue;
        const a = byOldIndex.get(oq.index);
        if (a) {
          answer = a;
          break;
        }
      }
    }

    if (answer) out.push({ index: idx, answer });
  }

  return out;
}

/**
 * @param {object} prevQ
 * @param {object} patch
 */
export function mergeQuestionnaire(prevQ = {}, patch = {}) {
  const prev = { ...prevQ };
  const next = { ...prev, ...patch };

  if (!patch.questions) return next;

  const hadAnswers =
    (prev.savedAnswers?.length ?? 0) > 0 || (prev.suggestedAnswers?.length ?? 0) > 0;

  if (hadAnswers) {
    const oldQ = prev.questions || [];
    const newQ = patch.questions || [];
    if (prev.savedAnswers?.length) {
      next.savedAnswers = remapQuestionnaireAnswers(oldQ, newQ, prev.savedAnswers);
    }
    if (prev.suggestedAnswers?.length) {
      next.suggestedAnswers = remapQuestionnaireAnswers(oldQ, newQ, prev.suggestedAnswers);
    }
  }

  return next;
}

/**
 * Карта index → answer для UI (с переносом по тексту вопроса, не по номеру строки).
 * @param {Array<{ index?: number, label?: string }>} storedQuestions
 * @param {Array<{ index?: number, answer?: string }>} suggestedAnswers
 * @param {Array<{ index?: number, answer?: string }>} savedAnswers
 */
export function buildQuestionnaireAnswersMap(storedQuestions, suggestedAnswers, savedAnswers) {
  const questions = meaningfulQuestions(storedQuestions || []);
  const stored = storedQuestions || [];
  const map = new Map();

  for (const row of remapQuestionnaireAnswers(stored, questions, suggestedAnswers || [])) {
    if (row.answer) map.set(row.index, row.answer);
  }
  for (const row of remapQuestionnaireAnswers(stored, questions, savedAnswers || [])) {
    if (row.answer) map.set(row.index, row.answer);
  }
  return { questions, map };
}

/**
 * Подготовить вопросы для JSON: сохранить index с hh.ru, убрать счётчик символов в подписи.
 * @param {Array<{ index?: number, label?: string, type?: string, required?: boolean }>} questions
 */
export function prepareStoredQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return dedupeQuestionnaireQuestions(
    meaningfulQuestions(
      questions
        .filter((q) => q && String(q.label || '').trim())
        .map((q, i) => ({
          ...q,
          index: Number.isFinite(q.index) ? q.index : i + 1,
          label: formatQuestionLabel(q.label),
        }))
    )
  );
}
