import assert from 'node:assert/strict';
import { auditText } from '../lib/ai-writing-audit.mjs';
import { AIDetector } from '../vendor/avoid-ai-writing/detector/patterns.js';

const en = AIDetector.analyzeText('I am excited to delve into this robust holistic solution.');
assert.ok(en.score >= 15);

const ru = auditText(
  'Я откликаюсь на вакансию. Командный игрок со стрессоустойчивостью. В связи с вышеизложенным осуществлял задачи.',
  { maxScore: 35 }
);
assert.equal(ru.pass, false);

const ok = auditText('Здравствуйте! В банке сопровождал Linux и Docker: 40+ инцидентов L2 в месяц, SLA 99.9%.', {
  maxScore: 35,
});
assert.equal(ok.pass, true);

console.log('test-ai-writing-audit: OK');
