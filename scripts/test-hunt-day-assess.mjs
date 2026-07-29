/**
 * Unit: hunt-day assess verdicts (no browser).
 */
import assert from 'node:assert/strict';
import { assessVacancyForShip, formatHuntDayAssessRu } from '../lib/hunt-day-assess.mjs';
import { freshTierAMaxHours } from '../lib/fresh-tier-a.mjs';

const softPrefs = { pointApplyAutoPrepareLetters: true };

const letterOk =
  'Здравствуйте! Откликаюсь на позицию Системный администратор Linux в Test Infra. Близко к задаче: Linux-контур, CI/CD и автоматизация сопровождения сервисов. 2 года в банковском контуре: Linux-серверы, Grafana; доля дефектов снизилась более чем на 90%. Готов обсудить стек.';

const goRec = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Системный администратор Linux',
  company: 'Test Infra',
  huntTrack: 'infra',
  status: 'pending',
  scoreOverall: 80,
  workFormat: { hasRemote: true, hasHybrid: false },
  remoteNote: 'удалёнка',
  workFormatLine: 'удалённо',
  description: 'Удалённая работа. Linux, Grafana, CI/CD, автоматизация.',
  coverLetter: {
    status: 'approved',
    approvedText: letterOk,
  },
};

const blocked = await assessVacancyForShip(
  {
    ...goRec,
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Account Manager / Менеджер по продажам',
    huntTrack: 'l2l3',
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.equal(blocked.verdict, 'no-go');
assert.ok(blocked.blockers.some((b) => /шумный|sales/i.test(b)));

const l1 = await assessVacancyForShip(
  {
    ...goRec,
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Специалист технической поддержки',
    huntTrack: 'l2l3',
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.equal(l1.verdict, 'no-go');
assert.ok(l1.blockers.some((b) => /L1/i.test(b)));

const l2Helpdesk = await assessVacancyForShip(
  {
    ...goRec,
    id: '44444444-4444-4444-4444-444444444444',
    title: 'Специалист технической поддержки на Linux L2',
    huntTrack: 'l2l3',
    company: 'Good Support',
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.ok(
  !l2Helpdesk.blockers.some((b) => /L1|helpdesk/i.test(b)),
  `L2 не должен резаться L1/helpdesk: ${l2Helpdesk.blockers.join('; ')}`
);

const kryptonit = await assessVacancyForShip(
  {
    ...goRec,
    id: '55555555-5555-5555-5555-555555555555',
    title: 'DevOps инженер',
    company: 'Криптонит',
    huntTrack: 'devops',
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.ok(
  !kryptonit.blockers.some((b) => /криптонит|blockchain|web3/i.test(b)),
  `компания Криптонит не банится assess-regex: ${kryptonit.blockers.join('; ')}`
);

const noLetter = await assessVacancyForShip(
  {
    ...goRec,
    id: '66666666-6666-6666-6666-666666666666',
    userApproved: true,
    coverLetter: { status: 'draft', text: '' },
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.notEqual(noLetter.verdict, 'no-go', `нет письма при soft → не no-go: ${noLetter.blockers.join('; ')}`);
assert.ok(noLetter.warnings.some((w) => /письм/i.test(w)));
assert.ok(!noLetter.blockers.some((b) => /нет письма/i.test(b)));
assert.equal(noLetter.verdict, 'conditional');

const hybridOnly = await assessVacancyForShip(
  {
    ...goRec,
    id: '77777777-7777-7777-7777-777777777777',
    workFormat: { hasRemote: false, hasHybrid: true },
    workFormatLine: 'Формат работы: гибрид',
    remoteNote: '',
    description: 'Гибрид, 2 дня в офисе в Москве.',
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.ok(!hybridOnly.warnings.some((w) => /нет удалёнки и гибрида/i.test(w)));

const officeOnly = await assessVacancyForShip(
  {
    ...goRec,
    id: '88888888-8888-8888-8888-888888888888',
    workFormat: { hasRemote: false, hasHybrid: false },
    remoteNote: '',
    workFormatLine: 'Формат работы: на месте работодателя',
    address: 'Москва',
    description: 'Формат работы: на месте работодателя. Офис.',
  },
  { excludedIds: new Set(), prefs: softPrefs }
);
assert.equal(officeOnly.remote, false, 'live parse: не удалёнка');
assert.ok(
  officeOnly.warnings.some((w) => /нет удалёнки и гибрида/i.test(w)) ||
    officeOnly.blockers.some((b) => /офис|формат/i.test(b)),
  `офис должен warning/blocker: ${JSON.stringify({ w: officeOnly.warnings, b: officeOnly.blockers })}`
);

const prevFresh = process.env.HH_FRESH_TIER_A_MAX_HOURS;
delete process.env.HH_FRESH_TIER_A_MAX_HOURS;
assert.equal(freshTierAMaxHours(), 336);
process.env.HH_FRESH_TIER_A_MAX_HOURS = '72';
assert.equal(freshTierAMaxHours(), 72);
if (prevFresh === undefined) delete process.env.HH_FRESH_TIER_A_MAX_HOURS;
else process.env.HH_FRESH_TIER_A_MAX_HOURS = prevFresh;

const text = formatHuntDayAssessRu({
  message: 'assess: go=1 conditional=0 no-go=1 из 2',
  quotas: [{ track: 'infra', used: 0, quota: 3 }],
  go: [{ score: 80, id8: '11111111', track: 'infra', company: 'A', title: 'Sys' }],
  conditional: [],
  noGo: [{ score: 10, id8: '22222222', track: 'l2l3', company: 'B', blockers: ['шум'] }],
  ritual: 'test',
});
assert.match(text, /ГОДНЫ/);
assert.match(text, /НЕ СЛАТЬ/);

console.log('test-hunt-day-assess: ok');
