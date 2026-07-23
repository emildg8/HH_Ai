import assert from 'node:assert/strict';
import { pruneApplyLaunchHistory } from '../lib/hh-apply-rate.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = 40 * DAY_MS;
const recent = now - 29 * DAY_MS;
const expired = now - 30 * DAY_MS;

assert.deepEqual(
  pruneApplyLaunchHistory([recent, expired, 'invalid'], now),
  [recent],
  'launch history must retain the full rolling 30-day window'
);

console.log('test-hh-apply-rate: OK');
