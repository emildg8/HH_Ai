import assert from 'node:assert/strict';
import { ingestVacancyPayload } from '../lib/vacancy-ingest.mjs';
import { loadQueue, saveQueue } from '../lib/store.mjs';

const key = `habr:77777-test-${Date.now()}`;
const r = await ingestVacancyPayload(
  {
    source: 'habr',
    url: 'https://career.habr.com/vacancies/77777',
    title: 'DevOps инженер',
    company: 'Test',
    description: '',
    applyMode: 'manual_link',
    externalKey: key,
  },
  { skipScore: true }
);
if (r.added && r.record?.id) {
  saveQueue(loadQueue().filter((x) => x.id !== r.record.id));
}
assert.ok(r.added || r.reason?.includes('duplicate'), String(r.reason || 'added'));
assert.ok(!r.added || (r.record?.descriptionPreview?.length || 0) >= 40, 'description filled');

console.log('test-ingest-description-fallback: OK');
