/**
 * Wave fingerprint + apology sanitize (письма 16.07) + point-day IT_One (20.07).
 *   node scripts/test-letter-wave-fingerprint.mjs
 */
import assert from 'node:assert/strict';
import {
  analyzeWaveLetterFingerprints,
  analyzePointDayWaveLetterFingerprints,
  letterHasMttr15Fingerprint,
  letterHasSameItOneOpeningFingerprint,
  collectPointDayWaveLetterItems,
} from '../lib/letter-wave-fingerprint.mjs';
import {
  sanitizeCoverLetterRuTerms,
  detectWeakLetterFraming,
} from '../lib/letter-ru-sanitize.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';

assert.equal(
  letterHasMttr15Fingerprint('Сократил время реакции на критические сбои примерно на 15%.'),
  true
);
assert.equal(letterHasMttr15Fingerprint('До июня 2026 сопровождал контуры СБП.'), false);

assert.equal(
  letterHasSameItOneOpeningFingerprint(
    'До июня 2026 в IT_One вёл L2 на контурах СБП: инциденты, релизы, регламенты. Grafana.'
  ),
  true
);
assert.equal(
  letterHasSameItOneOpeningFingerprint('В Softline руководил линией. Linux.'),
  false
);

const waveBad = analyzeWaveLetterFingerprints([
  { id: 'a', company: 'A', letter: 'Здравствуйте! В IT_One MTTR −15%. Linux.' },
  { id: 'b', company: 'B', letter: 'Здравствуйте! Сократил время реакции примерно на 15%.' },
  { id: 'c', company: 'C', letter: 'Здравствуйте! Сократил время реагирования примерно на 15%.' },
]);
assert.equal(waveBad.ok, false);
assert.ok(waveBad.blockers.some((b) => /15%|MTTR/i.test(b)));

const waveOk = analyzeWaveLetterFingerprints([
  { id: 'a', company: 'A', letter: 'Здравствуйте! В IT_One MTTR −15%. Linux.' },
  {
    id: 'b',
    company: 'B',
    letter: 'Здравствуйте! До июня 2026 на СБП вёл релизы и Grafana. Готов обсудить.',
  },
  {
    id: 'c',
    company: 'C',
    letter: 'Здравствуйте! Softline — внедрения; IT_One — 7000+ обращений на СБП. Удалёнка ок.',
  },
]);
assert.equal(waveOk.ok, true);

const pointWave = analyzePointDayWaveLetterFingerprints([
  {
    id: 'a',
    company: 'A',
    letter: 'До июня 2026 в IT_One вёл L2 на контурах СБП: релизы. Grafana/Kibana.',
  },
  {
    id: 'b',
    company: 'B',
    letter: 'В IT_One на контурах СБП сократил инциденты. Логи и SQL.',
  },
]);
assert.equal(pointWave.ok, false);
assert.ok(pointWave.blockers.some((b) => /point-wave|IT_One/i.test(b)));

const dayItems = collectPointDayWaveLetterItems(
  [
    {
      id: 'old',
      status: 'applied',
      appliedAt: '2020-01-01T00:00:00.000Z',
      coverLetter: { approvedText: 'Старое письмо с 15%.' },
    },
    {
      id: 'today',
      status: 'applied',
      hhApply: { appliedAt: new Date().toISOString() },
      company: 'TodayCo',
      coverLetter: { approvedText: 'Сегодняшнее письмо.' },
    },
    {
      id: 'pend',
      status: 'pending',
      coverLetter: { approvedText: 'Черновик pending не в волне.' },
    },
    {
      id: 'short',
      status: 'pending',
      coverLetter: { approvedText: 'В shortlist дня.' },
    },
  ],
  { now: new Date(), shortlistIds: ['short'], focusId: 'focus-x' }
);
assert.ok(dayItems.some((x) => x.id === 'today'));
assert.ok(dayItems.some((x) => x.id === 'short'));
assert.ok(!dayItems.some((x) => x.id === 'pend'), 'pending без shortlist не в волне');
assert.ok(!dayItems.some((x) => x.id === 'old'));

const apology =
  'Здравствуйте! Откликаюсь на DevOps. Коммерческий Kubernetes/Terraform в письме не приписываю: готов наращивать. MTTR −15%.';
assert.equal(detectWeakLetterFraming(apology).ok, false);
const cleaned = sanitizeCoverLetterRuTerms(apology);
assert.doesNotMatch(cleaned, /не\s+приписываю/i);

const cisco =
  'Здравствуйте! Linux. Сетевой стек Cisco в коммерции не веду как основной профиль: опираюсь на серверы. Готов.';
assert.equal(detectWeakLetterFraming(cisco).ok, false);
assert.doesNotMatch(sanitizeCoverLetterRuTerms(cisco), /не\s+веду/i);
assert.equal(
  assessLetterQuality({ title: 'Системный инженер', huntTrack: 'infra' }, cisco, 'infra', {}).pass,
  false
);

console.log('ok: test-letter-wave-fingerprint');
