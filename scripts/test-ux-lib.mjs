/**
 * Smoke lib-модулей UX v3.
 *   node scripts/test-ux-lib.mjs
 */

import assert from 'node:assert/strict';
import { computeApplyTimelineLastDays } from '../lib/apply-timeline-mini.mjs';
import { computeLetterEditMetrics } from '../lib/cover-letter-metrics.mjs';
import { computeDashboardStats } from '../lib/offers-stats.mjs';

const timeline = computeApplyTimelineLastDays(7);
assert.equal(timeline.length, 7);

const metrics = computeLetterEditMetrics('hello world', 'hello world');
assert.equal(metrics?.editRatioPct, 0);

const stats = computeDashboardStats();
assert.ok(Array.isArray(stats.applyTimelineLast7));
assert.equal(stats.applyTimelineLast7.length, 7);

console.log('test-ux-lib: OK');
