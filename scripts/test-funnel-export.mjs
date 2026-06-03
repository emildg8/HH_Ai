/**
 *   node scripts/test-funnel-export.mjs
 */

import assert from 'node:assert/strict';
import { buildFunnelExportCsv } from '../dashboard/public/funnel-export.mjs';

const sample = {
  filters: { since: '2026-04-01', scope: 'applied', minScore: 50 },
  counts: { applied: 120 },
  rates: { viewFromApplied: 40, inviteFromApplied: 5, inviteFromViewed: 12 },
  byResume: [
    { label: 'DevOps / SRE', applied: 80, viewed: 30, invited: 4, declined: 2, viewPct: 38, invitePct: 5 },
  ],
  steps: [{ label: 'Отклики', count: 120, pctOfApplied: 100 }],
  staleFollowUp: [{ title: 'DevOps', company: 'Acme', days: 13 }],
  timeline: [{ label: '2026-W18', count: 12 }],
  hhNegotiations: { total: 400, viewed: 100, invited: 10, declined: 20, awaiting: 270 },
};

const csv = buildFunnelExportCsv(sample);
assert.ok(csv.startsWith('\ufeff'));
assert.match(csv, /DevOps \/ SRE/);
assert.match(csv, /Follow-up/);
assert.match(csv, /Динамика откликов/);

console.log('test-funnel-export: OK');
