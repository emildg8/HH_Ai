import assert from 'node:assert/strict';
import { resolveLetterDeliveryOutcome } from '../lib/apply-outcome.mjs';

assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
    verifiedInChat: true,
  }),
  'delivered'
);
assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
    chatSent: true,
    verifiedInChat: true,
  }),
  'delivered',
  'chatStepOk after verify must count as delivered'
);
assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
    chatSent: true,
    verifiedInChat: false,
  }),
  'not_delivered',
  'chatSent without verifiedInChat is not delivered'
);

console.log('OK: test-cover-letter-deliver-truth.mjs');
