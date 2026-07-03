import assert from 'node:assert/strict';
import { buildCoverLetterVerifyProbe } from '../lib/hh-chat-selectors.mjs';

const approved =
  'Здравствуйте! Откликаюсь на позицию Technical QA Lead: в банковском проекте (NDA) существенно снизила долю дефектов';

const probe = buildCoverLetterVerifyProbe(approved);
assert.ok(probe.includes('Откликаюсь на позицию Technical QA Lead'));
assert.equal(probe.length, 72);
assert.ok(buildCoverLetterVerifyProbe('').length === 0);
assert.ok(buildCoverLetterVerifyProbe('коротко').length < 28);

console.log('OK: test-cover-letter-deliver-guards.mjs');
