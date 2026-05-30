/**
 * Авто-reprobe анкет с заглушками («Текстовое поле N») — R2.4.
 */

import { filterQuestionnaireReprobeCandidates } from './questionnaire-pipeline.mjs';

/** Минимальный интервал между фоновыми probe из дашборда (мс). */
export const AUTO_REPROBE_COOLDOWN_MS = 30 * 60 * 1000;

/** Сколько карточек за один авто-запуск. */
export const AUTO_REPROBE_LIMIT = 3;

/**
 * @param {object[]} items
 */
export function countQuestionnaireReprobeCandidates(items) {
  return filterQuestionnaireReprobeCandidates(items).length;
}

/**
 * @param {number | null | undefined} lastRunAt — epoch ms
 * @param {number} [now]
 */
export function canRunAutoReprobe(lastRunAt, now = Date.now()) {
  if (!lastRunAt || !Number.isFinite(lastRunAt)) return true;
  return now - lastRunAt >= AUTO_REPROBE_COOLDOWN_MS;
}

/**
 * @param {object[]} items
 * @param {{ limit?: number }} [opts]
 */
export function pickAutoReprobeBatch(items, opts = {}) {
  const limit = Math.min(20, Math.max(1, Number(opts.limit) || AUTO_REPROBE_LIMIT));
  return filterQuestionnaireReprobeCandidates(items).slice(0, limit);
}
