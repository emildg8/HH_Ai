/**
 * Обход мастера отклика и сбор текста вопросов работодателя (без отправки).
 */

import {
  advanceResponseWizardOneStep,
  waitForVacancyResponseForm,
} from './hh-response-modal.mjs';
import {
  detectEmployerQuestionnaire,
  scrollQuestionnaireFields,
} from './hh-employer-questionnaire.mjs';
import {
  meaningfulQuestions,
  normalizeQuestionLabel,
  dedupeQuestionnaireQuestions,
} from './questionnaire-labels.mjs';
import { ensurePreferredProfileResume } from './hh-resume-upload.mjs';

/**
 * Объединить вопросы с разных шагов мастера (4-й вопрос часто на следующем экране).
 * @param {Array<{ index?: number, label?: string, type?: string }>} prev
 * @param {Array<{ index?: number, label?: string, type?: string }>} next
 */
export function mergeProbeQuestionSteps(prev, next) {
  const out = [...(prev || [])];
  for (const q of next || []) {
    const norm = normalizeQuestionLabel(q?.label);
    if (!norm) continue;
    if (out.some((x) => normalizeQuestionLabel(x.label) === norm)) continue;
    out.push({ ...q, index: out.length + 1 });
  }
  return dedupeQuestionnaireQuestions(out);
}

/**
 * @param {import('playwright').Page} page
 * @param {(msg: string) => void} [log]
 */
export async function prepareResponseWizardForQuestionnaire(page, log = () => {}) {
  await waitForVacancyResponseForm(page, 22_000);
  const r = await ensurePreferredProfileResume(page, { log });
  if (r?.ok === false && r?.reason) {
    log(`[probe] Резюме: ${r.reason}`);
  }
  for (let i = 0; i < 6; i++) {
    const moved = await advanceResponseWizardOneStep(page);
    if (!moved) break;
    await page.waitForTimeout(400);
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {{ maxSteps?: number, log?: (msg: string) => void }} [opts]
 */
export async function collectBestQuestionnaire(page, opts = {}) {
  const maxSteps = opts.maxSteps ?? 22;
  const log = opts.log || (() => {});
  let best = { questions: [], reasons: [] };
  let stableRounds = 0;
  let noMoveRounds = 0;

  for (let step = 0; step < maxSteps; step++) {
    await page.waitForTimeout(step === 0 ? 350 : 550);
    await scrollQuestionnaireFields(page);
    const q = await detectEmployerQuestionnaire(page);
    const meaningful = meaningfulQuestions(q.questions);

    const taVisible = await page.locator('textarea:visible').count().catch(() => 0);
    const radioVisible = await page.locator('input[type="radio"]:visible').count().catch(() => 0);
    const merged =
      meaningful.length > 0 ? mergeProbeQuestionSteps(best.questions, meaningful) : best.questions;
    const radioInJson = merged.filter((x) => x.type === 'radio' && x.options?.length).length;

    const prevLen = best.questions.length;
    if (merged.length > prevLen) {
      best = { questions: merged, reasons: q.reasons || best.reasons };
      stableRounds = 0;
      log(
        `[probe] шаг ${step}: всего ${merged.length} вопр. (+${merged.length - prevLen}), textarea: ${taVisible}, radio: ${radioVisible}`
      );
    } else if (meaningful.length > 0 && merged.length === best.questions.length && merged.length > 0) {
      stableRounds++;
    }

    if (merged.length > 0) {
      best = { ...best, questions: merged };
    }

    const canGrow = taVisible > merged.filter((x) => x.type !== 'radio').length;
    const radiosMissing = radioVisible >= 4 && radioInJson < Math.ceil(radioVisible / 4);
    if (radiosMissing) stableRounds = 0;

    if (merged.length > 0 && stableRounds >= 2 && !canGrow && !radiosMissing) {
      const hasSubmit = await page
        .getByRole('button', { name: /отправить отклик|отправить/i })
        .first()
        .isVisible({ timeout: 350 })
        .catch(() => false);
      if (hasSubmit) break;
    }

    const moved = await advanceResponseWizardOneStep(page);
    if (!moved) {
      noMoveRounds++;
      if (best.questions.length > 0 || noMoveRounds >= 2) break;
    } else {
      noMoveRounds = 0;
    }
  }

  if (best.questions.length > 0) {
    await scrollQuestionnaireFields(page);
    const finalQ = await detectEmployerQuestionnaire(page);
    const finalM = meaningfulQuestions(finalQ.questions);
    if (finalM.length > best.questions.length) {
      best = {
        questions: mergeProbeQuestionSteps(best.questions, finalM),
        reasons: finalQ.reasons || best.reasons,
      };
      log(`[probe] финальный проход: ${best.questions.length} вопр.`);
    }
    const taFinal = await page.locator('textarea:visible').count().catch(() => 0);
    if (taFinal > best.questions.length) {
      log(
        `[probe] Внимание: textarea ${taFinal}, вопросов ${best.questions.length} — на hh.ru прокрутите анкету и нажмите «Загрузить с hh.ru» ещё раз`
      );
    }
  }

  return {
    detected: best.questions.length > 0,
    questions: best.questions,
    reasons: best.reasons,
  };
}
