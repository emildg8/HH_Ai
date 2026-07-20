/**
 * Letter framing router — tests (SESSION 20.07 DevOps vs L2 tone).
 */
import assert from 'node:assert/strict';
import {
  extractJdHook,
  resolveLetterFramingBundle,
  buildLetterFramingPromptBlock,
  detectL2ToneDevopsOpening,
  composeDevopsFramedLetter,
  assessLetterFramingRisks,
} from '../lib/letter-framing-router.mjs';
import { assessLetterQualityForBatch } from '../lib/letter-batch-gate.mjs';

assert.equal(extractJdHook({ title: 'DevOps/Vault-инженер' }).category, 'vault');
assert.equal(extractJdHook({ title: 'DevOps Engineer (IDP)' }).category, 'idp');
assert.equal(extractJdHook({ title: 'DevOps в команду Автоматизации ЕФО' }).category, 'automation');

const l2ish =
  'Здравствуйте! Откликаюсь на DevOps. На Linux писал регламенты, сопровождал PostgreSQL и Zabbix, разбор инцидентов на контуре из 3+ сервисов. Готов обсудить.';
assert.equal(
  detectL2ToneDevopsOpening({ title: 'DevOps', huntTrack: 'devops' }, l2ish).ok,
  false
);

const devopsOk =
  'Зdравствуйте! Откликаюсь на DevOps/Vault. До июня 2026 в IT_One настраивал доступы и ротацию секретов, сопровождал релизы и CI/CD на Linux. Близко к Vault на платформе. Готов обсудить стек.';
assert.equal(
  detectL2ToneDevopsOpening({ title: 'DevOps Vault', huntTrack: 'devops' }, devopsOk.replace('Зd', 'Зд')).ok,
  true
);

const bundle = resolveLetterFramingBundle({ title: 'DevOps Engineer', huntTrack: 'devops' });
assert.ok(bundle.leadFacts.length >= 2);
assert.ok(bundle.forbiddenOpening.some((x) => /SLA Softline/i.test(x)));
assert.ok(buildLetterFramingPromptBlock({ title: 'DevOps IDP', huntTrack: 'devops' }).includes('FRAMING ROUTER'));

const magRec = {
  title: 'DevOps-инженер/Vault-инженер',
  company: 'МАГНИТ IT',
  huntTrack: 'devops',
};
const magLetter = composeDevopsFramedLetter(magRec);
assert.match(magLetter, /секрет|Vault|доступ/i);
assert.match(magLetter, /CI|релиз|автомат/i);
assert.equal(detectL2ToneDevopsOpening(magRec, magLetter).ok, true);
assert.equal(assessLetterQualityForBatch(magRec, magLetter, 'devops', {}).pass, true);

const risk = assessLetterFramingRisks(magRec, l2ish);
assert.ok(risk.activeRisks.length >= 1);
assert.equal(assessLetterFramingRisks(magRec, magLetter).ok, true);

console.log('test-letter-framing-router: ok');
