/**
 * Классификация исхода pack-ship + нужен ли letter-repair.
 * Канон: docs/APPLY-CHAIN-STABLE.md
 */
import {
  HH_APPLY_EXIT_ALREADY_RESPONDED,
  HH_APPLY_EXIT_LETTER_NOT_DELIVERED,
  HH_APPLY_EXIT_PRESUBMIT_BLOCKED,
  HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED,
  HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED,
} from './hh-apply-exit-codes.mjs';

/**
 * @typedef {'ok' | 'naked' | 'partial' | 'fail'} ShipStatus
 */

/**
 * @param {{
 *   hhApply?: object | null,
 *   exitCode?: number | null,
 *   errorMessage?: string,
 * }} input
 * @returns {{ status: ShipStatus, error?: string, needsLetterRepair: boolean }}
 */
export function classifyPackShipOutcome(input = {}) {
  const hh = input.hhApply || {};
  const exitCode = input.exitCode == null ? null : Number(input.exitCode);
  const errMsg = String(input.errorMessage || '').trim();

  if (exitCode === HH_APPLY_EXIT_PRESUBMIT_BLOCKED) {
    return {
      status: 'fail',
      error: errMsg || 'pre-submit: мастер не готов (резюме / submit / анкета)',
      needsLetterRepair: false,
    };
  }

  if (exitCode === HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED) {
    return {
      status: 'partial',
      error: errMsg || 'анкета работодателя — отклик отложен',
      needsLetterRepair: false,
    };
  }

  if (exitCode === HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED) {
    return {
      status: 'fail',
      error: errMsg || 'отклик не подтверждён на hh.ru',
      needsLetterRepair: false,
    };
  }

  if (
    hh.applySubmitUnverified ||
    (hh.responseSubmitted && hh.hhSiteState === 'none' && hh.hhSiteStateSource === 'ok')
  ) {
    return {
      status: 'fail',
      error: hh.applySubmitVerifyReason || 'отклик не подтверждён на hh.ru (страница вакансии всё ещё открыта)',
      needsLetterRepair: false,
    };
  }

  if (hh.hhSiteState === 'archived' && !hh.letterDelivered) {
    return {
      status: 'fail',
      error: 'вакансия в архиве, письмо не доставлено',
      needsLetterRepair: false,
    };
  }

  // already_applied + detectedOnly без письма → naked (letter-repair), не fail «уже отправлен»
  const alreadyOnHh =
    hh.hhSiteState === 'already_applied' ||
    exitCode === HH_APPLY_EXIT_ALREADY_RESPONDED ||
    exitCode === HH_APPLY_EXIT_LETTER_NOT_DELIVERED;

  if (
    alreadyOnHh &&
    !hh.letterDelivered &&
    !hh.letterInForm &&
    !hh.chatSent &&
    (hh.hhDetectedOnly || Boolean(hh.responseSubmitted) || exitCode === HH_APPLY_EXIT_LETTER_NOT_DELIVERED)
  ) {
    return {
      status: 'naked',
      error: errMsg || 'на hh уже отклик, сопроводительное не доставлено',
      needsLetterRepair: true,
    };
  }

  if (hh.hhDetectedOnly && !hh.letterDelivered && !hh.responseSubmitted && !alreadyOnHh) {
    return {
      status: 'fail',
      error: hh.hhSiteStateLabel || 'hh: отклик не подтверждён (detected only)',
      needsLetterRepair: false,
    };
  }

  if (hh.letterDelivered && (hh.responseSubmitted || exitCode === HH_APPLY_EXIT_ALREADY_RESPONDED)) {
    return { status: 'ok', needsLetterRepair: false };
  }

  if (hh.letterDelivered && hh.responseSubmitted) {
    return { status: 'ok', needsLetterRepair: false };
  }

  const responded =
    Boolean(hh.responseSubmitted) ||
    exitCode === HH_APPLY_EXIT_ALREADY_RESPONDED ||
    exitCode === HH_APPLY_EXIT_LETTER_NOT_DELIVERED ||
    hh.hhSiteState === 'already_applied';

  if (responded && !hh.letterDelivered) {
    return {
      status: 'naked',
      error: errMsg || 'отклик без сопроводительного на hh',
      needsLetterRepair: true,
    };
  }

  if (hh.letterInForm && !hh.responseSubmitted) {
    return {
      status: 'partial',
      error: 'письмо в форме, но отклик не подтверждён на hh',
      needsLetterRepair: false,
    };
  }

  if (exitCode === 0 && hh.letterDelivered) {
    return { status: 'ok', needsLetterRepair: false };
  }

  if (exitCode != null && exitCode !== 0 && exitCode !== HH_APPLY_EXIT_ALREADY_RESPONDED) {
    if (exitCode === HH_APPLY_EXIT_LETTER_NOT_DELIVERED) {
      return {
        status: 'naked',
        error: errMsg || 'письмо не доставлено (exit 7)',
        needsLetterRepair: true,
      };
    }
    return {
      status: 'fail',
      error: errMsg || `apply exit ${exitCode}`,
      needsLetterRepair: false,
    };
  }

  return {
    status: 'fail',
    error: errMsg || 'нет подтверждения отклика в store',
    needsLetterRepair: false,
  };
}

