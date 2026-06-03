import assert from 'node:assert/strict';
import {
  evaluateLetterQuality,
  improveApprovedLetterForVacancy,
  letterQualityHints,
  pickBestVariantIndex,
} from '../lib/cover-letter-quality-scan.mjs';

const dataRec = {
  id: '1',
  title: 'Data Engineer',
  geminiSummary: 'ETL DWH',
  coverLetter: {
    status: 'approved',
    approvedText:
      'Здравствуйте! Готов обсудить вакансию и выйти на связь. Имею опыт в командной работе.',
  },
};

const ev = evaluateLetterQuality(dataRec, dataRec.coverLetter.approvedText, 'data', {});
assert.equal(ev.fixable, true);
assert.equal(ev.pass, true);

const imp = improveApprovedLetterForVacancy(dataRec, {});
assert.equal(imp.ok, true);
assert.equal(imp.improved, true);
assert.match(imp.letter, /data engineering|ETL/i);

assert.ok(letterQualityHints('письмо слишком короткое').length >= 1);

assert.equal(
  pickBestVariantIndex(
    [
      { index: 0, pass: false, score: 1 },
      { index: 1, pass: true, rawPass: true, score: 5, letterScore10: 9 },
    ],
    2
  ),
  1
);

console.log('test-cover-letter-quality-scan: OK');
