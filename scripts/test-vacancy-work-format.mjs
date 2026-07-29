import assert from 'node:assert/strict';
import {
  parseWorkFormatMeta,
  passesWorkFormatForApply,
  passesWorkFormatRules,
  extractHybridOfficeDaysPerWeek,
  syncRecordWorkFormatFields,
  buildWorkFormatNote,
} from '../lib/vacancy-work-format.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import { runHardFilters } from '../lib/filters.mjs';
import {
  assessWorkFormatForApply,
  classifyGeoFormat,
  inferWorkFormatAssessment,
  matchesCommuteZone,
  inferTimezoneOffset,
} from '../lib/work-format-inference.mjs';

const wizardBlob = `
Специалист 2 линии технической поддержки
Группа Компаний Визард
Полная занятость
Формат работы: на месте работодателя
Тверь
Удалённая поддержка
Комфортный офис в центре города
`.trim();

const meta = parseWorkFormatMeta(wizardBlob, { requireRemote: false });
assert.equal(meta.explicitOffice, true, 'explicit office');
assert.equal(meta.hasRemote, false, 'удалённая поддержка ≠ удалёнка');
assert.equal(meta.officeOnly, true, 'office only');
assert.equal(meta.city, 'Тверь', 'city Tver');

const harvestStrict = runHardFilters(
  {
    title: 'Специалист 2 линии технической поддержки',
    company: 'ГК Визард',
    salaryRaw: '',
    employment: 'Полная занятость',
    address: 'Тверь',
    description: wizardBlob,
  },
  { requireRemote: true, harvestRequireRemote: true, allowOfficeMoscow: true }
);
assert.equal(harvestStrict.pass, false, 'strict harvest rejects office outside Moscow');
assert.equal(harvestStrict.stage, 'remote');

const harvestWide = runHardFilters(
  {
    title: 'Специалист 2 линии технической поддержки',
    company: 'ГК Визард',
    salaryRaw: '',
    employment: 'Полная занятость',
    address: 'Тверь',
    description: wizardBlob,
  },
  { requireRemote: true, harvestRequireRemote: false, allowOfficeMoscow: true }
);
assert.equal(harvestWide.pass, true, 'wide harvest collects office Tver');

const applyMeta = passesWorkFormatForApply(meta, { allowOfficeMoscow: true });
assert.equal(applyMeta.pass, false, 'legacy apply must reject office Tver');
assert.match(applyMeta.reason || '', /офис|удалёнк/i);

const rec = {
  title: 'DevOps engineer',
  descriptionPreview: wizardBlob,
  workFormatLine: 'на месте работодателя',
  employment: 'Полная занятость',
  address: 'Тверь',
  workFormat: meta,
};
const assessment = assessVacancyForApply(rec, { prefs: { allowOfficeMoscow: true } });
assert.equal(assessment.eligible, false, 'batch assess rejects Tver office');
assert.equal(assessment.category, 'work-format');
assert.equal(assessment.workFormatAssessment?.geoClass, 'outOfZone');

const remoteJob = parseWorkFormatMeta('Формат работы: удалённо\nDevOps engineer', {});
assert.equal(remoteJob.hasRemote, true);
assert.equal(remoteJob.officeOnly, false);

const remoteStandalone = parseWorkFormatMeta('DevOps Engineer\nПолная занятость\nУдалённо', {});
assert.equal(remoteStandalone.hasRemote, true, 'standalone Удалённо in header blob');
assert.equal(remoteStandalone.format, 'удалёнка');

assert.ok(matchesCommuteZone('офис в Видное, Московская область'), 'commute MO');
assert.ok(matchesCommuteZone('г. Домодедово'), 'commute Domodedovo');
assert.equal(inferTimezoneOffset('DevOps UTC+3', ''), 3);
assert.equal(inferTimezoneOffset('DevOps engineer', 'Новосибирск'), 7);

const coreRemote = classifyGeoFormat(
  parseWorkFormatMeta('Формат работы: удалённо\nUTC+3', {}),
  'Формат работы: удалённо\nUTC+3'
);
assert.equal(coreRemote.geoClass, 'coreRemote');

const spbRemoteGeo = classifyGeoFormat(
  parseWorkFormatMeta('удалёнка · Санкт-Петербург', {}),
  'удалёнка · Санкт-Петербург\nИнженер поддержки'
);
assert.equal(spbRemoteGeo.geoClass, 'outOfZone', 'SPb remote without Moscow is outOfZone');

