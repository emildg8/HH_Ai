import assert from 'node:assert/strict';
import { titleMatchesPreferred } from '../lib/hh-resume-upload.mjs';

const support =
  'Специалист технической поддержки L2, L3. Руководитель службы поддержки';
assert.equal(titleMatchesPreferred(support, 'DevOps'), false);
assert.equal(titleMatchesPreferred('DevOps-инженер', 'DevOps'), true);
assert.equal(titleMatchesPreferred('Middle DevOps engineer', 'DevOps'), true);
assert.equal(titleMatchesPreferred('Data Engineer / DevOps', 'DevOps'), false);
assert.equal(titleMatchesPreferred('Data Scientist (DevOps)', 'DevOps'), false);
console.log('test-hh-resume-match: OK');
