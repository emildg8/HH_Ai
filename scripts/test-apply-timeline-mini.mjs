/**
 * Тест ленты откликов за N дней.
 *   node scripts/test-apply-timeline-mini.mjs
 */

import assert from 'node:assert/strict';
import { computeApplyTimelineLastDays } from '../lib/apply-timeline-mini.mjs';

const rows = computeApplyTimelineLastDays(7);
assert.equal(rows.length, 7);
assert.ok(rows.every((r) => r.date && typeof r.applied === 'number'));
assert.equal(rows[6].isToday, true);

console.log('test-apply-timeline-mini: OK');