const reserveRemote = classifyGeoFormat(
  parseWorkFormatMeta('Формат работы: удалённо\nНовосибирск', {}),
  'Формат работы: удалённо\nНовосибирск'
);
assert.equal(reserveRemote.geoClass, 'reserveRemote');
assert.equal(reserveRemote.batchSortPenalty, 20);

const hybridMo = inferWorkFormatAssessment({
  title: 'DevOps',
  address: 'Видное',
  description: 'Гибрид 2 дня в офисе, Московская область',
});
assert.equal(hybridMo.geoClass, 'commuteZone');
assert.equal(hybridMo.hybridSoftness?.tier, 'fixed_2_3');
assert.equal(hybridMo.hybridSoftness?.sortBonus, 0);

const devopsRec = {
  title: 'DevOps engineer',
  scoreOverall: 70,
  description: 'Формат работы: удалённо\nUTC+3',
};
const wfApply = assessWorkFormatForApply(devopsRec, { prefs: {} });
assert.equal(wfApply.pass, true);
assert.equal(wfApply.workFormatAssessment.channelTier?.id, 'remote');
assert.equal(
  wfApply.workFormatAssessment.effectiveSortScore,
  1000 + 70 + 5,
  'channel remote + score + core remote +5'
);

const reserveRec = {
  title: 'DevOps engineer',
  scoreOverall: 70,
  description: 'Формат работы: удалённо\nНовосибирск',
};
const wfReserve = assessWorkFormatForApply(reserveRec, { prefs: {} });
assert.equal(wfReserve.pass, true, 'reserve TZ allowed for R0 default');
assert.equal(
  wfReserve.workFormatAssessment.effectiveSortScore,
  1000 + 70 - 20,
  'channel remote + score + reserve -20'
);

const kinoplanDesc =
  'Наши офисы располагаются в Москве, Ростове-на-Дону и Казахстане. Возможность гибридной формы работы офис/дом 3 дня офис/2 дом. Обязательное посещение офиса, полную удаленку не рассматриваем.';
const kinoplanMeta = parseWorkFormatMeta(
  {
    address: 'Ростов-на-Дону, Социалистическая улица, 74',
    workFormatLine: '',
    description: kinoplanDesc,
  },
  {}
);
assert.equal(kinoplanMeta.city, 'Ростов-на-Дону', 'city from address, not Moscow in description');
assert.equal(kinoplanMeta.hasHybrid, true, 'kinoplan hybrid in description');
assert.equal(kinoplanMeta.hybridMoscow, false, 'hybrid Rostov ≠ hybridMoscow');

const moscowOfficeProse = parseWorkFormatMeta(
  {
    title: 'DevOps-инженер',
    description:
      'Что мы предлагаем: Комфортный офис в центре Москвы (м. Баррикадная). ДМС.',
  },
  {}
);
assert.equal(moscowOfficeProse.officeOnly, true, 'office prose → officeOnly');
assert.equal(moscowOfficeProse.city, 'Москва', 'office prose → Москва');
assert.equal(moscowOfficeProse.format, 'офис');
const moscowOfficeApply = assessWorkFormatForApply(
  {
    title: 'DevOps',
    description: 'Комфортный офис в центре Москвы (м. Баррикадная).',
  },
  { prefs: { allowOfficeMoscow: true } }
);
assert.equal(moscowOfficeApply.pass, true, 'Moscow office prose passes apply when allowOfficeMoscow');

const kurskayaOffice = parseWorkFormatMeta(
  'Условия: Комфортный и стильный офис рядом с м.Курская; ДМС',
  {}
);
assert.equal(kurskayaOffice.officeOnly, true, 'офис у метро');
assert.equal(kurskayaOffice.city, 'Москва');

// Сбер Обнинск: «дистанционный доступ» ≠ удалёнка; офис в Обнинске
const sberFacilityBlob = `
Специалист по эксплуатации объектов (сервис-менеджер)
мониторинг состояния объектов Банка с использованием системы телеметрии и дистанционного доступа
готовность к разъездному характеру работы
офис по адресу: г. Обнинск
`.trim();
const sberMeta = parseWorkFormatMeta(sberFacilityBlob, { requireRemote: true });
assert.equal(sberMeta.hasRemote, false, 'дистанционный доступ ≠ remote work');
assert.equal(sberMeta.officeOnly, true, 'офис по адресу → office');
assert.equal(sberMeta.city, 'Обнинск');
const sberApply = passesWorkFormatForApply(sberMeta, { allowOfficeMoscow: true });
assert.equal(sberApply.pass, false, 'Обнинск office rejected on apply');

