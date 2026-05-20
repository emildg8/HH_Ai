import assert from 'node:assert/strict';
import {
  normalizeBatchScope,
  applyViewToBatchScope,
  filterForBatchScope,
} from '../lib/batch-scope.mjs';

const prefs = {};

const base = [
  { id: 'a', status: 'pending', url: 'https://hh.ru/1', scoreOverall: 60 },
  {
    id: 'q',
    status: 'pending',
    url: 'https://hh.ru/2',
    scoreOverall: 55,
    hhApply: { questionnaire: { status: 'pending_manual' } },
  },
  {
    id: 'h',
    status: 'pending',
    url: 'https://hh.ru/3',
    scoreOverall: 70,
    title: 'Senior DevOps',
  },
  {
    id: 'done',
    status: 'pending',
    url: 'https://hh.ru/4',
    scoreOverall: 80,
    hhApply: { responseSubmitted: true, lastAt: '2026-01-01T00:00:00.000Z' },
  },
];

assert.equal(normalizeBatchScope('no-questionnaire'), 'noQuestionnaire');
assert.equal(applyViewToBatchScope('applied'), null);

const noQ = filterForBatchScope(base, 'noQuestionnaire', prefs);
assert.ok(noQ.some((x) => x.id === 'a'));
assert.ok(!noQ.some((x) => x.id === 'q'));

const withQs = [
  ...base,
  {
    id: 'probed',
    status: 'pending',
    url: 'https://hh.ru/5',
    scoreOverall: 65,
    hhApply: {
      questionnaire: {
        status: 'draft',
        questions: [{ index: 0, label: 'Опыт?', type: 'text' }],
      },
    },
  },
];
assert.ok(!filterForBatchScope(withQs, 'noQuestionnaire', prefs).some((x) => x.id === 'probed'));
assert.ok(!noQ.some((x) => x.id === 'h'));
assert.ok(!noQ.some((x) => x.id === 'done'));

const queue = filterForBatchScope(base, 'queue', prefs);
assert.ok(queue.some((x) => x.id === 'a'));
assert.ok(queue.some((x) => x.id === 'q'));
assert.ok(!queue.some((x) => x.id === 'h'));

const quest = filterForBatchScope(base, 'questionnaire', prefs);
assert.deepEqual(
  quest.map((x) => x.id),
  ['q']
);

const likelyHint = {
  id: 'hint',
  status: 'pending',
  url: 'https://hh.ru/6',
  scoreOverall: 50,
  hhApply: { questionnaire: { likelyFromVacancyText: true, questions: [] } },
};
const questWithHint = filterForBatchScope([...base, likelyHint], 'questionnaire', prefs);
assert.ok(questWithHint.some((x) => x.id === 'hint'));
assert.ok(!filterForBatchScope([...base, likelyHint], 'noQuestionnaire', prefs).some((x) => x.id === 'hint'));

const hidden = filterForBatchScope(base, 'hidden', prefs);
assert.deepEqual(
  hidden.map((x) => x.id),
  ['h']
);

console.log('test-batch-scope: OK');
