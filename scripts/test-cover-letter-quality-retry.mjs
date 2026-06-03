import assert from 'node:assert/strict';
import {
  anyVariantPassesQuality,
  buildQualityRetryUserPrompt,
} from '../lib/cover-letter-quality-retry.mjs';

const rec = { title: 'Data Engineer', geminiSummary: 'ETL' };
const prefs = {};

assert.equal(
  anyVariantPassesQuality(
    ['Здравствуйте! Готов обсудить вакансию и выйти на связь.'],
    { title: 'DevOps инженер' },
    'devops',
    prefs
  ),
  false
);
assert.equal(
  anyVariantPassesQuality(
    [
      'Здравствуйте! Откликаюсь на Data Engineer: SQL, ETL/DWH, сопровождение пайплайнов, 7000+ кейсов в банковском контуре. Готов обсудить стек и задачи команды.',
    ],
    rec,
    'data',
    prefs
  ),
  true
);

const prompt = buildQualityRetryUserPrompt(rec, 'ETL SQL', 3, 'data');
assert.match(prompt, /Data Engineer/i);
assert.match(prompt, /JSON/i);

console.log('test-cover-letter-quality-retry: OK');