// Marksman: сутки 1/3
const marksmanShift = parseWorkFormatMeta(
  'Сменный график работы: 1/3 (офис в центре Москвы). Рабочие часы: 24. Формат работы: на месте работодателя',
  {}
);
assert.equal(marksmanShift.dayOnThreeOff, true, '1/3 + 24h = сутки через трое');
assert.equal(
  passesWorkFormatForApply(marksmanShift, { allowOfficeMoscow: true }).pass,
  false,
  'сутки 1/3 blocked on apply'
);

// РТЛабс-паттерн: гибрид + удалёнка + офис вне Москвы — не coreRemote / не auto-ship
// (19.07: assessWorkFormatForApply обходил hybridMoscowOnly через hasRemote→coreRemote)
const rtlabsHybridRemote = {
  title: 'Инженер 2 линии технической поддержки',
  company: 'РТЛабс',
  address: 'Воронеж, Красноармейский переулок, 3А',
  description:
    'Формат работы: гибридный. Удалённая работа возможна. Офис в Воронеже. Гибрид 2–3 дня в офисе.',
  scoreOverall: 75,
};
const rtlabsMeta = parseWorkFormatMeta(rtlabsHybridRemote, {});
assert.equal(rtlabsMeta.hasHybrid, true, 'rtlabs hasHybrid');
assert.equal(rtlabsMeta.officeOnly, false, 'rtlabs not officeOnly');
assert.equal(rtlabsMeta.city, 'Воронеж');
assert.equal(
  passesWorkFormatRules(rtlabsMeta, { hybridMoscowOnly: true, allowHybrid: true }).pass,
  false,
  'legacy rules: гибрид не в Москве'
);
const rtlabsGeo = classifyGeoFormat(
  rtlabsMeta,
  [rtlabsHybridRemote.address, rtlabsHybridRemote.description].join('\n')
);
assert.equal(rtlabsGeo.geoClass, 'outOfZone', 'hybrid+remote+Воронеж ≠ coreRemote');
const rtlabsApply = assessWorkFormatForApply(rtlabsHybridRemote, {
  prefs: { hybridMoscowOnly: true, allowHybrid: true },
});
assert.equal(rtlabsApply.pass, false, 'apply blocks regional hybrid');
assert.match(rtlabsApply.reason || '', /гибрид не в москве/i);
const rtlabsApproved = assessWorkFormatForApply(rtlabsHybridRemote, {
  prefs: { hybridMoscowOnly: true, allowHybrid: true },
  userApproved: true,
});
assert.equal(rtlabsApproved.pass, true, 'userApproved may override regional hybrid');

// Чистая удалёнка с городом HQ вне Москвы — по-прежнему coreRemote
const remoteHqOnly = {
  title: 'DevOps engineer',
  address: 'Воронеж',
  description: 'Формат работы: полностью удалённо. Офис компании в Воронеже не посещаем.',
};
const remoteHqMeta = parseWorkFormatMeta(remoteHqOnly, {});
assert.equal(remoteHqMeta.hasRemote, true);
assert.equal(remoteHqMeta.hasHybrid, false, 'no hybrid wording');
const remoteHqGeo = classifyGeoFormat(
  remoteHqMeta,
  [remoteHqOnly.address, remoteHqOnly.description].join('\n')
);
assert.equal(remoteHqGeo.geoClass, 'coreRemote', 'pure remote keeps coreRemote despite HQ city');
assert.equal(
  assessWorkFormatForApply(remoteHqOnly, { prefs: { hybridMoscowOnly: true } }).pass,
  true,
  'pure remote still passes'
);

