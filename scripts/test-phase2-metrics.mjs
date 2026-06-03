/**
 *   node scripts/test-phase2-metrics.mjs
 */

import assert from 'node:assert/strict';
import { computeLetterNoEditKpi } from '../lib/letter-apply-kpi.mjs';
import { computeWeeklyInviteTrend } from '../lib/conversion-weekly.mjs';
import { computeFalsePositiveSparkline7d } from '../lib/false-positive-analytics.mjs';
import { computeLetterMetricsSparkline7d } from '../lib/letter-metrics-summary.mjs';
import { renderSparklineHtml } from '../dashboard/public/letter-quality-ui.mjs';

const kpi = computeLetterNoEditKpi();
assert.ok(kpi && typeof kpi.samples === 'number');
assert.ok(kpi.noEditPct === null || (kpi.noEditPct >= 0 && kpi.noEditPct <= 100));

const weekly = computeWeeklyInviteTrend(2);
assert.ok(Array.isArray(weekly.weeks));
assert.equal(weekly.weeks.length, 2);

const fp7 = computeFalsePositiveSparkline7d();
assert.equal(fp7.length, 7);

const lp7 = computeLetterMetricsSparkline7d();
assert.equal(lp7.length, 7);

const html = renderSparklineHtml([{ label: 'a', passRate: 50 }, { label: 'b', passRate: 80 }], {
  valueKey: 'passRate',
  suffix: '%',
});
assert.ok(html.includes('hub-sparkline'));

console.log('test-phase2-metrics: OK');
