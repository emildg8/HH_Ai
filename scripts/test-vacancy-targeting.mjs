import assert from 'node:assert/strict';
import { assessVacancyForApply, resumeSelectionMatches } from '../lib/vacancy-targeting.mjs';
import { resetResumeRoutingCache } from '../lib/resume-routing.mjs';

resetResumeRoutingCache();

const offTarget = [
  'Инженер-теплотехник',
  'Менеджер по продажам B2B',
  'Региональный представитель по Восточной Сибири',
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
      a.category === 'off-target-facility' ||
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

const backendDevOpsLean = assessVacancyForApply({
  title: 'Middle Backend-разработчик с уклоном в DevOps',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(
  backendDevOpsLean.eligible,
  false,
  'Backend-разработчик с уклоном в DevOps — не целевая роль'
);
assert.equal(backendDevOpsLean.category, 'off-target-dev-outside-profile');

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
// Голый «Инженер по эксплуатации» = facility раньше industrial (кириллица/AHO); оба off-target OK
assert.ok(
  ['off-target-industrial', 'off-target-facility'].includes(
    neutralTitleIndustrialByDescription.category
  ),
  `expected industrial|facility, got ${neutralTitleIndustrialByDescription.category}`
);
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

const spbRemote = assessVacancyForApply({
  title: 'Инженер технической поддержки',
  company: 'Nedra Digital',
  remoteNote: 'удалёнка · Санкт-Петербург · удалёнка явно',
  workFormat: {
    format: 'удалёнка',
    city: 'Санкт-Петербург',
    hasRemote: true,
    officeOnly: false,
  },
  address: 'Санкт-Петербург, Василеостровская',
});
assert.equal(spbRemote.eligible, false, 'SPb remote without Moscow should be off-target');
assert.ok(
  spbRemote.category === 'work-format' || spbRemote.category === 'off-target-region',
  `SPb geo block category: ${spbRemote.category}`
);

const spbRemoteRejected = assessVacancyForApply({
  title: 'Инженер технической поддержки',
  remoteNote: 'удалёнка · Санкт-Петербург',
  workFormat: { format: 'удалёнка', city: 'Санкт-Петербург', hasRemote: true },
  address: 'Санкт-Петербург',
});
assert.equal(spbRemoteRejected.eligible, false, 'matchRejectRule spb catches remote SPb');
assert.ok(
  spbRemoteRejected.category === 'work-format' || spbRemoteRejected.category === 'off-target-region'
);

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

const sberFacility = assessVacancyForApply({
  title: 'Специалист по эксплуатации объектов (сервис-менеджер)',
  company: 'Сбер для экспертов',
  descriptionForLlm:
    'эксплуатация объектов недвижимости Банка, офис по адресу: г. Обнинск, разъездной характер',
  workFormatLine: 'офис по адресу: г. Обнинск',
});
assert.equal(sberFacility.eligible, false, 'facility ops Obninsk off-target');
assert.equal(sberFacility.category, 'off-target-facility');

// Cyrillic +\w bug: «эксплуатации зданий» не матчилось → DevOps ready (hunt-day 30.07)
for (const title of [
  'Инженер по эксплуатации зданий и сооружений',
  'Инженер по эксплуатации недвижимости',
  'Инженер по эксплуатации/хаус-мастер',
  'Инженер по эксплуатации',
]) {
  const a = assessVacancyForApply({
    title,
    workFormatLine: 'Формат работы: гибрид',
    address: 'Москва',
  });
  assert.equal(a.eligible, false, `${title} → facility off-target`);
  assert.equal(a.category, 'off-target-facility', `${title} category`);
}

const itOpsLinux = assessVacancyForApply({
  title: 'Инженер по эксплуатации Linux',
  workFormatLine: 'Формат работы: удалённо',
  descriptionForLlm: 'Linux, systemd, мониторинг, инциденты L2',
});
assert.equal(itOpsLinux.eligible, true, 'IT эксплуатация Linux остаётся целевой');

// Авто-поддержка (Правокард) ≠ IT L2: «консультант.*поддерж» ловил l2l3
for (const title of [
  'Консультант линии поддержки автовладельцев',
  'Консультант линии автомобильной поддержки',
]) {
  const a = assessVacancyForApply({
    title,
    company: 'Правокард',
    workFormatLine: 'Формат работы: удалённо',
    descriptionForLlm: 'помощь водителям, ДТП, эвакуатор',
  });
  assert.equal(a.eligible, false, `${title} → не IT L2`);
}

const adasAutonomous = assessVacancyForApply({
  title: 'Системный инженер в команду автономных технологий',
  company: 'Автономный транспорт',
  descriptionForLlm:
    'системного инжиниринга и архитектуры в области систем автономного вождения, управление требованиями',
});
assert.equal(adasAutonomous.eligible, false, 'ADAS autonomous off-target');
assert.equal(adasAutonomous.category, 'off-target-industrial');

const atlasPnr = assessVacancyForApply({
  title: 'Инженер технической поддержки и ПНР',
  company: 'ООО Атлас',
  descriptionForLlm:
    'внедрением и пусконаладкой наших СХД и последующей технической поддержкой, аппаратных комплексов',
});
assert.equal(atlasPnr.eligible, false, 'hardware PNR/СХД off-target');
assert.equal(atlasPnr.category, 'off-target-industrial');

const digitalServiceMgr = assessVacancyForApply({
  title: 'Сервис-менеджер (Электронный чиновник)',
  company: 'ГКУ Инфогород',
  descriptionForLlm: 'поддержка цифровых сервисов, SLA, Service Desk, удалённо',
  workFormatLine: 'Формат работы: удалённо',
});
assert.equal(digitalServiceMgr.eligible, true, 'IT service manager still eligible');

const marksmanL1 = assessVacancyForApply({
  title: 'Инженер технической поддержки',
  company: 'Marksman',
  descriptionForLlm: `
Мы находимся в поиске Инженера технической поддержки (1-я линяя) в государственную корпорацию.
Принимать инциденты; при необходимости эскалировать обращения на 2 и 3 линии поддержки.
Сменный график работы: 1/3 (офис в центре Москвы). Формат работы: на месте работодателя.
`,
  workFormatLine: 'на месте работодателя',
});
assert.equal(marksmanL1.eligible, false, 'Marksman L1 + сутки blocked');
assert.ok(
  marksmanL1.category === 'off-target-l1' || marksmanL1.category === 'work-format',
  `Marksman category: ${marksmanL1.category}`
);

console.log('test-vacancy-targeting: OK');
