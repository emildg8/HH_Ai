/**
 * Unit: lib/batch-prefs-diff.mjs
 */
import assert from 'node:assert/strict';
import {
  pickBatchPrefsSnapshot,
  diffBatchPrefsSnapshots,
  formatBatchPrefValue,
} from '../lib/batch-prefs-diff.mjs';

const snap = pickBatchPrefsSnapshot({
  batchFalsePositiveMax: 10,
  batchAutoPrepareLetters: true,
  noise: 'skip',
});
assert.equal(snap.noise, undefined);
assert.equal(snap.batchFalsePositiveMax, 10);

assert.equal(formatBatchPrefValue(true, 'batchAutoPrepareLetters'), 'да');
assert.equal(formatBatchPrefValue(false, 'batchAutoPrepareLetters'), 'нет');

const diff = diffBatchPrefsSnapshots(
  { batchFalsePositiveMax: 10, batchAutoPrepareLetters: true },
  { batchFalsePositiveMax: 20, batchAutoPrepareLetters: true }
);
assert.equal(diff.length, 1);
assert.equal(diff[0].key, 'batchFalsePositiveMax');
assert.match(diff[0].before, /10/);
assert.match(diff[0].after, /20/);

console.log('OK: test-batch-prefs-diff.mjs');
