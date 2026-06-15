import assert from 'node:assert/strict';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import { parseHabrVacancyHtml } from '../lib/habr-career-parse.mjs';
import { parseDiceHtml } from '../lib/jobboards/parsers/dice.mjs';
import { parseWorkdayHtml } from '../lib/ats/parsers/workday.mjs';

const manual = assessVacancyForApply(
  { source: 'habr', applyMode: 'manual_link', title: 'DevOps engineer', company: 'X' },
  {}
);
assert.equal(manual.eligible, false, 'manual without approve');

const manualOk = assessVacancyForApply(
  { source: 'habr', applyMode: 'manual_link', title: 'DevOps engineer', company: 'X' },
  { userApproved: true }
);
assert.equal(manualOk.eligible, true);

const habr = parseHabrVacancyHtml(
  '<h1 class="page-title">DevOps</h1><div class="vacancy-description">Docker K8s</div>',
  'https://career.habr.com/vacancies/42'
);
assert.equal(habr.externalKey, 'habr:42');

const dice = parseDiceHtml('<a href="https://www.dice.com/job-detail/aaa-bbb-ccc">x</a>');
assert.equal(dice[0].source, 'jobboard');

const wd = parseWorkdayHtml('<div data-automation-id="jobTitle">DevOps Engineer</div>', {
  company: 'Corp',
  url: 'https://example.myworkdayjobs.com/jobs',
});
assert.ok(wd.length >= 1);

console.log('test-ingest-adapters: OK');
