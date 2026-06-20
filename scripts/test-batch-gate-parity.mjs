/**
 * Батч и precheck используют один и тот же PreApplyGate (requireLetter + batchLetterMinScore10).
 */
import assert from 'node:assert/strict';
import { previewApplyGate } from '../lib/apply-gate.mjs';
import { mapGateVerdictToPrecheckKey } from '../lib/batch-gate-skip.mjs';
import { DEFAULT_APPLY_INTELLIGENCE } from '../lib/apply-intelligence-prefs.mjs';

const prefs = {
  applyIntelligence: { ...DEFAULT_APPLY_INTELLIGENCE, enabled: true, minGateScore: 60 },
  batchLetterMinScore10: 8,
  minKeywordGapScore: 20,
  requireRemote: false,
  allowHybrid: true,
};

const letter =
  'Здравствуйте! Откликаюсь на DevOps. Опыт Linux, Docker, Kubernetes, CI/CD, мониторинг Grafana. Готов обсудить задачи.';
const rec = {
  id: 'parity-1',
  title: 'DevOps инженер',
  company: 'Acme',
  geminiSummary: 'Kubernetes CI/CD удалёнка',
  coverLetter: { approvedText: letter },
  publishedAt: new Date().toISOString(),
};

const cvText = 'DevOps Kubernetes Docker Linux CI/CD Grafana Ansible Terraform';

const gate = await previewApplyGate(rec, {
  prefs,
  cvText,
  allRecords: [],
  userApproved: false,
  requireLetter: true,
});

const precheckKey = gate.pass ? null : mapGateVerdictToPrecheckKey(gate);
const batchWouldSkip = !gate.pass;

assert.equal(typeof gate.gateScore, 'number');
assert.equal(batchWouldSkip, Boolean(precheckKey) || !gate.pass);

const weakLetter = { ...rec, coverLetter: { approvedText: 'Привет' } };
const weakGate = await previewApplyGate(weakLetter, {
  prefs,
  cvText,
  allRecords: [],
  requireLetter: true,
});
assert.equal(weakGate.pass, false);
assert.equal(weakGate.skipReason, 'letter_quality');
assert.equal(mapGateVerdictToPrecheckKey(weakGate), 'letterQuality');

console.log('test-batch-gate-parity: OK');
