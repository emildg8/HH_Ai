import assert from 'node:assert/strict';
import { assessVacancyForApply, resumeSelectionMatches } from '../lib/vacancy-targeting.mjs';
import { resetResumeRoutingCache } from '../lib/resume-routing.mjs';

resetResumeRoutingCache();

const offTarget = [
  'Инженер-теплотехник',
  'Менеджер по продажам B2B',
  'Оператор БПЛА',
  'Бухгалтер',
];

for (const title of offTarget) {
  const a = assessVacancyForApply({ title });
  assert.equal(a.eligible, false, `${title} should be off-target`);
  assert.equal(a.category, 'off-target');
}

const onTarget = [
  'Middle DevOps Engineer',
  'Data Engineer (SRE)',
  'Инженер технической поддержки L2',
  'Platform engineer',
];

for (const title of onTarget) {
  const a = assessVacancyForApply({ title });
  assert.equal(a.eligible, true, `${title} should be eligible`);
  assert.ok(a.resumeRole, `${title} should have resumeRole`);
}

const vagueIt = assessVacancyForApply({
  title: 'Системный инженер',
  descriptionPreview: 'Kubernetes, Grafana, Linux, мониторинг',
});
assert.equal(vagueIt.eligible, true, 'vague title with IT hints in description');

const vagueNonIt = assessVacancyForApply({ title: 'Системный инженер' });
assert.equal(vagueNonIt.eligible, false, 'vague title without IT hints');

assert.equal(
  resumeSelectionMatches('DevOps-инженер', { title: 'DevOps-инженер', role: 'devops' }),
  true
);
assert.equal(
  resumeSelectionMatches('Data Engineer', { title: 'Data Engineer', role: 'data' }),
  true
);
assert.equal(
  resumeSelectionMatches('Support L2', { title: 'DevOps-инженер', role: 'devops' }),
  false
);

console.log('test-vacancy-targeting: OK');
