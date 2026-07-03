/**
 * Pure helpers для исхода apply (log-golden, unit-тесты).
 */
import { isRepeatApplyCompleteLabel } from './hh-response-modal.mjs';

/** @param {object} [rec] @param {{ l4Attempted?: boolean }} [opts] */
export function computeModalWallMs(rec = {}, { l4Attempted = false } = {}) {
  const envWall = Number(process.env.HH_APPLY_MODAL_WALL_MS);
  const base = Number.isFinite(envWall) && envWall >= 120_000 ? envWall : 300_000;
  return base + (l4Attempted ? 60_000 : 0);
}

/**
 * Симуляция return completeVacancyResponseForm после клика submit.
 * @param {string} applyCompleteLabel
 * @param {string} [submitLabel]
 */
export function buildFormResultAfterApplyComplete(applyCompleteLabel, submitLabel = 'button Откликнуться') {
  const repeatApply = isRepeatApplyCompleteLabel(applyCompleteLabel);
  return {
    submitted: true,
    repeatApply,
    label: repeatApply ? 'already-submitted' : submitLabel,
  };
}

/**
 * @param {{ submitted?: boolean, label?: string, repeatApply?: boolean }} formResult
 * @returns {'repeat_apply' | 'success_submit' | 'incomplete'}
 */
export function resolveApplyProgressOutcome(formResult) {
  if (!formResult?.submitted) return 'incomplete';
  if (formResult.label === 'already-submitted' || formResult.repeatApply) return 'repeat_apply';
  return 'success_submit';
}

/**
 * Apply Truth: first apply успешен только с доставленным сопроводительным.
 * @param {{ letter?: string, letterInForm?: boolean, chatSent?: boolean, verifiedInChat?: boolean, responseSubmitted?: boolean }} r
 * @returns {'delivered' | 'not_required' | 'not_delivered' | 'no_response'}
 */
export function resolveLetterDeliveryOutcome(r) {
  if (!r?.responseSubmitted) return 'no_response';
  const letter = String(r.letter || '').trim();
  if (!letter) return 'not_required';
  if (r.letterInForm) return 'delivered';
  if (r.verifiedInChat) return 'delivered';
  return 'not_delivered';
}

/**
 * Эталоны видео-сессий 21.06 (старый лог — анти-паттерны).
 */
export const APPLY_VIDEO_GOLDEN = [
  {
    id: '15:03-repeat',
    vacancyId: '134312540',
    oldLogMustNot: ['SUCCESS: отклик отправлен'],
    applyCompleteLabel: 'already-applied',
    expectedOutcome: 'repeat_apply',
    l4Attempted: false,
    expectedWallMs: 300_000,
  },
  {
    id: '16:15-first-apply',
    vacancyId: '133856067',
    oldLogMustNot: ['Таймаут мастера отклика (120 с)'],
    applyCompleteLabel: 'success-banner',
    expectedOutcome: 'success_submit',
    l4Attempted: true,
    expectedWallMs: 360_000,
  },
  {
    id: '15:45-already',
    vacancyId: '134008581',
    canApply: false,
    expectedEarlySkip: true,
  },
  {
    id: '15:45-declined',
    vacancyId: '134282754',
    canApply: false,
    siteState: 'declined',
    expectedEarlySkip: true,
  },
];
