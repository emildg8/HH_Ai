import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isVacancyDeferred,
  deferVacancyForDays,
  clearVacancyDefer,
  deferUntilLabel,
} from '../lib/vacancy-defer.mjs';
import { loadQueue, saveQueue, updateVacancyRecord } from '../lib/store.mjs';
import { filterForBatchScope } from '../lib/batch-scope.mjs';
import { buildOutcomeFeedbackBlock } from '../lib/outcome-feedback.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
process.env.HH_VACANCIES_QUEUE_FILE = path.join(ROOT, 'data', 'test-defer-queue.json');

const qf = process.env.HH_VACANCIES_QUEUE_FILE;
if (fs.existsSync(qf)) fs.unlinkSync(qf);

saveQueue([
  {
    id: 't1',
    vacancyId: '9001',
    title: 'DevOps',
    status: 'pending',
    descriptionPreview: 'x'.repeat(100),
  },
]);

assert.equal(isVacancyDeferred({ deferUntil: new Date(Date.now() + 86_400_000).toISOString() }), true);
assert.equal(isVacancyDeferred({}), false);

deferVacancyForDays('t1', 2);
const rec = loadQueue()[0];
assert.ok(isVacancyDeferred(rec));
assert.ok(deferUntilLabel(rec).length > 0);

const batchItems = filterForBatchScope(loadQueue(), 'noQuestionnaire');
assert.equal(batchItems.length, 0);

clearVacancyDefer('t1');
assert.equal(isVacancyDeferred(loadQueue()[0]), false);

const block = buildOutcomeFeedbackBlock([
  { action: 'invited', title: 'SRE', letterExcerpt: 'Здравствуйте, готов обсудить on-call' },
  { action: 'declined', title: 'Sales', reason: 'не наш профиль' },
]);
assert.match(block, /приглашения/i);
assert.match(block, /Отказы/i);

fs.unlinkSync(qf);
console.log('test-vacancy-defer: OK');
