import assert from 'node:assert/strict';
import {
  confirmedPreferredResumeTitle,
  titleMatchesPreferred,
} from '../lib/hh-resume-upload.mjs';

const support =
  'Специалист технической поддержки L2, L3. Руководитель службы поддержки';
assert.equal(titleMatchesPreferred(support, 'DevOps'), false);
assert.equal(titleMatchesPreferred('DevOps-инженер', 'DevOps'), true);
assert.equal(titleMatchesPreferred('Middle DevOps engineer', 'DevOps'), true);
assert.equal(confirmedPreferredResumeTitle('DevOps-инженер', 'DevOps'), 'DevOps-инженер');
assert.equal(confirmedPreferredResumeTitle('Data Engineer', 'DevOps'), null);
assert.equal(confirmedPreferredResumeTitle('', 'DevOps'), null);
console.log('test-hh-resume-match: OK');
