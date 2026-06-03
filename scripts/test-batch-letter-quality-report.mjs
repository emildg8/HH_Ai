import assert from 'node:assert/strict';
import fs from 'fs';
import {
  writeLetterQualityReport,
  readLetterQualityReport,
  LETTER_QUALITY_REPORT_FILE,
} from '../lib/batch-letter-quality-report.mjs';

const payload = {
  finishedAt: new Date().toISOString(),
  skipReasons: { 'letter-quality': 2 },
  items: [
    { title: 'DevOps', status: 'letter-quality', reason: 'письмо слишком короткое' },
  ],
};
writeLetterQualityReport(payload);
const r = readLetterQualityReport();
assert.equal(r.letterQualitySkips, 2);
assert.ok(fs.existsSync(LETTER_QUALITY_REPORT_FILE));

console.log('test-batch-letter-quality-report: OK');
