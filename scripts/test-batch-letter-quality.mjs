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

const lab80Rec = {
  title: 'DevOps Engineer Middle',
  company: 'АО Лаб80',
  salaryRaw: 'от 180 000 до 200 000 ₽ за месяц, на руки',
  geminiSummary:
    'Вакансия DevOps Engineer Middle в АО Лаб80 требует опыта с Ubuntu Server, Ansible, GitLab CI/CD, Docker и администрированием серверов. Зарплата от 180 000 до 200 000 ₽ за месяц.',
};
const lab80Letter =
  'Здравствуйте! Ваша вакансия DevOps Engineer Middle в АО Лаб80 требует опыта с Ubuntu Server, Ansible, GitLab CI/CD, Docker и администрированием серверов. Зарплата от 180 000 до 200 000 ₽ за месяц.';
const lab80 = assessLetterQuality(lab80Rec, lab80Letter, 'devops', {
  batchLetterRequireMetric: true,
});
assert.equal(lab80.pass, false);
assert.match(lab80.reason, /пересказ вакансии без фактов кандидата/i);

const salaryOnlyRecap =
  'Здравствуйте! Вакансия DevOps Engineer Middle требует опыта с Ubuntu Server, Ansible, GitLab CI/CD, Docker. Зарплата от 180 000 до 200 000 ₽ за месяц.';
const salaryRecap = assessLetterQuality(lab80Rec, salaryOnlyRecap, 'devops', {
  batchLetterRequireMetric: true,
});
assert.equal(salaryRecap.pass, false);
assert.match(salaryRecap.reason, /пересказ требований вакансии без фактов кандидата/i);

const goodVacancyPhrase = assessLetterQuality(
  lab80Rec,
  'Здравствуйте! Ваша вакансия DevOps близка моему профилю: Linux, Docker, GitLab CI/CD, мониторинг и инциденты в банковских контурах. В IT_One на контурах СБП снижал MTTR примерно на 15% за счёт runbooks и мониторинга. Готов обсудить задачи.',
  'devops',
  { batchLetterRequireMetric: true }
);
assert.equal(goodVacancyPhrase.pass, true);

console.log('test-batch-letter-quality: OK');

