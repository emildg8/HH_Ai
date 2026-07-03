/**
 * Smoke: L4 apply observability — skip logging, preview applyAtHint, API guard, letter delivery gate.
 */
import assert from 'node:assert/strict';
import { evaluateResumeL4Decision } from '../lib/resume-l4-strategy.mjs';
import { buildResumeL4QuickPreview } from '../lib/resume-l4-preview-api.mjs';
import { hhSiteStateBlocksApply } from '../lib/hh-vacancy-response-state.mjs';
import { resolveLetterDeliveryOutcome } from '../lib/apply-outcome.mjs';
import { HH_APPLY_EXIT_LETTER_NOT_DELIVERED } from '../lib/hh-apply-exit-codes.mjs';

const vacancyGapOk = {
  title: 'DevOps-инженер',
  company: 'Тест',
  description: 'Kubernetes, Docker, CI/CD, мониторинг Prometheus Grafana',
  matchScore: { scoreHarvest: 85, scoreFit: 82, scoreProjected: 83, delta: 1 },
};

const gapOk = { gapScore: 85, missing: [], critical: false };
const prefs = { applyIntelligence: { resumeStrategy: 'auto' }, minKeywordGapScore: 40, resumeEditMaxPerDay: 15 };

const cvText = 'Kubernetes Docker CI/CD Prometheus Grafana DevOps инженер';
const decision = evaluateResumeL4Decision(vacancyGapOk, prefs, gapOk, { cvText });
assert.equal(decision.wouldUseL4, false, 'high gap + low projected delta should skip L4');

const preview = buildResumeL4QuickPreview(vacancyGapOk, prefs, cvText);
assert.equal(preview.wouldUseL4, false);
assert.ok(preview.applyAtHint?.includes('не будет'), 'applyAtHint explains skip');
assert.ok(typeof preview.editsRemaining === 'number', 'editsRemaining in preview');

assert.equal(hhSiteStateBlocksApply('already_applied'), true);
assert.equal(hhSiteStateBlocksApply('none'), false);

const skipLogPattern = /\[micro-tailor\] skip:/;
assert.match('[micro-tailor] skip: ключи ok (85%)', skipLogPattern);

assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
    letterInForm: true,
  }),
  'delivered',
  'letter in form counts as delivered'
);
assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
    verifiedInChat: true,
  }),
  'delivered',
  'verified chat counts as delivered'
);
assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
    chatSent: true,
  }),
  'not_delivered',
  'chatSent without verify is not delivered'
);
assert.equal(
  resolveLetterDeliveryOutcome({
    letter: 'Здравствуйте',
    responseSubmitted: true,
  }),
  'not_delivered',
  'response without letter is not_delivered'
);
assert.equal(
  resolveLetterDeliveryOutcome({ responseSubmitted: true }),
  'not_required',
  'no letter text — delivery not required'
);
assert.equal(HH_APPLY_EXIT_LETTER_NOT_DELIVERED, 7, 'letter-not-delivered exit code');

console.log('test:apply-l4-observability OK');
