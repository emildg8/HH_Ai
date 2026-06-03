import assert from 'node:assert/strict';
import { runLetterQualityGoldenRegression, loadLetterQualityGoldenSet } from '../lib/letter-quality-golden-set.mjs';

const set = loadLetterQualityGoldenSet();
assert.ok(set.cases.length >= 6, 'letter golden set should have cases');

const report = runLetterQualityGoldenRegression();
if (!report.ok) {
  console.error('Letter golden failures:', report.failures);
}
assert.equal(report.ok, true, report.failures.map((f) => f.id).join(', '));
assert.equal(report.passed, report.total);

console.log(`test-letter-quality-golden: OK (${report.total} cases)`);
