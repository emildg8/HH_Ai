/**
 *   node scripts/test-job-progress-ui.mjs
 */

import assert from 'node:assert/strict';
import {
  jobProgressKind,
  isJobProgressClickable,
  logSourceForJobProgress,
  JOB_PROGRESS_LOG_PHASES,
} from '../dashboard/public/job-progress-ui.mjs';
import { COPY } from '../dashboard/public/dashboard-ux.mjs';

assert.equal(jobProgressKind({ title: COPY.batch }), 'batch');
assert.equal(jobProgressKind({ title: COPY.batchShort }), 'batch');
assert.equal(jobProgressKind({ title: COPY.harvest }), 'harvest');
assert.equal(jobProgressKind({ title: 'Отклик в браузере' }), 'apply');
assert.equal(jobProgressKind({ title: 'Другое' }), null);

const batchSt = { batchActive: true, batchControl: {} };
assert.equal(
  isJobProgressClickable({ title: COPY.batch, phase: 'running' }, batchSt),
  true
);
assert.equal(
  isJobProgressClickable({ title: COPY.batch, phase: 'done' }, { batchControl: { canResume: true } }),
  true
);
assert.equal(
  isJobProgressClickable({ title: COPY.harvest, phase: 'collecting' }, {}),
  true
);
assert.equal(
  isJobProgressClickable({ title: COPY.harvest, phase: 'collecting' }, batchSt),
  true
);
assert.equal(
  isJobProgressClickable({ title: 'Отклик в браузере', phase: 'running' }, {}),
  true
);
assert.equal(isJobProgressClickable({ title: COPY.batch, phase: 'idle' }, batchSt), false);
assert.equal(isJobProgressClickable(null, {}), false);

assert.equal(logSourceForJobProgress({ title: COPY.harvest }), 'harvest');
assert.equal(logSourceForJobProgress({ title: COPY.batch }), 'apply');

assert.ok(JOB_PROGRESS_LOG_PHASES.has('scoring'));

console.log('test-job-progress-ui: OK');