/**
 * После одного repair: ok_repaired если letterDelivered, иначе partial (не крутить бесконечно).
 * @param {object | null | undefined} hhApply
 */
export function classifyAfterLetterRepair(hhApply) {
  const hh = hhApply || {};
  if (hh.letterDelivered) {
    return { status: 'ok', repaired: true, needsLetterRepair: false };
  }
  return {
    status: 'partial',
    repaired: true,
    error: 'letter-repair не подтвердил доставку на hh',
    needsLetterRepair: false,
  };
}

/**
 * Нормализация исхода для hunt-day (срез 2).
 * repaired first-pass → ok_repaired (не цель дня).
 * @param {{
 *   hhApply?: object | null,
 *   exitCode?: number | null,
 *   errorMessage?: string,
 *   pointStatus?: string,
 *   repaired?: boolean,
 * }} input
 */
export function normalizeHuntDayShipOutcome(input = {}) {
  if (input.repaired) {
    const after = classifyAfterLetterRepair(input.hhApply);
    return {
      status: after.status === 'ok' ? 'ok_repaired' : after.status,
      error: after.error || null,
      needsLetterRepair: false,
      repaired: true,
    };
  }

  const base = classifyPackShipOutcome({
    hhApply: input.hhApply,
    exitCode: input.exitCode,
    errorMessage: input.errorMessage,
  });

  const pointStatus = String(input.pointStatus || '').toLowerCase();
  if (pointStatus === 'dry-run') {
    return { status: 'dry-run', needsLetterRepair: false, repaired: false };
  }
  if (pointStatus === 'skipped-repeat' || pointStatus === 'skip') {
    const raw = String(input.errorMessage || input.skipReason || input.reason || '').trim();
    const skipReason = String(input.skipReason || input.reason || '').trim();
    let error = raw;
    if (!error) {
      if (pointStatus === 'skipped-repeat') error = 'уже отклик / повтор';
      else error = 'пропуск';
    }
    // Не маскировать visibility под «уже отклик»
    if (
      /false_positive_already|resume_visibility|видимост|Magritte|formBannerIgnored/i.test(
        `${raw} ${skipReason}`
      )
    ) {
      error = raw || 'видимость резюме (Magritte) — не «уже отклик»';
    }
    return {
      status: 'skip',
      error,
      needsLetterRepair: false,
      repaired: false,
    };
  }
  if (pointStatus === 'naked') {
    return {
      status: 'naked',
      error: input.errorMessage || base.error || 'на hh уже отклик, письмо не доставлено',
      needsLetterRepair: true,
      repaired: false,
    };
  }

  let status = base.status;
  if (
    status === 'fail' &&
    /не подтвержд|verify|can-apply-still-open|страница вакансии всё ещё/i.test(
      String(base.error || input.errorMessage || '')
    )
  ) {
    status = 'verify_fail';
  }

  return {
    status,
    error: base.error || null,
    needsLetterRepair: Boolean(base.needsLetterRepair),
    repaired: false,
  };
}
