/**
 * Авто-заполнение анкеты работодателя: LLM + Playwright.
 */

import { detectEmployerQuestionnaire, fillEmployerQuestionnaire } from './hh-employer-questionnaire.mjs';
import { generateQuestionnaireAnswers } from './hh-questionnaire-answers.mjs';

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

  const saved =
    ctx.record?.hhApply?.questionnaire?.savedAnswers ||
    ctx.record?.hhApply?.questionnaire?.suggestedAnswers;
  if (Array.isArray(saved) && saved.length) {
    log(`[hh-questionnaire] Анкета: подстановка ${saved.length} ответов из дашборда…`);
    const fill = await fillEmployerQuestionnaire(page, qCheck.questions, saved, { log });
    return {
      ok: fill.filledCount > 0,
      questionnaire: qCheck,
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
    const fill = await fillEmployerQuestionnaire(page, qCheck.questions, answers, { log });
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
