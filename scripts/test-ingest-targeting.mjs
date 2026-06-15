import assert from 'node:assert/strict';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';

const hh = assessVacancyForApply(
  {
    source: 'hh',
    applyMode: 'hh_auto',
    vacancyId: '1',
    title: 'DevOps инженер',
    company: 'Bank',
    workFormatLine: 'удалённо',
    descriptionPreview: 'Docker Linux Kubernetes CI/CD',
  },
  { prefs: { requireRemote: false, allowHybrid: true } }
);
assert.equal(typeof hh.eligible, 'boolean');

const ats = assessVacancyForApply(
  { source: 'ats', applyMode: 'ats_form', title: 'SRE', company: 'Cloud' },
  { userApproved: true }
);
assert.equal(ats.eligible, true);

console.log('test-ingest-targeting: OK');
