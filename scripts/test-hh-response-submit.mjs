import assert from 'node:assert/strict';
import { classifyResponseSubmission } from '../lib/hh-response-modal.mjs';

assert.equal(
  classifyResponseSubmission({
    url: 'https://hh.ru/vacancy/123',
    confirmed: true,
  }),
  'confirmed'
);

assert.equal(
  classifyResponseSubmission({
    url: 'https://hh.ru/account/login',
    confirmed: true,
  }),
  'session-expired-after-submit'
);

assert.equal(
  classifyResponseSubmission({
    url: 'https://hh.ru/vacancy/123',
    confirmed: false,
  }),
  'no-confirmation-after-submit'
);

console.log('test-hh-response-submit: OK');
