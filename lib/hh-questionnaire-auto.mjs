/**
 * Авто-заполнение анкеты работодателя: LLM + Playwright.
 */

import { detectEmployerQuestionnaire, fillEmployerQuestionnaire } from './hh-employer-questionnaire.mjs';
import { generateQuestionnaireAnswers } from './hh-questionnaire-answers.mjs';
import { meaningfulQuestions } from './questionnaire-labels.mjs';

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
    });
    if (!ctx.quiet) {
      log(
        `[hh-questionnaire] Из дашборда заполнено ${fill.filledCount}/${qList.length} полей` +
          (fill.filledCount < saved.length ? ' (часть полей не сопоставилась с DOM)' : '')
      );
    }
    return {
      ok: fill.filledCount > 0,
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
    });
    log(
      `[hh-questionnaire] Заполнено полей: ${fill.filledCount}/${qCheck.questions.length} (модель ${model})`
    );
    await page.waitForTimeout(500);
    return {
      ok: fill.filledCount > 0,
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
