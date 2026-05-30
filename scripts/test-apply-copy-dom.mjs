/**
 * Тест ключей COPY (синхронизация UI).
 *   node scripts/test-apply-copy-dom.mjs
 */

import assert from 'node:assert/strict';
import { COPY } from '../dashboard/public/dashboard-ux.mjs';

const required = [
  'batch',
  'batchAuto',
  'batchManual',
  'harvest',
  'harvestRun',
  'dailyRoutine',
  'openSettings',
  'openService',
  'openLog',
  'onboardingTitle',
  'onboardingStepResume',
  'onboardingStepHarvest',
  'onboardingStepApply',
  'onboardingStepSync',
  'navQueue',
  'navNoQuestionnaire',
  'navQuestionnaire',
  'navApplied',
  'navHidden',
];

for (const key of required) {
  assert.ok(typeof COPY[key] === 'string' && COPY[key].trim(), `COPY.${key} missing`);
}

console.log('test-apply-copy-dom: OK');
