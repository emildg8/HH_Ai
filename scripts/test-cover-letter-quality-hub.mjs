import assert from 'node:assert/strict';
import { buildCoverLetterQualityHub } from '../lib/cover-letter-quality-hub.mjs';

const hub = buildCoverLetterQualityHub({});
assert.equal(hub.ok, true);
assert.ok(hub.golden?.letters?.total >= 6);
assert.ok(hub.golden?.targeting?.total >= 10);
assert.ok(hub.metrics);
assert.ok('correlation' in hub);
assert.ok('styleInsights' in hub);

console.log('test-cover-letter-quality-hub: OK');
