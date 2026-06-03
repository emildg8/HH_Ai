import assert from 'node:assert/strict';
import { filterSafeAutoApplyItems } from '../lib/learning-auto-apply.mjs';

const items = [
  { pattern: 'тестировщик', target: 'irrelevant', count: 5 },
  { pattern: 'x', target: 'irrelevant', count: 1 },
];
assert.equal(filterSafeAutoApplyItems(items, {}).length, 1);
assert.equal(filterSafeAutoApplyItems(items, { learningAutoApplyPatterns: false }).length, 0);

console.log('test-learning-auto-apply: OK');
