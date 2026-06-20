/**
 * Тест порога batchLetterMinScore10 в батче.
 */
import assert from 'node:assert/strict';
import { assessLetterQualityForBatch, passesAutoApproveLetterScore } from '../lib/letter-batch-gate.mjs';
import { evaluateLetterQuality } from '../lib/cover-letter-quality-scan.mjs';

const rec = { title: 'DevOps инженер', geminiSummary: 'Kubernetes CI/CD' };
const letter =
  'Здравствуйте! Откликаюсь на DevOps-инженера. Есть опыт Linux, Docker, Kubernetes, CI/CD и мониторинга. Готов обсудить задачи команды.';

const okLow = assessLetterQualityForBatch(rec, letter, 'devops', { batchLetterMinScore10: 1 });
assert.equal(okLow.pass, true);
assert.ok(okLow.letterScore10 >= 1);

const failHigh = assessLetterQualityForBatch(rec, letter, 'devops', { batchLetterMinScore10: 10 });
assert.equal(failHigh.pass, false);
assert.match(failHigh.reason, /ниже порога 10/);

const ev = evaluateLetterQuality(rec, letter, 'devops', {});
assert.equal(passesAutoApproveLetterScore(ev, { batchLetterMinScore10: 10 }), false);
assert.equal(passesAutoApproveLetterScore(ev, { batchLetterMinScore10: 1 }), true);

console.log('test-batch-letter-min-score10: OK');
