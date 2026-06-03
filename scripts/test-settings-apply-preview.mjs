/**
 *   node scripts/test-settings-apply-preview.mjs
 */
import assert from 'node:assert/strict';
import { computeApplyThresholdPreview } from '../lib/settings-apply-preview.mjs';
import { computeTargetingRejectStats } from '../lib/targeting-reject-stats.mjs';

const preview = computeApplyThresholdPreview(50);
assert.ok(typeof preview.totalPending === 'number');
assert.ok(typeof preview.recommended === 'number');
assert.equal(preview.threshold, 50);

const stats = computeTargetingRejectStats({ limit: 5 });
assert.ok(Array.isArray(stats.topCategories));
console.log('OK: test-settings-apply-preview.mjs');
