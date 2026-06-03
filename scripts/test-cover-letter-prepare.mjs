import assert from 'node:assert/strict';
import { prepareCoverLetterForSend, pickBestPreparedVariant } from '../lib/cover-letter-prepare.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';

const rec = {
  title: 'Data Engineer / Аналитический инженер',
  geminiSummary: 'ETL, DWH',
};

const generic =
  'Здравствуйте! Откликаюсь на вакансию. Готов обсудить задачи и выйти на связь. Имею опыт в командной работе.';
const prepared = prepareCoverLetterForSend(rec, generic, 'data');
assert.match(prepared, /data engineering|ETL|DWH/i);

const q = assessLetterQuality(rec, prepared, 'data', {});
assert.equal(q.pass, true);

const ranked = pickBestPreparedVariant(
  [
    'Коротко.',
    'Здравствуйте! Data Engineer — SQL, ETL, 7000 кейсов. Готов обсудить.',
  ],
  rec,
  'data'
);
assert.match(ranked, /ETL|data/i);

const placeholder = prepareCoverLetterForSend(
  { title: 'DevOps инженер' },
  'Здравствуйте! На {{ROLE}} — опыт Linux.',
  'devops'
);
assert.match(placeholder, /DevOps инженер/);
assert.doesNotMatch(placeholder, /\{\{ROLE\}\}/);

console.log('test-cover-letter-prepare: OK');
