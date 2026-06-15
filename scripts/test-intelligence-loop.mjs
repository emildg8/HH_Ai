import assert from 'node:assert/strict';
import { extractJdKeywords } from '../lib/jd-keyword-extract.mjs';
import { assessSalaryFit } from '../lib/salary-fit.mjs';
import { assessKeywordGap } from '../lib/resume-keyword-gap.mjs';
import { classifyRecordOutcome } from '../lib/outcome-classifier.mjs';
import { runIntelligenceLoop } from '../lib/intelligence-loop.mjs';

const jd = extractJdKeywords({
  title: 'DevOps инженер',
  description: 'Обязательно: Docker, Kubernetes, Linux, CI/CD, мониторинг Grafana',
});
assert.ok(jd.mustHave.includes('Docker') || jd.all.includes('Docker'), 'docker in jd');

const lowSalary = assessSalaryFit(
  { salaryRaw: 'до 80 000 руб' },
  { minMonthlyRub: 150000, allowUnknownSalary: false }
);
assert.equal(lowSalary.ok, false, 'low salary blocked');

const gap = assessKeywordGap(
  { title: 'DevOps', description: 'Kubernetes Docker Linux' },
  'Опыт Linux и Docker в банке'
);
assert.ok(gap.gapScore >= 50, 'partial gap');

const invited = classifyRecordOutcome({
  title: 'DevOps',
  company: 'Test',
  hhApply: { hhSiteState: 'invited' },
});
assert.equal(invited.bucket, 'E');

const digest = runIntelligenceLoop({ writeDigest: false });
assert.ok(digest.buckets, 'digest buckets');
assert.ok(digest.bySource, 'bySource');
assert.ok(digest.byTier, 'byTier');

console.log('test-intelligence-loop: OK');
