import assert from 'node:assert/strict';
import { assessVacancyForApply, resumeSelectionMatches } from '../lib/vacancy-targeting.mjs';
import { resetResumeRoutingCache } from '../lib/resume-routing.mjs';

resetResumeRoutingCache();

const offTarget = [
  'Инженер-теплотехник',
  'Менеджер по продажам B2B',
  'Оператор БПЛА',
  'Бухгалтер',
  'Слесарь',
];

for (const title of offTarget) {
  const a = assessVacancyForApply({ title, workFormatLine: 'Формат работы: удалённо' });
  assert.equal(a.eligible, false, `${title} should be off-target`);
  assert.ok(
    a.category === 'off-target' ||
      a.category === 'off-target-blue-collar' ||
      a.category === 'off-target-industrial' ||
      a.category === 'off-target-sales' ||
      a.category === 'off-target-network' ||
      a.category === 'off-target-l1' ||
      a.category === 'off-target-no-it-profile' ||
      a.category === 'off-target-irrelevant-title' ||
      a.category === 'off-target-overqualified' ||
      a.category === 'off-target-promo' ||
      a.category === 'work-format'
  );
}

const onTarget = [
  'Middle DevOps Engineer',
  'Data Engineer (SRE)',
  'Инженер технической поддержки L2',
  'Platform engineer',
];

for (const title of onTarget) {
  const a = assessVacancyForApply({ title, workFormatLine: 'Формат работы: удалённо' });
  assert.equal(a.eligible, true, `${title} should be eligible`);
  assert.ok(a.resumeRole, `${title} should have resumeRole`);
}

const vagueIt = assessVacancyForApply({
  title: 'Системный инженер',
  workFormatLine: 'Формат работы: удалённо',
  descriptionPreview: 'Kubernetes, Grafana, Linux, мониторинг',
});
assert.equal(vagueIt.eligible, true, 'vague title with IT hints in description');

const vagueNonIt = assessVacancyForApply({ title: 'Системный инженер' });
assert.equal(vagueNonIt.eligible, false, 'vague title without IT hints');

const mlPending = assessVacancyForApply({ title: 'ML-инженер', workFormatLine: 'Формат работы: удалённо' });
assert.equal(mlPending.eligible, true, 'ML-инженер has IT hint in title');

const mlApproved = assessVacancyForApply(
  { title: 'ML-инженер', workFormatLine: 'Формат работы: удалённо' },
  { userApproved: true }
);
assert.equal(mlApproved.eligible, true, 'approved ML should not be skipped');

const aiPending = assessVacancyForApply({ title: 'AI Engineer', workFormatLine: 'Формат работы: удалённо' });
assert.equal(aiPending.eligible, true, 'AI Engineer');

const blueCollarInDescription = assessVacancyForApply({
  title: 'Специалист производства',
  workFormatLine: 'Формат работы: удалённо',
  descriptionPreview: 'Требуется слесарь-ремонтник, работа на станках ЧПУ',
});
assert.equal(blueCollarInDescription.eligible, false, 'blue-collar in description should be skipped');
assert.equal(blueCollarInDescription.category, 'off-target-blue-collar');

const blueCollarCustomPattern = assessVacancyForApply(
  {
    title: 'Специалист участка',
    workFormatLine: 'Формат работы: удалённо',
    descriptionPreview: 'Нужен маляр по металлу на производстве',
  },
  { prefs: { blueCollarPatterns: ['маляр'], allowOfficeMoscow: true } }
);
assert.equal(blueCollarCustomPattern.eligible, false, 'custom blue-collar pattern should be applied');
assert.equal(blueCollarCustomPattern.category, 'off-target-blue-collar');