// hybridOfficeDaysMax (Настя ≤3)
assert.equal(extractHybridOfficeDaysPerWeek('гибрид, 4 дня в офисе'), 4);
assert.equal(extractHybridOfficeDaysPerWeek('офис 2 дня, остальное удалёнка'), 2);
const hybrid4 = parseWorkFormatMeta('Формат: гибрид. 4 дня в офисе в Москве.', {});
assert.equal(hybrid4.hasHybrid, true);
assert.equal(hybrid4.hybridOfficeDaysPerWeek, 4);
assert.equal(
  passesWorkFormatRules(hybrid4, { allowHybrid: true, hybridOfficeDaysMax: 3 }).pass,
  false,
  '4 office days > cap 3'
);
assert.equal(
  passesWorkFormatRules(hybrid4, { allowHybrid: true, hybridOfficeDaysMax: 3 }).reason,
  'Гибрид: в офисе 4 дн./нед > лимита 3'
);
const hybrid3 = parseWorkFormatMeta('Гибрид: 3 дня в офисе', {});
assert.equal(
  passesWorkFormatRules(hybrid3, { allowHybrid: true, hybridOfficeDaysMax: 3 }).pass,
  true,
  '3 days == cap ok'
);

// --- «Формат не указан»: адрес → офис; без адреса → unknown; schedule remote ---
const novosibUnknown = parseWorkFormatMeta(
  {
    title: 'Системный инженер/DevOps',
    description: 'Надёжная работа серверной инфраструктуры, мониторинг.',
    address: 'Новосибирск, улица Николаева, 11/4',
    workFormatLine: '',
  },
  {}
);
assert.equal(novosibUnknown.officeOnly, true, 'address without format → officeOnly');
assert.equal(novosibUnknown.format, 'офис');
assert.notEqual(novosibUnknown.format, 'не указан');
const novosibApply = assessWorkFormatForApply(
  {
    title: 'DevOps',
    description: 'Серверная инфраструктура',
    address: 'Новосибирск, улица Николаева, 11/4',
    workFormatLine: '',
  },
  { prefs: { allowOfficeMoscow: true, requireRemote: true } }
);
assert.equal(novosibApply.pass, false, 'Novosibirsk office rejected');
assert.match(novosibApply.reason || '', /офис|commute|зон/i);
assert.equal(/формат не указан/i.test(novosibApply.reason || ''), false);

const moscowAddrUnknown = assessWorkFormatForApply(
  {
    title: 'SRE-инженер',
    description: 'Платформенные сервисы, Linux, мониторинг.',
    address: 'Москва, Ленинградское шоссе, 39Ас1',
    workFormatLine: '',
  },
  { prefs: { allowOfficeMoscow: true } }
);
assert.equal(moscowAddrUnknown.pass, true, 'Moscow address-only office passes allowOfficeMoscow');
assert.equal(/формат не указан/i.test(moscowAddrUnknown.reason || ''), false);

const noAddrUnknown = assessWorkFormatForApply(
  {
    title: 'DevOps engineer',
    description: 'CI/CD, Docker, Linux. Без слов про формат.',
    workFormatLine: '',
  },
  { prefs: { requireRemote: true } }
);
assert.equal(noAddrUnknown.pass, false, 'no address → still unknown fail');
assert.match(noAddrUnknown.reason || '', /формат не указан/i);

process.env.HH_AUTO_APPLY_UNKNOWN_FORMAT = '1';
const autoUnknownOn = assessWorkFormatForApply(
  {
    title: 'DevOps engineer',
    description: 'CI/CD, Docker, Linux. Без слов про формат.',
    workFormatLine: '',
  },
  { prefs: { requireRemote: true } }
);
assert.equal(autoUnknownOn.pass, true, 'HH_AUTO_APPLY_UNKNOWN_FORMAT=1 unlocks unknown');
delete process.env.HH_AUTO_APPLY_UNKNOWN_FORMAT;

const scheduleRemote = parseWorkFormatMeta(
  {
    title: 'DevOps',
    description: 'Без слов про удалёнку в тексте',
    workFormatLine: '',
    hhMeta: { scheduleId: 'remote', workFormats: ['Удалённо'] },
  },
  {}
);
assert.equal(scheduleRemote.hasRemote, true, 'hhMeta.scheduleId=remote → hasRemote');
assert.equal(scheduleRemote.officeOnly, false);
assert.equal(
  assessWorkFormatForApply(
    {
      title: 'DevOps',
      description: 'Без слов про удалёнку',
      hhMeta: { scheduleId: 'remote', workFormats: ['Удалённо'] },
    },
    { prefs: {} }
  ).pass,
  true,
  'schedule remote passes apply'
);

