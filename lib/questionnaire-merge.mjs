/**
 * Слияние ответов анкеты при смене списка вопросов (probe / отклик в браузере).
 */

import {
  formatQuestionLabel,
  normalizeQuestionLabel,
  questionnaireTopicKey,
  dedupeQuestionnaireQuestions,
} from './questionnaire-labels.mjs';

/**
 * @param {Array<{ index?: number, label?: string }>} oldQuestions
 * @param {Array<{ index?: number, label?: string }>} newQuestions
 * @param {Array<{ index?: number, answer?: string }>} answerRows
 */
export function remapQuestionnaireAnswers(oldQuestions, newQuestions, answerRows) {
  if (!Array.isArray(answerRows) || !answerRows.length) return [];
  if (!Array.isArray(newQuestions) || !newQuestions.length) return answerRows;

  const oldList = Array.isArray(oldQuestions) ? oldQuestions : [];
  const byOldIndex = new Map();
  const byOldNorm = new Map();
  const byOldTopic = new Map();
  for (const row of answerRows) {
    const ans = String(row?.answer ?? '').trim();
    if (!ans || !Number.isFinite(row?.index)) continue;
    byOldIndex.set(row.index, ans);
    const oq = oldList.find((q) => q.index === row.index);
    if (oq?.label) {
      const norm = normalizeQuestionLabel(oq.label);
      if (norm) byOldNorm.set(norm, ans);
      const topic = questionnaireTopicKey(oq.label);
      if (topic && !topic.startsWith('text:')) byOldTopic.set(topic, ans);
    }
  }

  const oldMeaningful = oldList.filter((q) => q?.label && normalizeQuestionLabel(q.label));
  const out = [];

  for (let i = 0; i < newQuestions.length; i++) {
    const q = newQuestions[i];
    const idx = Number.isFinite(q?.index) ? q.index : i + 1;
    const norm = normalizeQuestionLabel(q?.label);
    const topic = questionnaireTopicKey(q?.label || '');
    let answer =
      (norm && byOldNorm.get(norm)) ||
      (topic && !topic.startsWith('text:') && byOldTopic.get(topic)) ||
      '';

    if (!answer && oldMeaningful[i]) {
      answer = byOldIndex.get(oldMeaningful[i].index) || '';
    }

    if (!answer && oldMeaningful[i]?.label) {
      answer = byOldNorm.get(normalizeQuestionLabel(oldMeaningful[i].label)) || '';
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
    if (prev.savedAnswers?.length) {
      next.savedAnswers = remapQuestionnaireAnswers(
        prev.questions,
        patch.questions,
        prev.savedAnswers
      );
    }
    if (prev.suggestedAnswers?.length) {
      next.suggestedAnswers = remapQuestionnaireAnswers(
        prev.questions,
        patch.questions,
        prev.suggestedAnswers
      );
    }
  }

  return next;
}

/**
 * Подготовить вопросы для JSON: сохранить index с hh.ru, убрать счётчик символов в подписи.
 * @param {Array<{ index?: number, label?: string, type?: string, required?: boolean }>} questions
 */
export function prepareStoredQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return dedupeQuestionnaireQuestions(
    questions
      .filter((q) => q && String(q.label || '').trim())
      .map((q, i) => ({
        ...q,
        index: Number.isFinite(q.index) ? q.index : i + 1,
        label: formatQuestionLabel(q.label),
      }))
  );
}
