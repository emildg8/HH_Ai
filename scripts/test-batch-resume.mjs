import assert from 'node:assert/strict';
import fs from 'fs';
import {
  BATCH_CONTROL_FILE,
  BATCH_STATE_FILE,
  clearBatchResumeState,
  finishBatchControl,
  initBatchControl,
  patchBatchControl,
  readBatchControl,
  readBatchResumeState,
  syncBatchCounters,
} from '../lib/batch-control.mjs';

function snapshot(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function restore(file, contents) {
  if (contents === null) {
    fs.rmSync(file, { force: true });
    return;
  }
  fs.writeFileSync(file, contents);
}

const controlBefore = snapshot(BATCH_CONTROL_FILE);
const stateBefore = snapshot(BATCH_STATE_FILE);

try {
  fs.rmSync(BATCH_CONTROL_FILE, { force: true });
  clearBatchResumeState();

  const params = { limit: 5, planned: 5, letterIdx: 2, resumed: false };
  initBatchControl(params);
  syncBatchCounters({
    done: 2,
    failed: 1,
    skipped: 0,
    letterIdx: 2,
    processedIds: ['vacancy-a', 'vacancy-b'],
  });
  finishBatchControl({
    reason: 'stop',
    done: 2,
    failed: 1,
    skipped: 0,
    planned: 5,
    params,
  });

  initBatchControl({ ...params, resumed: true });
  assert.deepEqual(readBatchControl()?.processedIds, ['vacancy-a', 'vacancy-b']);
  assert.equal(readBatchControl()?.done, 2);
  assert.equal(readBatchControl()?.failed, 1);

  // Even if the control snapshot is stale, the batch's live state must win on stop.
  patchBatchControl({ done: 0, failed: 0, letterIdx: 0, processedIds: [] });
  finishBatchControl({
    reason: 'stop',
    done: 2,
    failed: 1,
    skipped: 0,
    letterIdx: 2,
    processedIds: ['vacancy-a', 'vacancy-b'],
    planned: 5,
    params,
  });

  const resumed = readBatchResumeState();
  assert.deepEqual(resumed?.processedIds, ['vacancy-a', 'vacancy-b']);
  assert.equal(resumed?.letterIdx, 2);
  assert.equal(resumed?.done, 2);
  assert.equal(resumed?.failed, 1);
  console.log('test-batch-resume: OK');
} finally {
  restore(BATCH_CONTROL_FILE, controlBefore);
  restore(BATCH_STATE_FILE, stateBefore);
}
