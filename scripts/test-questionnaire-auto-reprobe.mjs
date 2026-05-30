/**
 * Тест auto-reprobe анкет (R2.4).
 *   node scripts/test-questionnaire-auto-reprobe.mjs
 */

import assert from 'node:assert/strict';
import {
  AUTO_REPROBE_COOLDOWN_MS,
  canRunAutoReprobe,
  countQuestionnaireReprobeCandidates,
  pickAutoReprobeBatch,
} from '../lib/questionnaire-auto-reprobe.mjs';
import { itemQuestionnaireShouldAutoProbe } from '../lib/questionnaire-labels.mjs';

assert.equal(AUTO_REPROBE_COOLDOWN_MS, 30 * 60 * 1000);
assert.equal(canRunAutoReprobe(null), true);
assert.equal(canRunAutoReprobe(Date.now() - 1000), false);
assert.equal(canRunAutoReprobe(Date.now() - AUTO_REPROBE_COOLDOWN_MS - 1), true);

const genericItem = {
  status: 'pending',
  hhApply: {
    questionnaire: {
      status: 'pending_manual',
      questions: [{ label: 'Текстовое поле 1', type: 'text' }],
    },
  },
};

assert.ok(itemQuestionnaireShouldAutoProbe(genericItem));
assert.equal(countQuestionnaireReprobeCandidates([genericItem]), 1);
assert.equal(pickAutoReprobeBatch([genericItem, genericItem], { limit: 1 }).length, 1);

const okItem = {
  status: 'pending',
  hhApply: {
    questionnaire: {
      questions: [{ label: 'Какой у вас опыт с Kubernetes?', type: 'text' }],
    },
  },
};
assert.equal(itemQuestionnaireShouldAutoProbe(okItem), false);

console.log('test-questionnaire-auto-reprobe: OK');