const l1Support = assessVacancyForApply({
  title: 'Специалист технической поддержки L1',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(l1Support.eligible, false, 'L1 support should be skipped');
assert.equal(l1Support.category, 'off-target-l1');

const salesRole = assessVacancyForApply({
  title: 'Presale инженер',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(salesRole.eligible, false, 'sales/presale should be skipped');
assert.equal(salesRole.category, 'off-target-sales');

const qaRole = assessVacancyForApply({
  title: 'QA инженер / тестировщик',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(qaRole.eligible, false, 'qa should be skipped');
assert.equal(qaRole.category, 'off-target-qa');

const architectRole = assessVacancyForApply({
  title: 'Технический архитектор',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(architectRole.eligible, false, 'architect should be skipped');
assert.equal(architectRole.category, 'off-target-architect');

const seniorDevops = assessVacancyForApply({
  title: 'Senior DevOps инженер',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(seniorDevops.eligible, false, 'senior devops should be skipped');
assert.equal(seniorDevops.category, 'off-target-overqualified');

const techLeadGo = assessVacancyForApply({
  title: 'Tech lead GO',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(techLeadGo.eligible, false, 'software tech lead should be skipped');
assert.equal(techLeadGo.category, 'off-target-overqualified');

const hhAlreadyApplied = assessVacancyForApply({
  title: 'SRE-инженер',
  workFormatLine: 'Формат работы: удалённо',
  hhApply: { hhSiteState: 'already_applied' },
});
assert.equal(hhAlreadyApplied.eligible, false, 'already applied on hh should be skipped');
assert.equal(hhAlreadyApplied.category, 'off-target-hh-state');

const hhAlreadyDeclinedByFeedback = assessVacancyForApply({
  title: 'SRE-инженер',
  workFormatLine: 'Формат работы: удалённо',
  feedbackReason: 'уже отказ на hh.ru',
});
assert.equal(hhAlreadyDeclinedByFeedback.eligible, false, 'already declined on hh should be skipped');
assert.equal(hhAlreadyDeclinedByFeedback.category, 'off-target-hh-state');

const manualRejectedQaByFeedback = assessVacancyForApply({
  title: 'Инженер DevOps',
  status: 'rejected',
  workFormatLine: 'Формат работы: удалённо',
  feedbackReason: 'тестировщик',
});
assert.equal(manualRejectedQaByFeedback.eligible, false, 'manual feedback should down-rank rejected QA');
assert.equal(manualRejectedQaByFeedback.category, 'off-target-qa');

const manualRejectedSecurityTypoByFeedback = assessVacancyForApply({
  title: 'Инженер DevOps',
  status: 'rejected',
  workFormatLine: 'Формат работы: удалённо',
  feedbackReason: 'безопастник',
});
assert.equal(
  manualRejectedSecurityTypoByFeedback.eligible,
  false,
  'manual feedback typo should still map to security reject'
);
assert.equal(manualRejectedSecurityTypoByFeedback.category, 'off-target-security');

const manualRejectedCtoByFeedback = assessVacancyForApply({
  title: 'DevOps инженер',
  status: 'rejected',
  workFormatLine: 'Формат работы: удалённо',
  feedbackReason: 'технический директор (cto)',
});
assert.equal(manualRejectedCtoByFeedback.eligible, false, 'cto should map to overqualified');
assert.equal(manualRejectedCtoByFeedback.category, 'off-target-overqualified');

const manualRejectedDutySupportByFeedback = assessVacancyForApply({
  title: 'SRE инженер',
  status: 'rejected',
  workFormatLine: 'Формат работы: удалённо',
  feedbackReason: 'дежурный',
});
assert.equal(
  manualRejectedDutySupportByFeedback.eligible,
  false,
  'duty support signal should map to l1/support'
);
assert.equal(manualRejectedDutySupportByFeedback.category, 'off-target-l1');

const manualRejectedPresaleByFeedback = assessVacancyForApply({
  title: 'SRE инженер',
  status: 'rejected',
  workFormatLine: 'Формат работы: удалённо',
  feedbackReason: 'пресейл-менеджер по иб',
});
assert.equal(manualRejectedPresaleByFeedback.eligible, false, 'presale signal should map to sales');
assert.equal(manualRejectedPresaleByFeedback.category, 'off-target-sales');

const goDeveloperOutsideProfile = assessVacancyForApply({
  title: 'Go-разработчик Python/Django',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(goDeveloperOutsideProfile.eligible, false, 'go/python developer should be skipped');
assert.ok(
  goDeveloperOutsideProfile.category === 'off-target-dev-outside-profile' ||
    goDeveloperOutsideProfile.category === 'off-target-irrelevant-title'
);

const serviceFieldRole = assessVacancyForApply({
  title: 'Инженер сервисной службы',
  workFormatLine: 'Формат работы: гибрид',
  descriptionPreview: 'Обязателен опыт с ПЛК Siemens, Omron, Delta, Owen',
});
assert.equal(serviceFieldRole.eligible, false, 'service field engineer should be skipped');
assert.equal(serviceFieldRole.category, 'off-target-industrial');

const neutralTitleIndustrialByDescription = assessVacancyForApply({
  title: 'Инженер по эксплуатации',
  workFormatLine: 'Формат работы: удалённо',
  descriptionPreview: 'Нужен опыт пусконаладки, ПЛК Siemens и SCADA',
});
assert.equal(
  neutralTitleIndustrialByDescription.eligible,
  false,
  'industrial signal in description should be skipped'
);
assert.equal(neutralTitleIndustrialByDescription.category, 'off-target-industrial');

const promoCard = assessVacancyForApply({
  title: 'День рождения hh.ru с PRO',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(promoCard.eligible, false, 'promo card should be skipped');
assert.equal(promoCard.category, 'off-target-promo');

const officeOnlyStrict = assessVacancyForApply(
  {
    title: 'DevOps инженер',
    descriptionPreview: 'Инфраструктура, Kubernetes, Linux',
  },
  { prefs: { requireRemote: false } }
);
assert.equal(officeOnlyStrict.eligible, false, 'default strict mode still requires explicit remote for apply');
assert.equal(officeOnlyStrict.category, 'work-format');

const officeOnlyRelaxed = assessVacancyForApply(
  {
    title: 'DevOps инженер',
    descriptionPreview: 'Инфраструктура, Kubernetes, Linux',
  },
  { strictRemoteWork: false, prefs: { requireRemote: false } }
);
assert.equal(officeOnlyRelaxed.eligible, true, 'relaxed mode should allow unknown format when requireRemote=false');

assert.equal(
  resumeSelectionMatches('DevOps-инженер', { title: 'DevOps-инженер', role: 'devops' }),
  true
);
assert.equal(
  resumeSelectionMatches('Data Engineer', { title: 'Data Engineer', role: 'data' }),
  true
);
assert.equal(
  resumeSelectionMatches('Support L2', { title: 'DevOps-инженер', role: 'devops' }),
  false
);

console.log('test-vacancy-targeting: OK');