const explicitRemoteNoRegress = parseWorkFormatMeta(
  {
    title: 'DevOps',
    address: 'Москва, офис HQ',
    workFormatLine: 'Формат работы: удалённо',
    description: 'Полностью удалённо',
  },
  {}
);
assert.equal(explicitRemoteNoRegress.hasRemote, true);
assert.equal(explicitRemoteNoRegress.officeOnly, false, 'explicit remote not overridden by address');

// Chip «гибрид» ≠ удалёнка (Криптонит); «на месте или гибрид» ≠ officeOnly (Holyweb)
const hybridChipOnly = parseWorkFormatMeta(
  {
    title: 'Data Engineer (SRE)',
    address: 'Москва, Калужская',
    workFormatLine: 'Формат работы: гибрид',
    description: 'Формат работы: гибридный (3 раза в неделю в офисе в Москве). Выезды на продакшн.',
  },
  {}
);
assert.equal(hybridChipOnly.hasHybrid, true, 'chip гибрид → hasHybrid');
assert.equal(hybridChipOnly.hasRemote, false, 'chip гибрид ≠ hasRemote');
assert.equal(hybridChipOnly.explicitRemote, false, 'гибрид не explicitRemote');
assert.equal(hybridChipOnly.format, 'гибрид');

const officeOrHybridChip = parseWorkFormatMeta(
  {
    title: 'DevOps',
    address: 'Москва, 1-й Нагатинский проезд',
    workFormatLine: 'Формат работы: на месте работодателя или гибрид',
    description: 'Работа в офисном/гибридном графике (м.Нагатинская).',
  },
  {}
);
assert.equal(officeOrHybridChip.officeOnly, false, 'на месте или гибрид ≠ officeOnly');
assert.equal(officeOrHybridChip.hasHybrid, true);
assert.equal(officeOrHybridChip.hasRemote, false);
assert.equal(officeOrHybridChip.format, 'гибрид');

// Stale store: chip «на месте» + старый hasRemote/remoteNote «удалёнка» (Передовые/Mayflower 26.07)
const staleOfficeRemote = {
  title: 'Специалист технической поддержки L2-L3',
  address: 'Новосибирск, Академгородок',
  workFormatLine: 'Формат работы: на месте работодателя',
  description: 'Офис в Новосибирске. Формат работы: на месте работодателя.',
  workFormat: {
    format: 'удалёнка',
    hasRemote: true,
    officeOnly: false,
    city: 'Новосибирск',
  },
  remoteNote: 'удалёнка · Новосибирск · удалёнка явно',
  userApproved: true,
};
const synced = syncRecordWorkFormatFields(staleOfficeRemote, {});
assert.equal(synced.workFormat.officeOnly, true, 'sync: office from chip');
assert.equal(synced.workFormat.hasRemote, false, 'sync: not remote');
assert.match(synced.remoteNote, /только офис|офис/i);
assert.ok(!/удалёнка явно/i.test(buildWorkFormatNote(synced.workFormat)));
const officeApply = assessWorkFormatForApply(staleOfficeRemote, {
  prefs: { allowOfficeMoscow: true, requireRemote: true },
  userApproved: true,
});
assert.equal(officeApply.pass, false, 'office Novosibirsk blocked even with userApproved');
assert.match(officeApply.reason || '', /офис вне commute|новосибир/i);

// Store-truth 29.07: тонкий chip без verify — не «офис Москва» как правда
const thinUnverified = assessWorkFormatForApply(
  {
    title: 'DevOps',
    address: 'Москва',
    workFormatLine: 'Формат работы: на месте работодателя',
    description: 'Администрирование Linux. Офис.',
  },
  { prefs: { allowOfficeMoscow: true } }
);
assert.equal(thinUnverified.pass, false, 'thin chip without verify blocked');
assert.match(thinUnverified.reason || '', /не подтверждён|backfill/i);

// Тонкий chip + явный гибрид в JD → гибрид, не officeOnly
const thinPlusJdHybrid = parseWorkFormatMeta(
  {
    title: 'Системный администратор',
    address: 'Москва',
    workFormatLine: 'Формат работы: на месте работодателя',
    description: 'Формат работы: гибрид. 2 дня в офисе.',
  },
  {}
);
assert.equal(thinPlusJdHybrid.officeOnly, false, 'JD hybrid demotes thin office chip');
assert.equal(thinPlusJdHybrid.hasHybrid, true);
assert.equal(thinPlusJdHybrid.format, 'гибрид');

console.log('test-vacancy-work-format: ok');
