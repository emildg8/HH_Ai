/**
 * Авто-заполнение анкеты работодателя: LLM + Playwright.
 */

import {
  clickEmployerQuestionnaireNext,
  detectEmployerQuestionnaire,
  fillEmployerQuestionnaire,
} from './hh-employer-questionnaire.mjs';
import { generateQuestionnaireAnswers } from './hh-questionnaire-answers.mjs';
import { meaningfulQuestions } from './questionnaire-labels.mjs';
import { persistSuggestedQuestionnaireAnswers } from './questionnaire-pipeline.mjs';

/**
 * @param {object} record
 */
export function recordHasDashboardQuestionnaireAnswers(record) {
  const q = record?.hhApply?.questionnaire;
  return Boolean(q?.savedAnswers?.length || q?.suggestedAnswers?.length);
}

/**
 * @param {object} record
 */
export function getDashboardQuestionnaireAnswers(record) {
  const q = record?.hhApply?.questionnaire;
  const saved = q?.savedAnswers;
  if (Array.isArray(saved) && saved.length) return saved;
  return Array.isArray(q?.suggestedAnswers) ? q.suggestedAnswers : [];
}

/**
 * @param {import('playwright').Page} page
 * @param {{
 *   record: object,
 *   cvText: string,
 *   log?: (msg: string) => void,
 * }} ctx
 * @returns {Promise<{ ok: boolean, questionnaire?: object, answers?: object[], model?: string, error?: string }>}
 */
/**
 * Заполнение по шагам мастера: fill → «Далее» → fill …
 * @param {import('playwright').Page} page
 * @param {Parameters<typeof tryAutoFillEmployerQuestionnaire>[1]} ctx
 * @param {number} [maxWizardSteps]
 */
export async function tryAutoFillEmployerQuestionnaireWithWizard(
  page,
  ctx,
  maxWizardSteps = 10
) {
  const log = ctx.log || (() => {});
  let last = { ok: false, error: 'no-attempt' };
  for (let i = 0; i < maxWizardSteps; i++) {
    last = await tryAutoFillEmployerQuestionnaire(page, {
      ...ctx,
      quiet: i > 0 || ctx.quiet,
    });
    const q = await detectEmployerQuestionnaire(page);
    if (!q.detected) return last;
    if (!last.ok) return last;
    const next = await clickEmployerQuestionnaireNext(page);
    if (!next) return last;
    if (!ctx.quiet) {
      log('[hh-questionnaire] Шаг анкеты: «Далее», заполнение следующей страницы…');
    }
  }
  return last;
}

export async function tryAutoFillEmployerQuestionnaire(page, ctx) {
  const log = ctx.log || (() => {});
  const qCheck = await detectEmployerQuestionnaire(page);
  if (!qCheck.detected) return { ok: false, error: 'no-questionnaire' };

  const questions = meaningfulQuestions(qCheck.questions?.length ? qCheck.questions : []);
  const qList = questions.length ? questions : qCheck.questions;
  const dashboardQuestions = meaningfulQuestions(ctx.record?.hhApply?.questionnaire?.questions || []);

  const saved = getDashboardQuestionnaireAnswers(ctx.record);
  if (saved.length) {
    if (!dashboardQuestions.length) {
      log(
        '[hh-questionnaire] Пропуск автоподстановки: в JSON нет вопросов. В дашборде: «Загрузить с hh.ru» → ответы → «Сохранить» → отклик.'
      );
      return { ok: false, questionnaire: qCheck, error: 'no-dashboard-questions' };
    }
    if (!ctx.quiet) {
      log(`[hh-questionnaire] Анкета: подстановка ${saved.length} ответов из дашборда…`);
    }
    const fill = await fillEmployerQuestionnaire(page, qList, saved, {
      log: ctx.quiet ? () => {} : log,
      dashboardQuestions,
      cvText: ctx.cvText || '',
      vacancyTitle: ctx.record?.title || '',
    });
    if (!ctx.quiet) {
      log(
        `[hh-questionnaire] Из дашборда заполнено ${fill.filledCount}/${qList.length} полей` +
          (fill.filledCount < saved.length ? ' (часть полей не сопоставилась с DOM)' : '') +
          (fill.unfilledRadios ? ' — не выбраны варианты (обновите «Загрузить с hh.ru» или ответы LLM)' : '')
      );
    }
    return {
      ok: fill.ok,
      questionnaire: { ...qCheck, questions: qList },
      answers: saved,
      model: 'dashboard-saved',
      fill,
    };
  }

  try {
    log(
      `[hh-questionnaire] Анкета: ${qCheck.questions.length} вопр. — генерация ответов (LLM)…`
    );
    const { answers, model } = await generateQuestionnaireAnswers({
      record: ctx.record,
      questions: qCheck.questions,
      cvText: ctx.cvText,
    });
    for (const a of answers) {
      log(`[hh-questionnaire] Ответ ${a.index}: ${a.answer.slice(0, 120)}${a.answer.length > 120 ? '…' : ''}`);
    }
    const fill = await fillEmployerQuestionnaire(page, qList, answers, {
      log,
      dashboardQuestions: dashboardQuestions.length ? dashboardQuestions : qList,
      cvText: ctx.cvText || '',
      vacancyTitle: ctx.record?.title || '',
    });
    log(
      `[hh-questionnaire] Заполнено полей: ${fill.filledCount}/${qCheck.questions.length} (модель ${model})`
    );
    if (ctx.record?.id && fill.filledCount > 0 && ctx.persistSuggested !== false) {
      persistSuggestedQuestionnaireAnswers(ctx.record, answers, model);
    }
    await page.waitForTimeout(500);
    return {
      ok: fill.ok,
      questionnaire: qCheck,
      answers,
      model,
      fill,
    };
  } catch (e) {
    log(`[hh-questionnaire] Авто-анкета не удалась: ${e.message}`);
    return { ok: false, questionnaire: qCheck, error: e.message };
  }
}
