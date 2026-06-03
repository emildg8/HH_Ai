import assert from 'node:assert/strict';
import { countBatchCandidates, listBatchCandidates } from '../lib/batch-candidates.mjs';

const queue = [
  { id: 'p1', status: 'pending', url: 'https://hh.ru/1', scoreOverall: 60 },
  { id: 'p2', status: 'pending', url: 'https://hh.ru/2', scoreOverall: 40 },
  { id: 'a1', status: 'approved', url: 'https://hh.ru/3', scoreOverall: 75 },
  { id: 'a2', status: 'approved', url: 'https://hh.ru/4', scoreOverall: 30 },
];

assert.equal(
  countBatchCandidates({ batchScope: 'queue', queueStatus: 'pending', minScore: 50, queue }),
  1
);
assert.equal(
  countBatchCandidates({ batchScope: 'queue', queueStatus: 'approved', minScore: 50, queue }),
  1
);
assert.deepEqual(
  listBatchCandidates({ batchScope: 'queue', queueStatus: 'approved', minScore: 50, queue }).map((x) => x.id),
  ['a1']
);

console.log('test-batch-candidates: ok');
