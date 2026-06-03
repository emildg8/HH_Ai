import assert from 'node:assert/strict';
import {
  titleLooksIndustrialOrFieldRole,
  titleLooksTelecomNetworkRole,
  titleLooksSalesOrPresaleRole,
  titleLooksL1HelpdeskRole,
  titleLooksSupportRole,
  isClearlyOverqualifiedTitle,
} from '../lib/role-classify.mjs';
import { runTitleOnlyFilters, recordPassesNotFieldRole } from '../lib/filters.mjs';
import {
  matchRejectRule,
  DEFAULT_REJECT_RULES,
  inferRejectReasonFromRecord,
  inferL1HelpdeskRejectReason,
} from '../lib/reject-role-patterns.mjs';

const prefs = { excludeIrrelevantTitles: true, excludeIrrelevantTitlePatterns: ['android'] };

const industrialTitles = [
  'Сервисный инженер (ДГУ / ГПУ)',
  'Инженер RAN',
  'Инженер-гидротехник',
  'Инженер-сметчик',
  'Геодезист',
  'Инженер по автоматизации процессов разработки',
];

for (const title of industrialTitles) {
  assert.equal(titleLooksIndustrialOrFieldRole(title), true, title);
  assert.equal(runTitleOnlyFilters(title, prefs).pass, false, title);
  assert.equal(recordPassesNotFieldRole({ title }), false, title);
  const hit = matchRejectRule({ title }, DEFAULT_REJECT_RULES);
  assert.ok(hit, `rule for ${title}`);
}

assert.equal(titleLooksTelecomNetworkRole('Сетевой инженер'), true);
assert.equal(titleLooksTelecomNetworkRole('Дежурный сетевой инженер'), true);
assert.equal(matchRejectRule({ title: 'Сетевой инженер' }, DEFAULT_REJECT_RULES)?.rule.id, 'network');

assert.equal(titleLooksSalesOrPresaleRole('Менеджер по продажам облачных сервисов'), true);
assert.equal(matchRejectRule({ title: 'Presale-менеджер по ИБ' }, DEFAULT_REJECT_RULES)?.rule.id, 'sales');

assert.equal(isClearlyOverqualifiedTitle('Старший инженер инфраструктуры и DevOps (GCP, Kubernetes)'), true);
assert.equal(matchRejectRule({ title: 'AQA инженер (Platform V)' }, DEFAULT_REJECT_RULES)?.rule.id, 'qa');
assert.equal(
  matchRejectRule({ title: 'Архитектор инфраструктуры' }, DEFAULT_REJECT_RULES)?.rule.id,
  'architect'
);
assert.equal(
  inferRejectReasonFromRecord({ title: 'Инженер RAN', feedbackReason: '' }),
  'Не IT'
);

assert.equal(runTitleOnlyFilters('DevOps engineer', prefs).pass, true);
assert.equal(runTitleOnlyFilters('SRE engineer', prefs).pass, true);

assert.equal(titleLooksL1HelpdeskRole('Специалист технической поддержки'), true);
assert.equal(titleLooksL1HelpdeskRole('Специалист технической поддержки на Linux L2'), false);
assert.equal(titleLooksSupportRole('Специалист технической поддержки на Linux L2'), true);
assert.equal(runTitleOnlyFilters('Специалист (оператор) технической поддержки', prefs).pass, false);
assert.equal(
  matchRejectRule({ title: 'Специалист чата поддержки' }, DEFAULT_REJECT_RULES)?.rule.id,
  'supportDesk'
);

assert.equal(inferL1HelpdeskRejectReason('Специалист технической поддержки 1С'), 'Поддержка 1С');
assert.equal(inferL1HelpdeskRejectReason('Специалист (оператор) технической поддержки'), 'Оператор L1');
assert.notEqual(
  inferRejectReasonFromRecord({ title: 'Специалист технической поддержки', feedbackReason: 'Техподдержка' }),
  'Техподдержка'
);
assert.equal(inferRejectReasonFromRecord({ title: 'Специалист технической поддержки на Linux L2' }), '');

console.log('test-role-reject-learn: ok');
