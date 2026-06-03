import assert from 'node:assert/strict';
import { listLetterIssues } from '../lib/cover-letter-issues.mjs';
import { letterIssueSortKey } from '../lib/letter-score.mjs';

const records = [
  {
    id: 'a',
    title: 'DevOps A',
    coverLetter: {
      status: 'approved',
      approvedText:
        'Здравствуйте. Внедрял Kubernetes и CI/CD, сократил MTTR на 35%. Готов обсудить стек и задачи команды.',
    },
  },
  {
    id: 'b',
    title: 'DevOps B',
    coverLetter: {
      status: 'approved',
      approvedText: 'Привет, интересна вакансия.',
    },
  },
  {
    id: 'c',
    title: 'DevOps C',
    coverLetter: { status: 'draft', variants: ['черновик'] },
  },
];

const { items } = listLetterIssues(records, {}, { limit: 10 });
assert.ok(items.length >= 2, 'expected issues');
assert.equal(items[0].kind, 'fixable', 'fixable should sort before fail');
const keys = items.map((it) => letterIssueSortKey(it));
for (let i = 1; i < keys.length; i++) {
  assert.ok(keys[i] >= keys[i - 1], 'items should be sorted by letterIssueSortKey');
}
assert.ok(
  items.some((it) => it.letterScore10 != null),
  'items should include letterScore10'
);

console.log('test-cover-letter-issues: OK');
