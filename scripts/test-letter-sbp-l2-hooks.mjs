/**
 * SBP evidence → letters (SESSION 2026-07-20 evening)
 * Inventory hooks · l2l3/tam framing · devops merchant-lead ban · rollback env
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveLetterFramingBundle,
  buildLetterFramingPromptBlock,
  detectMerchantLeadDevopsOpening,
  composeL2l3FramedLetter,
  composeTamFramedLetter,
  composeDevopsFramedLetter,
} from '../lib/letter-framing-router.mjs';
import { buildL2l3SafeLetter, buildTamSafeLetter } from '../lib/basket-letter-templates.mjs';
import { assessLetterQualityForBatch } from '../lib/letter-batch-gate.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inv = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'candidate-skills-inventory.json'), 'utf8')
);

const sbp = inv.projects.find((p) => p.id === 'bank-sbp-l2');
assert.ok(sbp?.letterSafe, 'bank-sbp-l2 letterSafe');
assert.match(JSON.stringify(sbp.star), /мерчант|QR|Postman/i, 'STAR bank-sbp: мерчант/QR/Postman');
assert.ok(inv.aboutMeByTrack?.l2l3, 'aboutMeByTrack.l2l3');
assert.ok(inv.aboutMeByTrack?.devops, 'aboutMeByTrack.devops');

const merchantTp = inv.talkingPoints.find((t) => /регистрац.*мерчант/i.test(t.text));
assert.ok(merchantTp?.useIn?.includes('letter'), 'talking point мерчант → letter');
assert.ok(!/Interview|не lead/i.test(merchantTp.text), 'letter text без мета-пометок');

const l2Bundle = resolveLetterFramingBundle({ title: 'Специалист L2', huntTrack: 'l2l3' });
assert.ok(l2Bundle.leadFacts.some((x) => /ДПСИТ|заявк/i.test(x)), 'l2l3 lead: ДПСИТ');
assert.ok(l2Bundle.leadFacts.some((x) => /мерчант|СБП/i.test(x)), 'l2l3 lead: СБП мерчант');
assert.match(buildLetterFramingPromptBlock({ title: 'L2', huntTrack: 'l2l3' }), /L2\/L3/);

const tamBundle = resolveLetterFramingBundle({ title: 'TAM', huntTrack: 'tam' });
assert.ok(tamBundle.leadFacts.some((x) => /партнёр|мерчант|статус/i.test(x)), 'tam lead');
assert.match(buildLetterFramingPromptBlock({ title: 'TAM', huntTrack: 'tam' }), /TAM/);

const devopsBan =
  'Здравствуйте! Откликаюсь на DevOps. На СБП вёл регистрацию мерчантов в Service Manager и смотрел Toad. Готов обсудить CI/CD и автоматизацию релизов на Linux дальше с командой.';
assert.equal(
  detectMerchantLeadDevopsOpening({ title: 'DevOps', huntTrack: 'devops' }, devopsBan).ok,
  false,
  'merchant lead devops → fail'
);
assert.equal(
  assessLetterQuality({ title: 'DevOps', huntTrack: 'devops', company: 'X' }, devopsBan, 'devops', {})
    .merchantLeadOpening,
  true
);

const devopsOk = composeDevopsFramedLetter({
  title: 'DevOps-инженер',
  company: 'Тест',
  huntTrack: 'devops',
});
assert.equal(detectMerchantLeadDevopsOpening({ title: 'DevOps', huntTrack: 'devops' }, devopsOk).ok, true);
assert.equal(
  assessLetterQualityForBatch(
    { title: 'DevOps-инженер', company: 'Тест', huntTrack: 'devops' },
    devopsOk,
    'devops',
    {}
  ).pass,
  true
);

const l2Letter = composeL2l3FramedLetter({ title: 'Инженер L2', company: 'Банк', huntTrack: 'l2l3' });
assert.match(l2Letter, /ДПСИТ|заявк/i);
assert.match(l2Letter, /мерчант|QR|Postman/i);
assert.equal(buildL2l3SafeLetter({ title: 'L2', company: 'X' }).includes('мерчант'), true);

const tamLetter = composeTamFramedLetter({ title: 'TAM', company: 'Y' });
assert.match(tamLetter, /партнёр|мерчант|Postman/i);
assert.match(buildTamSafeLetter({ title: 'TAM', company: 'Y' }), /мерчант|Postman/i);

// Откат HH_LETTER_BAN_MERCHANT_LEAD=0
process.env.HH_LETTER_BAN_MERCHANT_LEAD = '0';
assert.equal(
  detectMerchantLeadDevopsOpening({ title: 'DevOps', huntTrack: 'devops' }, devopsBan).ok,
  true,
  'rollback merchant ban'
);
delete process.env.HH_LETTER_BAN_MERCHANT_LEAD;

// Откат HH_LETTER_SBP_L2_HOOKS=0
process.env.HH_LETTER_SBP_L2_HOOKS = '0';
const legacy = composeL2l3FramedLetter({ title: 'L2', company: 'Z' });
assert.ok(!/ДПСИТ/i.test(legacy), 'rollback SBP L2 hooks → без ДПСИТ lead');
assert.match(legacy, /СБП|Grafana/i);
const noPrompt = buildLetterFramingPromptBlock({ title: 'L2', huntTrack: 'l2l3' });
assert.equal(noPrompt, '', 'rollback: no l2l3 framing prompt');
delete process.env.HH_LETTER_SBP_L2_HOOKS;

console.log('test-letter-sbp-l2-hooks: ok');
