import assert from 'node:assert/strict';
import { summarizeLetterInviteCorrelation } from '../lib/letter-invite-correlation.mjs';

const good =
  'Здравствуйте! Откликаюсь на DevOps: Linux, Docker, Kubernetes, CI/CD, мониторинг. 5+ лет, 200+ релизов. Готов обсудить задачи.';
const weak = 'Здравствуйте! Готов обсудить.';

const records = [
  {
    id: '1',
    title: 'DevOps',
    status: 'responded',
    hhApply: { hhSiteState: 'invited' },
    coverLetter: { status: 'approved', approvedText: good },
  },
  {
    id: '2',
    title: 'DevOps SRE',
    status: 'responded',
    hhApply: { hhSiteState: 'already_applied' },
    coverLetter: { status: 'approved', approvedText: weak },
  },
];

const s = summarizeLetterInviteCorrelation(records, {});
assert.ok(s.withLetter >= 2);
assert.ok(s.invited.count >= 1);
assert.ok(s.applied.count >= 1);

console.log('test-letter-invite-correlation: OK');
