import assert from 'node:assert/strict';
import { assessKeywordGap } from '../lib/resume-keyword-gap.mjs';
import {
  loadMarketSkills,
  compareMarketVsCv,
  compareMarketVsVacancy,
  buildMarketSkillsReport,
} from '../lib/market-skills.mjs';

const bundle = loadMarketSkills('devops');
assert.ok(bundle.skills.length >= 10, 'devops skills loaded');
assert.equal(bundle.role, 'devops');

const cvText = 'Опыт Linux, Docker, Kubernetes, CI/CD, Grafana и Bash в банке.';
const cmp = compareMarketVsCv(cvText, bundle.skills, { topN: 15 });
assert.ok(cmp.present.includes('Linux'), 'linux present');
assert.ok(cmp.present.includes('Docker'), 'docker present');
assert.ok(cmp.coveragePct > 0, 'coverage > 0');
assert.ok(Array.isArray(cmp.missing), 'missing array');

const vac = {
  title: 'DevOps инженер',
  description: 'Обязательно: Docker, Kubernetes, Terraform, Ansible',
};
const vacCmp = compareMarketVsVacancy(vac, bundle.skills);
assert.ok(vacCmp.overlap.length >= 2, 'vacancy overlap');
assert.ok(vacCmp.jdMustHave.length >= 1, 'jd must have');

const report = buildMarketSkillsReport('devops', cvText, vac);
assert.ok(report.cvCompare.coveragePct === cmp.coveragePct);

const gapBefore = assessKeywordGap(vac, cvText);
const gapAfter = assessKeywordGap(vac, cvText);
assert.equal(gapBefore.gapScore, gapAfter.gapScore, 'gapScore unchanged by market layer');

console.log('test-market-skills: OK');
