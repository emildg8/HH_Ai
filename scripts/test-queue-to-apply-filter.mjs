/**
 * Unit: queue toApply filter (pain-wave1).
 *   node scripts/test-queue-to-apply-filter.mjs
 */
import assert from 'node:assert/strict';
import { itemPassesToApplyFilter } from '../dashboard/public/queue-to-apply-filter.mjs';

assert.equal(
  itemPassesToApplyFilter({
    status: 'pending',
    coverLetter: { status: 'approved', approvedText: 'Здравствуйте!' },
  }),
  true
);
assert.equal(
  itemPassesToApplyFilter({
    status: 'pending',
    coverLetter: { status: 'draft' },
  }),
  false
);
assert.equal(
  itemPassesToApplyFilter({
    status: 'skipped',
    coverLetter: { status: 'approved', approvedText: 'x' },
  }),
  false
);
assert.equal(
  itemPassesToApplyFilter({
    status: 'pending',
    coverLetter: { approvedText: 'ok' },
    hhApply: { hhSiteState: 'already_applied' },
  }),
  false
);
assert.equal(
  itemPassesToApplyFilter({
    status: 'approved',
    coverLetter: { approvedText: 'ok' },
  }),
  true
);

console.log('OK: test-queue-to-apply-filter.mjs');
