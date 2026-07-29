/**
 * Классификация pack-ship + pre-submit (без Playwright).
 *   node scripts/test-apply-ship-outcome.mjs
 */
import assert from 'node:assert/strict';
import { evaluatePresubmitGuard, isPresubmitBlockedCode } from '../lib/apply-presubmit-guard.mjs';
import {
  classifyAfterLetterRepair,
  classifyPackShipOutcome,
  normalizeHuntDayShipOutcome,
} from '../lib/apply-ship-outcome.mjs';
import {
  HH_APPLY_EXIT_ALREADY_RESPONDED,
  HH_APPLY_EXIT_LETTER_NOT_DELIVERED,
  HH_APPLY_EXIT_PRESUBMIT_BLOCKED,
  HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED,
  HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED,
} from '../lib/hh-apply-exit-codes.mjs';
import { assessQuestionnaireFieldAudit } from '../lib/hh-employer-questionnaire.mjs';

// --- pre-submit ---
assert.equal(evaluatePresubmitGuard({}).allow, true);
assert.equal(
  evaluatePresubmitGuard({ needResume: true, resumeListCount: 0 }).code,
  'empty_resume_list'
);
assert.equal(
  evaluatePresubmitGuard({ needResume: true, onQuestionnaireStep: true, resumeListCount: 0 }).allow,
  true
);
assert.equal(evaluatePresubmitGuard({ submitDisabled: true }).code, 'submit_disabled');
assert.equal(
  evaluatePresubmitGuard({ leadGateBlocks: true, leadGateReason: 'DOM 2/3' }).code,
  'lead_questionnaire'
);
assert.equal(
  evaluatePresubmitGuard({ letterRequired: true, letterInForm: false }).code,
  'letter_missing'
);
assert.equal(
  evaluatePresubmitGuard({ letterRequired: true, letterInForm: true }).allow,
  true
);
assert.equal(
  evaluatePresubmitGuard({
    questionnaireIncomplete: true,
    questionnaireIncompleteReason: 'unfilled-radios',
  }).code,
  'questionnaire_incomplete'
);
assert.equal(isPresubmitBlockedCode('questionnaire_incomplete'), true);
assert.equal(
  evaluatePresubmitGuard({ wrongResume: true, wrongResumeReason: 'Рук. поддержки' }).code,
  'wrong_resume'
);
assert.equal(isPresubmitBlockedCode('wrong_resume'), true);
assert.equal(isPresubmitBlockedCode('letter_missing'), true);

// --- radio / анкета audit (fixture без Playwright) ---
const radioAudit = assessQuestionnaireFieldAudit({
  visibleInputs: 2,
  filledInputs: 2,
  unfilledRadios: true,
});
assert.equal(radioAudit.blocksSubmit, true);
assert.ok(radioAudit.reasons.includes('unfilled-radios'));

// --- ship outcome ---
assert.equal(HH_APPLY_EXIT_PRESUBMIT_BLOCKED, 9);

assert.deepEqual(
  classifyPackShipOutcome({
    exitCode: HH_APPLY_EXIT_PRESUBMIT_BLOCKED,
  }).status,
  'fail'
);

assert.equal(
  classifyPackShipOutcome({
    hhApply: { responseSubmitted: true, letterDelivered: true },
    exitCode: 0,
  }).status,
  'ok'
);

const naked = classifyPackShipOutcome({
  hhApply: { responseSubmitted: true, letterDelivered: false },
  exitCode: HH_APPLY_EXIT_LETTER_NOT_DELIVERED,
});
assert.equal(naked.status, 'naked');
assert.equal(naked.needsLetterRepair, true);

assert.equal(
  classifyPackShipOutcome({
    hhApply: { letterInForm: true, responseSubmitted: false },
    exitCode: 0,
  }).status,
  'partial'
);

assert.equal(
  classifyPackShipOutcome({
    exitCode: HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED,
  }).status,
  'partial'
);

assert.equal(
  classifyPackShipOutcome({
    hhApply: { responseSubmitted: true, letterDelivered: false, hhSiteState: 'already_applied' },
    exitCode: HH_APPLY_EXIT_ALREADY_RESPONDED,
  }).needsLetterRepair,
  true
);

const repaired = classifyAfterLetterRepair({ letterDelivered: true });
assert.equal(repaired.status, 'ok');
assert.equal(repaired.repaired, true);

const stillPartial = classifyAfterLetterRepair({ letterDelivered: false });
assert.equal(stillPartial.status, 'partial');
assert.equal(stillPartial.needsLetterRepair, false);

assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { letterDelivered: true },
    repaired: true,
  }).status,
  'ok_repaired'
);
assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { responseSubmitted: true, letterDelivered: false },
    exitCode: HH_APPLY_EXIT_LETTER_NOT_DELIVERED,
  }).status,
  'naked'
);
assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { applySubmitUnverified: true, responseSubmitted: true },
    errorMessage: 'отклик не подтверждён на hh.ru',
  }).status,
  'verify_fail'
);
assert.equal(
  classifyPackShipOutcome({
    exitCode: HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED,
  }).status,
  'fail'
);
assert.equal(
  normalizeHuntDayShipOutcome({
    exitCode: HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED,
    errorMessage: 'отклик не подтверждён на hh.ru',
  }).status,
  'verify_fail'
);

// INFOWATCH-кейс: баннер already_applied + hhDetectedOnly + письмо не доставлено → naked, не fail
const infowatch = classifyPackShipOutcome({
  hhApply: {
    hhSiteState: 'already_applied',
    hhSiteStateLabel: 'Отклик уже отправлен на hh.ru',
    hhDetectedOnly: true,
    responseSubmitted: false,
    letterDelivered: false,
    letterInForm: false,
    letterPreview: 'Добрый день',
  },
  exitCode: 0,
  errorMessage: 'Сопроводительное не приложено',
});
assert.equal(infowatch.status, 'naked');
assert.equal(infowatch.needsLetterRepair, true);

assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: {
      hhSiteState: 'already_applied',
      hhDetectedOnly: true,
      letterDelivered: false,
    },
    pointStatus: 'naked',
    errorMessage: 'На hh уже отклик, сопроводительное не доставлено',
  }).status,
  'naked'
);

assert.equal(
  normalizeHuntDayShipOutcome({
    pointStatus: 'skip',
    errorMessage: 'Отказ на hh.ru',
  }).status,
  'skip'
);

assert.equal(
  normalizeHuntDayShipOutcome({
    pointStatus: 'skip',
  }).error,
  'пропуск'
);

assert.match(
  normalizeHuntDayShipOutcome({
    pointStatus: 'skip',
    reason: 'false_positive_already',
    errorMessage: 'Резюме уже видно работодателям; баннер Magritte',
  }).error,
  /видимост|Magritte|баннер/i
);

assert.equal(
  normalizeHuntDayShipOutcome({
    pointStatus: 'skipped-repeat',
  }).error,
  'уже отклик / повтор'
);

console.log('OK: test-apply-ship-outcome.mjs');
