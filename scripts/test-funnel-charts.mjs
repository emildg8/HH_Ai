/**
 *   node scripts/test-funnel-charts.mjs
 */

import assert from 'node:assert/strict';
import {
  renderScoreBucketChart,
  renderHhStatusChart,
  renderConversionGauges,
  renderOutcomeDonut,
  renderQueueDonut,
  renderScoreBarChart,
  renderResumeCompareChart,
  renderTimelineMultiHtml,
  renderInviteRateChart,
  renderHhDonut,
} from '../dashboard/public/funnel-charts.mjs';
import { bucketTimelineForDisplay } from '../dashboard/public/funnel-timeline.mjs';

const buckets = { high: 10, mid: 5, low: 2, none: 1 };
assert.match(renderScoreBucketChart(buckets), /funnel-stack-chart/);
assert.match(renderScoreBarChart(buckets), /funnel-vbar-chart/);

const counts = {
  applied: 50,
  viewed: 20,
  invited: 5,
  declined: 3,
  awaiting: 10,
  total: 100,
  pending: 30,
  approved: 40,
  rejected: 20,
};
assert.match(renderOutcomeDonut(counts), /conic-gradient/);
assert.match(renderQueueDonut(counts), /conic-gradient/);
assert.match(renderConversionGauges({ viewFromApplied: 40, inviteFromApplied: 10, inviteFromViewed: 25, declineFromApplied: 6 }, counts), /funnel-gauge-grid/);

const hh = { total: 400, viewed: 100, invited: 10, declined: 20, awaiting: 270 };
assert.match(renderHhStatusChart(hh), /funnel-stack-chart--hh/);
assert.match(renderHhDonut(hh), /funnel-donut/);

const resume = [{ label: 'DevOps', applied: 80, viewPct: 38, invitePct: 5 }];
assert.match(renderResumeCompareChart(resume), /funnel-hbar-chart/);

const timeline = [
  { date: '2026-05-01', applied: 5, viewed: 2, invited: 1 },
  { date: '2026-05-02', applied: 8, viewed: 3, invited: 0 },
  { date: '2026-05-03', applied: 3, viewed: 1, invited: 1 },
];
const chart = bucketTimelineForDisplay(timeline);
assert.match(renderTimelineMultiHtml(chart), /funnel-timeline--multi/);
assert.match(renderInviteRateChart(timeline), /funnel-spark/);

assert.equal(renderOutcomeDonut({ applied: 0 }), '<p class="funnel-empty">Нет откликов за период</p>');

console.log('test-funnel-charts: OK');
