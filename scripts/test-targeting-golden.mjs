import assert from 'node:assert/strict';
import { runTargetingGoldenRegression, loadTargetingGoldenSet } from '../lib/targeting-golden-set.mjs';

const set = loadTargetingGoldenSet();
assert.ok(set.cases.length >= 10, 'golden set should have cases');

const report = runTargetingGoldenRegression();
if (!report.ok) {
  console.error('Golden set failures:', report.failures);
}
assert.equal(report.ok, true, `golden regression: ${report.failures.map((f) => f.id).join(', ')}`);
assert.equal(report.passed, report.total);

console.log(`test-targeting-golden: OK (${report.total} cases)`);
