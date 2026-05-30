/**
 * При капче во время батча — пауза серии и авто-продолжение после решения.
 */

import {
  getBatchCommand,
  patchBatchControl,
  readBatchControl,
  requestBatchPause,
  requestBatchResume,
} from './batch-control.mjs';

/**
 * @param {string[]} [hints]
 * @returns {boolean} true если батч поставлен на паузу
 */
export function pauseBatchForCaptcha(hints = []) {
  if (String(process.env.HH_BATCH || '').trim() !== '1') return false;
  const cmd = getBatchCommand();
  if (cmd !== 'running') return false;
  requestBatchPause();
  patchBatchControl({
    pauseReason: 'captcha',
    pauseReasonAt: new Date().toISOString(),
    pauseHints: hints.length ? hints.join('; ') : '',
  });
  return true;
}

/** Снять метку капчи и продолжить батч, если пауза была из-за капчи. */
export function resumeBatchAfterCaptcha() {
  if (String(process.env.HH_BATCH || '').trim() !== '1') return false;
  const c = readBatchControl();
  if (c?.pauseReason !== 'captcha' || c?.command !== 'paused') return false;
  requestBatchResume();
  patchBatchControl({ pauseReason: null, pauseHints: null, pauseReasonAt: null });
  return true;
}
