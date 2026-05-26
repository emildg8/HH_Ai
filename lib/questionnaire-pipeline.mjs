/**
 * Подготовка анкет без лишних ручных шагов: вопросы в JSON → ответы (CV/LLM) → отклик.
 */

import { loadCvBundle } from './cv-load.mjs';
import { updateVacancyRecord, getVacancyRecord } from './store.mjs';
import {
  meaningfulQuestions,
  recordNeedsQuestionnaireWork,
  recordQuestionnaireNeedsRelabel,
} from './questionnaire-labels.mjs';
import { mergeQuestionnaire } from './questionnaire-merge.mjs';
import {
  generateQuestionnaireAnswers,
  isQuestionnaireLlmEnabled,
} from './hh-questionnaire-answers.mjs';
import { getDashboardQuestionnaireAnswers } from './hh-questionnaire-auto.mjs';
import {
  isLlmRelatedQuestionLabel,
  answerLlmRadioWithDisclosure,
  answerLlmDisclosureTextarea,
  hhAiAutomationDisclosureShort,
} from './questionnaire-disclosure.mjs';
import { isChoiceQuestion } from './questionnaire-choice.mjs';

/** Батч по умолчанию пытается заполнить анкету (HH_BATCH_QUESTIONNAIRE_AUTO=0 — выкл.). */
export function isBatchQuestionnaireAutoEnabled() {
  return String(process.env.HH_BATCH_QUESTIONNAIRE_AUTO ?? '1').trim() !== '0';
}

/**
 * @param {object} rec
 */
export function recordHasQuestionnaireQuestions(rec) {
  return meaningfulQuestions(rec?.hhApply?.questionnaire?.questions || []).length > 0;
}

/**
 * @param {object} rec
 */
export function recordReadyForQuestionnaireApply(rec) {
  if (!recordHasQuestionnaireQuestions(rec)) return false;
  return getDashboardQuestionnaireAnswers(rec).length > 0;
}

/**
 * @param {object} rec
 * @param {Array<{ index: number, answer: string }>} answers
 * @param {string} [model]
 */
export function persistSuggestedQuestionnaireAnswers(rec, answers, model = 'generated') {
  const id = rec?.id;
  if (!id || !answers?.length) return false;
  const prev = getVacancyRecord(id) || rec;
  const prevQ = prev.hhApply?.questionnaire || {};
  const questions = meaningfulQuestions(prevQ.questions || []);
  const questionnaire = mergeQuestionnaire(prevQ, {
    suggestedAnswers: answers,
    suggestedAt: new Date().toISOString(),
    suggestedModel: model,
    status: prevQ.status || 'pending_manual',
    needsProbe: false,
  });
  updateVacancyRecord(id, {
    hhApply: {
      ...prev.hhApply,
      questionnaire,
    },
  });
  return true;
}

/**
 * Сгенерировать ответы по резюме/LLM и сохранить в карточку (без браузера).
 * @param {object} rec
 * @param {{ cvText?: string, log?: (msg: string) => void, force?: boolean }} [opts]
 */
/**
 * Сохранить ответы: ваши savedAnswers не трогаем, остальное — генерация; LLM-блок — с дисклеймером HH Ai.
 * @param {object} rec
 * @param {{ cvText?: string, log?: (msg: string) => void, llmDisclosure?: boolean }} [opts]
 */
export async function mergePreserveSavedAndGenerateAnswers(rec, opts = {}) {
  const log = opts.log || (() => {});
  const fresh = getVacancyRecord(rec.id) || rec;
  const questions = meaningfulQuestions(fresh.hhApply?.questionnaire?.questions || []);
  if (!questions.length) return { ok: false, reason: 'no-questions' };

  const savedMap = new Map(
    (fresh.hhApply?.questionnaire?.savedAnswers || []).map((a) => [Number(a.index), String(a.answer || '').trim()])
  );
  const oldSugg = new Map(
    (fresh.hhApply?.questionnaire?.suggestedAnswers || []).map((a) => [Number(a.index), String(a.answer || '').trim()])
  );

  const preserved = new Set();
  for (const q of questions) {
    const saved = savedMap.get(q.index);
    if (!saved) continue;
    const wasUserEdit = !oldSugg.has(q.index) || saved !== oldSugg.get(q.index);
    if (wasUserEdit || saved.length >= 8) preserved.add(q.index);
  }

  let cvText = String(opts.cvText || '').trim();
  if (!cvText) {
    try {
      cvText = String((await loadCvBundle()).text || '').trim();
    } catch (e) {
      log(`[questionnaire-pipeline] CV: ${e.message}`);
    }
  }

  const toGenerate = questions.filter((q) => !preserved.has(q.index));
  let generated = [];
  let model = 'preserved+merged';
  if (toGenerate.length) {
    const r = await generateQuestionnaireAnswers({ record: fresh, questions: toGenerate, cvText });
    generated = r.answers;
    model = r.model;
  }

  const byIndex = new Map();
  for (const q of questions) {
    if (preserved.has(q.index)) {
      byIndex.set(q.index, savedMap.get(q.index));
      continue;
    }
    const g = generated.find((a) => a.index === q.index);
    if (g?.answer) byIndex.set(q.index, g.answer);
  }

  if (opts.llmDisclosure !== false) {
    for (const q of questions) {
      if (!isLlmRelatedQuestionLabel(q.label)) continue;
      if (isChoiceQuestion(q)) {
        byIndex.set(q.index, answerLlmRadioWithDisclosure(q));
      } else if (q.type === 'textarea' || q.type === 'text') {
        const prev = byIndex.get(q.index) || '';
        const disc = answerLlmDisclosureTextarea();
        byIndex.set(q.index, prev ? `${disc}\n\n${prev}` : disc);
      }
    }
    const q19 = questions.find((q) => /матчмейкинг|первые\s+действ/i.test(q.label || ''));
    if (q19 && !isLlmRelatedQuestionLabel(q19.label)) {
      const prev = byIndex.get(q19.index) || savedMap.get(q19.index) || '';
      if (!prev.includes('HH Ai') && !prev.includes('без ручного')) {
        byIndex.set(q19.index, `${hhAiAutomationDisclosureShort()}\n\n${prev}`.trim());
      }
    }
  }

  const answers = questions
    .map((q) => ({ index: q.index, answer: byIndex.get(q.index) || '' }))
    .filter((a) => a.answer);

  const prevQ = fresh.hhApply?.questionnaire || {};
  const questionnaire = mergeQuestionnaire(prevQ, {
    suggestedAnswers: answers,
    savedAnswers: questions.map((q) => ({
      index: q.index,
      answer: byIndex.get(q.index) || savedMap.get(q.index) || '',
    })),
    suggestedAt: new Date().toISOString(),
    suggestedModel: model,
    automationDisclosure: hhAiAutomationDisclosureShort(),
    status: prevQ.status || 'pending_manual',
    needsProbe: false,
  });
  updateVacancyRecord(rec.id, {
    hhApply: { ...fresh.hhApply, questionnaire },
  });

  log(
    `[questionnaire-pipeline] Карточка ${rec.id}: сохранено ваших ${preserved.size}, сгенерировано ${toGenerate.length}, всего ${answers.length} ответов`
  );
  return { ok: true, preserved: preserved.size, generated: toGenerate.length, count: answers.length, model };
}

