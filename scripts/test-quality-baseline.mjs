import assert from 'node:assert/strict';
import { computeQualityBaseline } from '../lib/quality-baseline.mjs';

const b = computeQualityBaseline({});
assert.equal(b.ok, true);
assert.ok(b.queue);
assert.ok(b.golden);
assert.ok('falsePositives' in b);

console.log('test-quality-baseline: OK');
