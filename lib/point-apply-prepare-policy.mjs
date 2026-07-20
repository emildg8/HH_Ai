/**
 * Политика prepare/repair для точечного отклика (HUNT-APPLY-AUTOMATION-PLAN P0).
 */

/**
 * Нужно ли пропустить ensurePointApplyLetters (авто-regen лестницы).
 * При --only= по умолчанию true (не тащить чужие ids).
 * Откат: --prepare-letters или HH_POINT_PREPARE_ON_ONLY=1.
 *
 * @param {{ onlyIdsSize?: number, noPrepareLetters?: boolean, prepareLetters?: boolean, env?: NodeJS.ProcessEnv }} opts
 */
export function resolvePointApplyNoPrepareLetters(opts = {}) {
  if (opts.noPrepareLetters) return true;
  if (opts.prepareLetters) return false;
  const env = opts.env || process.env;
  if (String(env.HH_POINT_PREPARE_ON_ONLY || '').trim() === '1') return false;
  const n = Number(opts.onlyIdsSize) || 0;
  return n > 0;
}

/**
 * Не чинить письмо в chatik при отказе на hh (WILIX-урок).
 * Откат: HH_LETTER_REPAIR_ON_DECLINED=1.
 *
 * @param {{ state?: string, hhSiteState?: string } | null | undefined} det
 * @param {string} [reason]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldSkipLetterRepairOnDeclined(det, reason = '', env = process.env) {
  if (String(env.HH_LETTER_REPAIR_ON_DECLINED || '').trim() === '1') return false;
  const st = String(det?.state || det?.hhSiteState || '').toLowerCase();
  if (st === 'declined') return true;
  if (/отказ/i.test(String(reason || ''))) return true;
  return false;
}
