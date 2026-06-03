import assert from 'node:assert/strict';
import { assessLetterQuality } from '../lib/letter-quality.mjs';

const rec = { title: 'DevOps инженер' };

const ok = assessLetterQuality(
  rec,
  'Здравствуйте! Откликаюсь на DevOps-инженера. Есть опыт Linux, Docker, Kubernetes, CI/CD и мониторинга. Готов обсудить задачи команды.',
  'devops',
  {}
);
assert.equal(ok.pass, true);

const short = assessLetterQuality(rec, 'Здравствуйте! Готов обсудить.', 'devops', {});
assert.equal(short.pass, false);
assert.match(short.reason, /слишком короткое/i);

const placeholder = assessLetterQuality(
  rec,
  'Здравствуйте! [company] Вставьте ваш текст письма сюда. Расскажите о ваших навыках, опыте и мотивации отклика.',
  'devops',
  {}
);
assert.equal(placeholder.pass, false);
assert.match(placeholder.reason, /плейсхолдер|черновик/i);

const roleMismatch = assessLetterQuality(
  rec,
  'Здравствуйте! Готов обсудить вакансию и выйти на связь в удобное время. Имею опыт в командной работе и внимателен к деталям.',
  'devops',
  { batchLetterMinLength: 90 }
);
assert.equal(roleMismatch.pass, false);
assert.match(roleMismatch.reason, /профиль роли/i);

import { prepareCoverLetterForSend } from '../lib/cover-letter-prepare.mjs';

const dataRec = { title: 'Data Engineer', geminiSummary: 'ETL DWH' };
const fixed = prepareCoverLetterForSend(
  dataRec,
  'Здравствуйте! Готов обсудить вакансию и выйти на связь в удобное время.',
  'data'
);
const dataOk = assessLetterQuality(dataRec, fixed, 'data', { batchLetterMinLength: 90 });
assert.equal(dataOk.pass, true);

console.log('test-batch-letter-quality: OK');

