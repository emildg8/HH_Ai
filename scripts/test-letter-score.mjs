import assert from 'node:assert/strict';
import { letterScore10Tier } from '../dashboard/public/letter-quality-ui.mjs';
import { letterQualityToScore10, pickBestVariantIndex } from '../lib/letter-score.mjs';

assert.equal(letterScore10Tier(9), 'great');
assert.equal(letterScore10Tier(6), 'ok');
assert.equal(letterScore10Tier(3), 'bad');

assert.equal(letterQualityToScore10({ pass: true, rawPass: true, fixable: false, score: 2 }), 9);
assert.equal(letterQualityToScore10({ pass: true, rawPass: false, fixable: true }), 5);
assert.equal(letterQualityToScore10({ pass: false, rawPass: false, score: 0 }), 3);

assert.equal(
  pickBestVariantIndex(
    [
      { index: 0, pass: true, letterScore10: 6 },
      { index: 1, pass: true, rawPass: true, letterScore10: 9 },
    ],
    2
  ),
  1
);

console.log('test-letter-score: OK');
