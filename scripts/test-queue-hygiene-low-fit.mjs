/**
 * Unit: hygieneSkipLowFitPending helpers + drift backfill.
 */
import assert from 'node:assert/strict';
import {
  vacancyFitScore,
  vacancyShouldHygieneSkipLowFit,
  vacancyShouldHygieneBackfillApplied,
} from '../lib/queue-hygiene-low-fit.mjs';

assert.equal(vacancyFitScore({ scoreOverall: 42 }), 42);
assert.equal(vacancyFitScore({ matchScore: { scoreFit: 61 } }), 61);
assert.equal(vacancyFitScore({}), null);

assert.equal(
  vacancyShouldHygieneSkipLowFit({ status: 'pending', scoreOverall: 40 }, { minScore: 50 }),
  true
);
assert.equal(
  vacancyShouldHygieneSkipLowFit({ status: 'pending', scoreOverall: 55 }, { minScore: 50 }),
  false
);
assert.equal(
  vacancyShouldHygieneSkipLowFit(
    { status: 'pending', scoreOverall: 20, hhApply: { hhSiteState: 'already_applied' } },
    { minScore: 50 }
  ),
  false,
  'already_applied не low-fit skip — backfill'
);
assert.equal(
  vacancyShouldHygieneSkipLowFit({ status: 'skipped', scoreOverall: 20 }, { minScore: 50 }),
  false
);

assert.equal(
  vacancyShouldHygieneBackfillApplied({
    status: 'pending',
    hhApply: { hhSiteState: 'already_applied' },
  }),
  true
);
assert.equal(
  vacancyShouldHygieneBackfillApplied({
    status: 'pending',
    hhApply: { hhSiteState: 'applied_on_hh' },
  }),
  true
);
assert.equal(
  vacancyShouldHygieneBackfillApplied({
    status: 'pending',
    hhApply: { hhSiteState: 'invited' },
  }),
  false
);
assert.equal(
  vacancyShouldHygieneBackfillApplied({
    status: 'applied',
    hhApply: { hhSiteState: 'already_applied' },
  }),
  false
);

console.log('OK: test-queue-hygiene-low-fit.mjs');
