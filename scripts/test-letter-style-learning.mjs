import assert from 'node:assert/strict';
import { buildLetterStyleInsights } from '../lib/letter-style-learning.mjs';

const good =
  'Здравствуйте! Откликаюсь на DevOps: Linux, Docker, Kubernetes, CI/CD, мониторинг Grafana. 5+ лет, 200+ релизов в банковском контуре.';
const weak =
  'Здравствуйте! Готов обсудить вакансию и выйти на связь по вашей позиции. Интересен формат работы и задачи команды.';

const records = [
  {
    hhApply: { hhSiteState: 'invited' },
    coverLetter: { status: 'approved', approvedText: good },
  },
  {
    hhApply: { hhSiteState: 'invited' },
    coverLetter: { status: 'approved', approvedText: good + ' Terraform ansible.' },
  },
  {
    status: 'responded',
    hhApply: { hhSiteState: 'already_applied' },
    coverLetter: { status: 'approved', approvedText: weak },
  },
  {
    status: 'responded',
    hhApply: { hhSiteState: 'already_applied' },
    coverLetter: { status: 'approved', approvedText: weak },
  },
];

const ins = buildLetterStyleInsights(records, {});
assert.equal(ins.invitedCount, 2);
assert.equal(ins.appliedCount, 2);
assert.ok(Array.isArray(ins.topTerms));

console.log('test-letter-style-learning: OK');
