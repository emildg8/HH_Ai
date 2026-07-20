/**
 * L0 mid letter quality — SESSION-2026-07-20-letter-quality-fix
 */
import assert from 'node:assert/strict';
import {
  detectJuniorStretchLetter,
  detectInformalBrandGreeting,
  detectDevopsDbFirstFraming,
  resolveLetterMinLength,
} from '../lib/letter-mid-quality.mjs';
import { sanitizeCoverLetterRuTerms } from '../lib/letter-ru-sanitize.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';
import { assessLetterQualityForBatch } from '../lib/letter-batch-gate.mjs';

assert.equal(detectJuniorStretchLetter('уже практикуюсь в проектах').ok, false);
assert.equal(detectJuniorStretchLetter('В IT_One держал SLA выше 85%').ok, true);

assert.equal(
  detectInformalBrandGreeting(
    { company: 'Лаборатория Касперского', title: 'DevOps' },
    'Привет! Ищу роль'
  ).ok,
  false
);
assert.equal(
  detectInformalBrandGreeting({ company: 'ООО Ромашка', title: 'DevOps' }, 'Привет! Ищу роль').ok,
  true
);

assert.equal(
  detectDevopsDbFirstFraming(
    { title: 'DevOps-инженер' },
    'Здравствуйте! Сопровождал MSSQL/MySQL: бэкапы и реплики. Писал Bash.'
  ).ok,
  false
);
assert.equal(
  detectDevopsDbFirstFraming(
    { title: 'DevOps-инженер' },
    'Здравствуйте! На Linux писал Bash; базы — часть эксплуатации. Готов обсудить.'
  ).ok,
  true
);

assert.equal(resolveLetterMinLength({}, 'devops', {}), 320);
assert.equal(resolveLetterMinLength({ batchLetterMinLength: 90 }, 'devops', { HH_LETTER_MIN_CHARS: '0' }), 90);
assert.equal(resolveLetterMinLength({ batchLetterMinLength: 400 }, 'qa', {}), 400);

const petBroken = sanitizeCoverLetterRuTerms(
  'Здравствуйте! В pet-проектах собирал пайплайны. MTTR −15%.'
);
assert.doesNotMatch(petBroken, /-\s*проект/);
assert.match(petBroken, /собственн/i);

const shortOkShape =
  'Здравствуйте! Откликаюсь на DevOps-инженера. В IT_One Linux и Bash, SLA выше 85%. Готов обсудить стек.';
assert.ok(shortOkShape.length >= 90 && shortOkShape.length < 320);
assert.equal(
  assessLetterQuality({ title: 'DevOps', huntTrack: 'devops', company: 'X' }, shortOkShape, 'devops', {})
    .pass,
  true,
  'базовый assess без mid-floor пропускает короткое (фикстуры)'
);
assert.equal(
  assessLetterQualityForBatch(
    { title: 'DevOps', huntTrack: 'devops', company: 'X' },
    shortOkShape,
    'devops',
    {}
  ).pass,
  false,
  'batch/point gate: короткое devops-письмо падает на min 320'
);

const midGood =
  'Здравствуйте! Откликаюсь на DevOps-инженера в МАГНИТ IT. До июня 2026 в IT_One настраивал доступы и ротацию секретов, писал Bash под регламенты Linux, сопровождал PostgreSQL и мониторинг; в Softline — внутренние контуры и доступы. Близко к задаче связать Vault с приложениями платформы. Готов обсудить стек и формат работы.';
assert.equal(
  assessLetterQuality(
    { title: 'DevOps-инженер/Vault-инженер', huntTrack: 'devops', company: 'МАГНИТ' },
    midGood,
    'devops',
    {}
  ).pass,
  true
);

const juniorKaspersky =
  'Привет! Ищу DevOps в Касперского. В IT_One Linux, MTTR 15%. С Kubernetes уже практикуюсь в проектах. Готов обсудить приоритеты команды и стек работы дальше.';
assert.equal(
  assessLetterQuality(
    { title: 'DevOps Engineer (IDP)', huntTrack: 'devops', company: 'Лаборатория Касперского' },
    juniorKaspersky + ' '.repeat(200),
    'devops',
    {}
  ).pass,
  false
);

console.log('test-letter-mid-quality: ok');
