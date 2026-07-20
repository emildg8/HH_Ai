/**
 * L1 letter quality — SESSION-2026-07-20-letter-regression-plan
 * JD-hook · weak-volume · wave без укорочения · МАГНИТ golden · framed fallback
 */
import assert from 'node:assert/strict';
import {
  detectMissingJdHook,
  composeDevopsFramedLetter,
  detectL2ToneDevopsOpening,
} from '../lib/letter-framing-router.mjs';
import { detectWeakVolumeOnlyMetric } from '../lib/letter-mid-quality.mjs';
import { assessLetterQualityForBatch } from '../lib/letter-batch-gate.mjs';
import {
  rewriteMttr15WithoutShorten,
  waveMetricAvoidFlags,
  letterHasMttr15Fingerprint,
} from '../lib/letter-wave-fingerprint.mjs';
import { ensureDevopsLetterMetrics } from '../lib/basket-letter.mjs';

const magRec = {
  title: 'DevOps-инженер/Vault-инженер',
  company: 'МАГНИТ IT',
  huntTrack: 'devops',
};

const magnitLetter =
  'Здравствуйте! Откликаюсь на DevOps-инженера/Vault-инженера в МАГНИТ IT. ' +
  'До июня 2026 в IT_One настраивал доступы и ротацию секретов на Linux-контуре, писал Bash под автоматизацию регламентов, сопровождал релизы с мониторингом. ' +
  'Близко к задаче связать Vault с приложениями платформы. Готов обсудить стек и формат работы команды.';

assert.equal(detectMissingJdHook(magRec, magnitLetter).ok, true, 'МАГНИТ: крючок Vault/секрет в opening');
assert.equal(assessLetterQualityForBatch(magRec, magnitLetter, 'devops', {}).pass, true, 'МАГНИТ batch pass');

const noHook =
  'Здравствуйте! Откликаюсь на DevOps в МАГНИТ. До июня 2026 в IT_One писал Linux-регламенты и смотрел Grafana. Готов обсудить приоритеты команды и формат удалёнки дальше с вами сегодня.';
assert.equal(detectMissingJdHook(magRec, noHook).ok, false, 'Vault title без секретов/Vault → fail');
assert.equal(assessLetterQualityForBatch(magRec, noHook + ' '.repeat(80), 'devops', {}).pass, false);

const weakVol =
  'Здравствуйте! Откликаюсь на DevOps. Сопровождал контур из 3+ сервисов и 2+ инстансов на Linux. Готов обсудить стек команды и задачи автоматизации релизов на вашей платформе дальше.';
assert.equal(detectWeakVolumeOnlyMetric(weakVol).ok, false);
assert.equal(
  assessLetterQualityForBatch(
    { title: 'DevOps Engineer', huntTrack: 'devops', company: 'X' },
    weakVol + ' CI/CD и автоматизация пайплайнов на Linux.'.repeat(2),
    'devops',
    {}
  ).pass,
  false,
  'weak N+ without commercial fact → batch fail'
);

const strongVol =
  'Здравствуйте! Откликаюсь на DevOps. До июня 2026 в IT_One на контурах СБП сопровождал релизы и CI/CD: Linux, Docker, Grafana. Готов обсудить стек и приоритеты команды автоматизации.';
assert.equal(detectWeakVolumeOnlyMetric(strongVol).ok, true);

const restreamL2 =
  'Здравствуйте! Откликаюсь на DevOps в Рестрим. Сопровождал MSSQL и реплики, бэкапы баз, разбор инцидентов на 3+ сервисах. Готов обсудить.';
assert.equal(
  assessLetterQualityForBatch(
    { title: 'DevOps-инженер', company: 'Рестрим', huntTrack: 'devops' },
    restreamL2 + ' '.repeat(100),
    'devops',
    {}
  ).pass,
  false,
  'Рестрим L2/MSSQL-first → fail'
);

const with15 =
  'Здравствуйте! Откликаюсь на DevOps. До июня 2026 в IT_One сопровождал контуры СБП: Linux, Docker, Grafana — время реакции −15%. Готов обсудить стек и задачи платформы.';
const rewritten = rewriteMttr15WithoutShorten(with15);
assert.equal(letterHasMttr15Fingerprint(rewritten), false, 'rewrite убирает −15%');
assert.ok(rewritten.length >= with15.length, 'rewrite не укорачивает');

const flags = waveMetricAvoidFlags([with15]);
assert.equal(flags.avoidMttr15, true);
const afterWave = ensureDevopsLetterMetrics(
  'Здравствуйте! Откликаюсь на DevOps IDP. Нужна метрика опыта. Готов обсудить автоматизацию доступов и CI/CD на Linux-платформе дальше с командой.',
  { seed: 'wave-test-xyz', waveLetters: [with15], avoidMttr15: true }
);
assert.equal(letterHasMttr15Fingerprint(afterWave), false);
assert.ok(afterWave.length >= 100);

const l2ish =
  'Здравствуйте! Откликаюсь на DevOps. На Linux писал регламенты, сопровождал PostgreSQL и Zabbix, разбор инцидентов на контуре из 3+ сервисов. Готов обсудить приоритеты.';
assert.equal(detectL2ToneDevopsOpening({ ...magRec, title: 'DevOps' }, l2ish).ok, false);
const framed = composeDevopsFramedLetter(magRec);
assert.equal(detectL2ToneDevopsOpening(magRec, framed).ok, true);
assert.equal(detectMissingJdHook(magRec, framed).ok, true);
assert.equal(assessLetterQualityForBatch(magRec, framed, 'devops', {}).pass, true, 'framed fallback batch pass');

console.log('test-letter-l1-quality: ok');
