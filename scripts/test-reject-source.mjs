import assert from 'node:assert/strict';
import {
  REJECT_SOURCE,
  isAutoRejectRecord,
  isManualRejectRecord,
  passesRejectSourceFilter,
  rejectSourceFromFeedbackSource,
  clearRejectSourcePatch,
} from '../lib/reject-source.mjs';

assert.equal(rejectSourceFromFeedbackSource('auto-reject-similar'), REJECT_SOURCE.autoSimilar);
assert.equal(rejectSourceFromFeedbackSource('dashboard-reject'), REJECT_SOURCE.autoSimilar);
assert.equal(rejectSourceFromFeedbackSource('reject-similar-cli'), REJECT_SOURCE.cli);
assert.equal(rejectSourceFromFeedbackSource(undefined), REJECT_SOURCE.manual);

const autoRec = { status: 'rejected', rejectSource: REJECT_SOURCE.autoSimilar };
const manualRec = { status: 'rejected', rejectSource: REJECT_SOURCE.manual };
const legacyRec = { status: 'rejected' };

assert.equal(isAutoRejectRecord(autoRec), true);
assert.equal(isAutoRejectRecord(manualRec), false);
assert.equal(isManualRejectRecord(manualRec), true);
assert.equal(isManualRejectRecord(legacyRec), true);
assert.equal(passesRejectSourceFilter(autoRec, 'auto'), true);
assert.equal(passesRejectSourceFilter(manualRec, 'auto'), false);
assert.equal(clearRejectSourcePatch().rejectSource, null);

console.log('test-reject-source: ok');