export async function generateAndPersistSuggestedAnswers(rec, opts = {}) {
  const log = opts.log || (() => {});
  const fresh = getVacancyRecord(rec.id) || rec;
  const questions = meaningfulQuestions(fresh.hhApply?.questionnaire?.questions || []);
  if (!questions.length) {
    return { ok: false, reason: 'no-questions' };
  }

  if (!opts.force && getDashboardQuestionnaireAnswers(fresh).length > 0) {
    return { ok: true, skipped: true, reason: 'already-has-answers', count: questions.length };
  }

  let cvText = String(opts.cvText || '').trim();
  if (!cvText) {
    try {
      const bundle = await loadCvBundle();
      cvText = String(bundle.text || '').trim();
    } catch (e) {
      log(`[questionnaire-pipeline] CV не загружен: ${e.message}`);
    }
  }

  const { answers, model } = await generateQuestionnaireAnswers({
    record: fresh,
    questions,
    cvText,
  });

  persistSuggestedQuestionnaireAnswers(fresh, answers, model);
  log(
    `[questionnaire-pipeline] Сохранено ${answers.length} ответов в карточку (${model}) — можно отклик без ручного ввода`
  );
  return { ok: true, answers, model, count: answers.length };
}

/**
 * Подготовка ответов для всех карточек с анкетой в очереди (без Playwright).
 * @param {object[]} items
 * @param {{ log?: (msg: string) => void, force?: boolean }} [opts]
 */
export function filterQuestionnaireReprobeCandidates(items) {
  return items.filter(
    (x) =>
      (x.status === 'pending' || x.status === 'approved') &&
      recordNeedsQuestionnaireWork(x) &&
      recordQuestionnaireNeedsRelabel(x)
  );
}

export async function prepQuestionnaireAnswersBatch(items, opts = {}) {
  const log = opts.log || (() => {});
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let needsRelabel = 0;
  const errors = [];

  let cvText = '';
  try {
    cvText = String((await loadCvBundle()).text || '').trim();
  } catch {
    /* heuristic only */
  }

  for (const rec of items) {
    if (!recordNeedsQuestionnaireWork(rec) && !recordHasQuestionnaireQuestions(rec)) {
      skipped++;
      continue;
    }
    if (!recordHasQuestionnaireQuestions(rec)) {
      if (recordQuestionnaireNeedsRelabel(rec)) {
        needsRelabel++;
        log(
          `[questionnaire-pipeline] ${rec.title || rec.id}: нужен probe (заглушки вместо текста вопросов)`
        );
      }
      skipped++;
      continue;
    }
    try {
      const r = await generateAndPersistSuggestedAnswers(rec, { cvText, log, force: opts.force });
      if (r.skipped) skipped++;
      else if (r.ok) ok++;
      else failed++;
    } catch (e) {
      failed++;
      errors.push({ id: rec.id, title: rec.title, error: e.message });
      log(`[questionnaire-pipeline] ${rec.title || rec.id}: ${e.message}`);
    }
  }

  return { ok, skipped, failed, needsRelabel, errors, total: items.length };
}

/**
 * @param {object[]} items — pending/approved с анкетой
 */
export function filterQuestionnairePrepCandidates(items) {
  return items.filter(
    (x) =>
      (x.status === 'pending' || x.status === 'approved') &&
      (recordNeedsQuestionnaireWork(x) || recordHasQuestionnaireQuestions(x)) &&
      !recordQuestionnaireNeedsRelabel(x)
  );
}
