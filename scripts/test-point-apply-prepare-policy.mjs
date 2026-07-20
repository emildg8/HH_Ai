/**
 * L0: point-apply prepare/repair policy (automation P0).
 *   node scripts/test-point-apply-prepare-policy.mjs
 */
import assert from 'node:assert/strict';
import {
  resolvePointApplyNoPrepareLetters,
  shouldSkipLetterRepairOnDeclined,
} from '../lib/point-apply-prepare-policy.mjs';

assert.equal(resolvePointApplyNoPrepareLetters({ onlyIdsSize: 0 }), false);
assert.equal(resolvePointApplyNoPrepareLetters({ onlyIdsSize: 1 }), true);
assert.equal(
  resolvePointApplyNoPrepareLetters({ onlyIdsSize: 1, prepareLetters: true }),
  false
);
assert.equal(
  resolvePointApplyNoPrepareLetters({ onlyIdsSize: 1, noPrepareLetters: true }),
  true
);
assert.equal(
  resolvePointApplyNoPrepareLetters({
    onlyIdsSize: 1,
    env: { HH_POINT_PREPARE_ON_ONLY: '1' },
  }),
  false
);

assert.equal(shouldSkipLetterRepairOnDeclined({ state: 'declined' }, 'Отказ'), true);
assert.equal(shouldSkipLetterRepairOnDeclined({ state: 'already_applied' }, 'уже'), false);
assert.equal(
  shouldSkipLetterRepairOnDeclined({ state: 'declined' }, 'Отказ', {
    HH_LETTER_REPAIR_ON_DECLINED: '1',
  }),
  false
);
assert.equal(shouldSkipLetterRepairOnDeclined({}, 'Отказ на hh.ru'), true);

console.log('OK: test-point-apply-prepare-policy.mjs');
