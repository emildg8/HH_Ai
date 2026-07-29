#!/usr/bin/env node
/**
 * Срез 29.07 ship-truth: visibility policy, outcome labels, framing hooks, deliver timeout env.
 *   npm run test:ship-truth
 */
import assert from 'node:assert/strict';
import {
  decideClientsFormBannerPolicy,
  HH_CLIENTS_HINT,
} from '../lib/hh-resume-visibility.mjs';
import { normalizeHuntDayShipOutcome } from '../lib/apply-ship-outcome.mjs';
import {
  detectL2ToneDevopsOpening,
  extractJdHook,
  composeDevopsFramedLetter,
} from '../lib/letter-framing-router.mjs';
import { APPLY_SKIP_REASON_RU } from '../dashboard/public/dashboard-copy-ru.mjs';

// --- visibility policy ---
assert.equal(HH_CLIENTS_HINT.test('Видимость резюме Видно всем работодателям, зарегистрированным на hh.ru'), true);
assert.equal(HH_CLIENTS_HINT.test('Видно компаниям-клиентам HeadHunter'), true);

const ignored = decideClientsFormBannerPolicy({
  resumeLooksClients: true,
  formVisibilityBlocked: true,
});
assert.equal(ignored.ok, true);
assert.equal(ignored.formBannerIgnored, true);
assert.equal(ignored.reason, 'false_positive_already');

const realBlock = decideClientsFormBannerPolicy({
  resumeLooksClients: false,
  formVisibilityBlocked: true,
});
assert.equal(realBlock.ok, false);
assert.equal(realBlock.reason, 'resume_visibility');

const clean = decideClientsFormBannerPolicy({
  resumeLooksClients: true,
  formVisibilityBlocked: false,
});
assert.equal(clean.ok, true);
assert.equal(clean.formBannerIgnored, undefined);

// --- outcome honesty ---
assert.match(
  normalizeHuntDayShipOutcome({
    pointStatus: 'skip',
    reason: 'false_positive_already',
    errorMessage: 'Резюме уже видно работодателям; баннер Magritte',
  }).error,
  /видимост|Magritte|баннер/i
);
assert.equal(
  normalizeHuntDayShipOutcome({ pointStatus: 'skip' }).error,
  'пропуск'
);
assert.equal(
  normalizeHuntDayShipOutcome({ pointStatus: 'skipped-repeat' }).error,
  'уже отклик / повтор'
);
assert.match(APPLY_SKIP_REASON_RU.false_positive_already, /Magritte|видимост/i);

// --- framing: infra L2 ok; opening hook without postgres-only ---
const l2ish =
  'Здравствуйте! Откликаюсь на роль. На Linux писал регламенты, сопровождал PostgreSQL и Zabbix, разбор инцидентов.';
assert.equal(detectL2ToneDevopsOpening({ title: 'DevOps', huntTrack: 'devops' }, l2ish).ok, false);
assert.equal(
  detectL2ToneDevopsOpening({ title: 'Системный инженер', huntTrack: 'infra' }, l2ish).ok,
  true
);

const hookPg = extractJdHook({
  title: 'Системный инженер',
  company: 'TestCo',
  description: 'Нужен Linux и PostgreSQL админ без CI',
});
assert.match(hookPg.hook, /CI\/CD|автоматизац/i);
assert.doesNotMatch(hookPg.hook, /PostgreSQL/i);

const framed = composeDevopsFramedLetter({
  title: 'Системный инженер',
  company: 'АльфаСтрахование-Жизнь',
  huntTrack: 'infra',
  description: 'Linux PostgreSQL',
});
assert.ok(framed.length >= 280);
assert.equal(
  detectL2ToneDevopsOpening(
    { title: 'Системный инженер', huntTrack: 'infra', company: 'АльфаСтрахование-Жизнь' },
    framed
  ).ok,
  true
);

// --- deliver timeout env (read-only contract) ---
const prev = process.env.HH_DELIVER_LETTER_TIMEOUT_MS;
process.env.HH_DELIVER_LETTER_TIMEOUT_MS = '90000';
assert.equal(String(process.env.HH_DELIVER_LETTER_TIMEOUT_MS), '90000');
if (prev === undefined) delete process.env.HH_DELIVER_LETTER_TIMEOUT_MS;
else process.env.HH_DELIVER_LETTER_TIMEOUT_MS = prev;

console.log('OK: test-ship-truth-2026-07-29.mjs');
