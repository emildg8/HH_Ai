/**
 * Проверка логики подстановки ответов из дашборда (без браузера).
 *   node scripts/test-questionnaire-dashboard-apply.mjs
 */

import {
  recordHasDashboardQuestionnaireAnswers,
  getDashboardQuestionnaireAnswers,
} from '../lib/hh-questionnaire-auto.mjs';
import { isLikelyEnglishAnswer } from '../lib/hh-questionnaire-answers.mjs';
import {
  questionnaireTopicKey,
  normalizeQuestionLabel,
  isEmployerSkillCategoryLabel,
  isSkillCategoryText,
  meaningfulQuestions,
  dedupeQuestionnaireQuestions,
  formatQuestionLabel,
} from '../lib/questionnaire-labels.mjs';
import { answerFromCvHeuristic } from '../lib/hh-questionnaire-cv-fill.mjs';
import {
  buildAnswerLookup,
  resolveAnswerForLiveLabel,
} from '../lib/hh-employer-questionnaire.mjs';
import { remapQuestionnaireAnswers } from '../lib/questionnaire-merge.mjs';
import { mergeQuestionListsPreferOrder } from '../lib/hh-employer-questionnaire.mjs';
import { mergeProbeQuestionSteps } from '../lib/hh-questionnaire-probe.mjs';

const record = {
  hhApply: {
    questionnaire: {
      savedAnswers: [
        { index: 1, answer: 'Сайты 18+' },
        { index: 2, answer: 'Удалённый' },
      ],
    },
  },
};

if (!recordHasDashboardQuestionnaireAnswers(record)) {
  console.error('FAIL: savedAnswers не распознаны');
  process.exit(1);
}

const rows = getDashboardQuestionnaireAnswers(record);
if (rows.length !== 2 || rows[0].answer !== 'Сайты 18+') {
  console.error('FAIL: getDashboardQuestionnaireAnswers', rows);
  process.exit(1);
}

const empty = { hhApply: { questionnaire: {} } };
if (recordHasDashboardQuestionnaireAnswers(empty)) {
  console.error('FAIL: пустая запись не должна иметь ответов');
  process.exit(1);
}

if (!isLikelyEnglishAnswer('I have experience with VMware and Docker in production.')) {
  console.error('FAIL: должен определять англ. прозу');
  process.exit(1);
}

if (isLikelyEnglishAnswer('Удалённый в приоритете, гибрид возможен')) {
  console.error('FAIL: русский ответ не должен считаться англ.');
  process.exit(1);
}

const stored = [
  { index: 1, label: 'Есть ли области бизнеса неинтересные…?' },
  { index: 2, label: 'Вы рассматриваете офисный/гибридный/удаленный формат?' },
];
const live = [
  { index: 1, label: 'Есть ли области бизнеса неинтересные…?' },
  { index: 2, label: 'От какой суммы рассматриваете предложения?' },
  { index: 3, label: 'Вы рассматриваете "офисный/гибридный/удаленный(город)" формат?' },
];
const answers = [
  { index: 1, answer: '18+' },
  { index: 2, answer: 'Удалённый' },
];
const byTopic = new Map();
for (const q of stored) {
  const a = answers.find((x) => x.index === q.index);
  if (a) byTopic.set(questionnaireTopicKey(q.label), a.answer);
}
const fmt = live.find((q) => questionnaireTopicKey(q.label) === 'format');
if (!fmt || byTopic.get('format') !== 'Удалённый') {
  console.error('FAIL: сопоставление format по теме', byTopic.get('format'));
  process.exit(1);
}
if (questionnaireTopicKey(live[1].label) !== 'salary') {
  console.error('FAIL: salary topic', live[1].label);
  process.exit(1);
}

if (!isEmployerSkillCategoryLabel('*nix системы 297 из 10000')) {
  console.error('FAIL: *nix системы должна быть категорией навыков');
  process.exit(1);
}
const gamedevRaw = [
  { index: 1, label: '*nix системы 297 из 10000' },
  { index: 2, label: 'Виртуализация/Контейнеризация' },
  { index: 3, label: 'IaC (Ansible, Terraform)' },
  { index: 9, label: 'Укажите, пожалуйста, ваши зарплатные ожидания' },
];
const mq = meaningfulQuestions(gamedevRaw);
if (mq.length !== 4) {
  console.error('FAIL: Gamedev meaningful', mq.length, mq.map((q) => q.label));
  process.exit(1);
}
if (questionnaireTopicKey(mq[0].label) !== 'nix') {
  console.error('FAIL: topic nix');
  process.exit(1);
}

// Maxima: 3 ответа в дашборде, на странице зарплата + формат — не дублировать зарплату
const maximaDashboard = [
  { index: 1, label: 'Есть ли области бизнеса, которые Вам неинтересны?' },
  { index: 2, label: 'От какой суммы рассматриваете предложения?' },
  { index: 3, label: 'Вы рассматриваете офисный/гибридный/удаленный формат работы?' },
];
const maximaAnswers = [
  { index: 1, answer: 'Сайты 18+' },
  { index: 2, answer: 'От 220 000 на руки' },
  { index: 3, answer: 'Удалённый в приоритете' },
];
const maximaLookup = buildAnswerLookup(maximaDashboard, maximaAnswers);
const salaryLive = 'От какой суммы рассматриваете предложения?';
const formatLive = 'Вы рассматриваете "офисный/гибридный/удаленный(город)" формат работы?';
const mergedLive =
  'От какой суммы рассматриваете предложения? Вы рассматриваете офисный/гибридный/удаленный формат работы?';
const aSalary = resolveAnswerForLiveLabel(salaryLive, maximaLookup, maximaDashboard);
const aFormat = resolveAnswerForLiveLabel(formatLive, maximaLookup, maximaDashboard);
const aMerged = resolveAnswerForLiveLabel(mergedLive, maximaLookup, maximaDashboard);
if (aSalary !== 'От 220 000 на руки' || aFormat !== 'Удалённый в приоритете') {
  console.error('FAIL: Maxima salary/format', { aSalary, aFormat });
  process.exit(1);
}
if (aMerged === aSalary && aMerged === aFormat) {
  console.error('FAIL: объединённая подпись не должна давать один ответ на оба поля', aMerged);
  process.exit(1);
}
if (questionnaireTopicKey(mergedLive) !== 'format') {
  console.error('FAIL: merged label topic должен быть format', questionnaireTopicKey(mergedLive));
  process.exit(1);
}

// После повторного probe порядок index может смениться — ответы по теме, не по номеру
const oldOrder = [
  { index: 1, label: 'Есть ли области бизнеса неинтересные?' },
  { index: 2, label: 'От какой суммы рассматриваете предложения?' },
  { index: 3, label: 'Вы рассматриваете офисный/гибридный/удаленный формат работы?' },
];
const newOrder = [
  { index: 1, label: 'От какой суммы рассматриваете предложения?' },
  { index: 2, label: 'Вы рассматриваете офисный/гибридный/удаленный формат работы?' },
  { index: 3, label: 'Есть ли области бизнеса неинтересные?' },
];
const oldAns = [
  { index: 1, answer: 'BIZ' },
  { index: 2, answer: 'SAL' },
  { index: 3, answer: 'FMT' },
];
const remapped = remapQuestionnaireAnswers(oldOrder, newOrder, oldAns);
const r1 = remapped.find((x) => x.index === 1)?.answer;
const r2 = remapped.find((x) => x.index === 2)?.answer;
const r3 = remapped.find((x) => x.index === 3)?.answer;
if (r1 !== 'SAL' || r2 !== 'FMT' || r3 !== 'BIZ') {
  console.error('FAIL: remap по теме при смене порядка', { r1, r2, r3, remapped });
  process.exit(1);
}

// Gamedev: 9 категорий навыков — у каждой свой ответ, без дублей
const gamedevDash = [
  { index: 1, label: '*nix системы 297 из 10000' },
  { index: 2, label: 'Виртуализация/Контейнеризация' },
  { index: 3, label: 'IaC (Ansible, Terraform)' },
  { index: 4, label: 'Языки программирования/фреймворки' },
  { index: 5, label: 'Логи' },
  { index: 6, label: 'Базы данных' },
  { index: 7, label: 'Хранение данных' },
  { index: 8, label: 'Другие инструменты' },
  { index: 9, label: 'Укажите, пожалуйста, ваши зарплатные ожидания' },
];
const gamedevAns = gamedevDash.map((q) => ({ index: q.index, answer: `ans-${q.index}` }));
const gLookup = buildAnswerLookup(gamedevDash, gamedevAns);
const seen = new Set();
for (const q of gamedevDash) {
  const got = resolveAnswerForLiveLabel(q.label, gLookup, gamedevDash);
  if (got !== `ans-${q.index}`) {
    console.error('FAIL: Gamedev field', q.index, q.label.slice(0, 40), got);
    process.exit(1);
  }
  if (seen.has(got) && gamedevDash.length > 1) {
    console.error('FAIL: дубль ответа Gamedev', got, q.label);
    process.exit(1);
  }
  seen.add(got);
}

const gearExtra = [
  'CI/CD',
  'Мониторинг',
  'Нейросети',
  'Системы мониторинга',
];
for (const label of gearExtra) {
  if (!isSkillCategoryText(label) && !isEmployerSkillCategoryLabel(label)) {
    console.error('FAIL: не распознана категория Gear Games', label);
    process.exit(1);
  }
}
if (questionnaireTopicKey('CI/CD') !== 'cicd') {
  console.error('FAIL: topic cicd');
  process.exit(1);
}
if (questionnaireTopicKey('Мониторинг') !== 'monitoring') {
  console.error('FAIL: topic monitoring');
  process.exit(1);
}
if (questionnaireTopicKey('Нейросети') !== 'ai') {
  console.error('FAIL: topic ai');
  process.exit(1);
}

const cvSample =
  'Linux, Docker, GitLab CI, Zabbix, Grafana, PostgreSQL, Ansible, TeamCity, bash scripting in production.';
const cicdAns = answerFromCvHeuristic({ label: 'CI/CD' }, cvSample);
const monAns = answerFromCvHeuristic({ label: 'Мониторинг' }, cvSample);
if (!cicdAns || !/gitlab|teamcity|docker/i.test(cicdAns)) {
  console.error('FAIL: CV fill CI/CD', cicdAns);
  process.exit(1);
}
if (!monAns || !/zabbix|grafana/i.test(monAns)) {
  console.error('FAIL: CV fill Мониторинг', monAns);
  process.exit(1);
}

const fullGear = meaningfulQuestions([
  { index: 1, label: '*nix системы' },
  { index: 2, label: 'Виртуализация/Контейнеризация' },
  { index: 3, label: 'CI/CD системы' },
  { index: 4, label: 'IaC (Ansible, Terraform)' },
  { index: 5, label: 'k8s' },
  { index: 6, label: 'Языки программирования и фреймворки' },
  { index: 7, label: 'Системы мониторинга' },
  { index: 8, label: 'Системы сбора и хранения логов' },
  { index: 9, label: 'Discovery-сервисы' },
  { index: 10, label: 'Базы данных SQL и NoSQL' },
  { index: 11, label: 'Системы хранения данных' },
  { index: 12, label: 'Нейросети' },
  { index: 13, label: 'Опишите другие инструменты, которыми владеете' },
  { index: 14, label: 'Укажите, пожалуйста, ваши зарплатные ожидания' },
]);
if (fullGear.length !== 14) {
  console.error('FAIL: полная анкета Gear Games (14 полей)', fullGear.length, fullGear.map((q) => q.label));
  process.exit(1);
}

const ordered14 = fullGear;
const partial8 = fullGear.filter((_, i) => [0, 1, 2, 5, 7, 12, 13].includes(i));
const merged = mergeQuestionListsPreferOrder(ordered14, partial8);
if (merged.length !== 14) {
  console.error('FAIL: merge ordered+partial', merged.length);
  process.exit(1);
}

const gamedevDupes = [
  { index: 1, label: '*nix системы\u200b' },
  { index: 2, label: 'Виртуализация/Контейнеризация \u200b' },
  { index: 3, label: 'CI/CD системы\u200b' },
  { index: 4, label: 'IaC (Ansible, Terraform)\u200b' },
  { index: 5, label: 'k8s\u200b' },
  { index: 6, label: 'Языки программирования и фреймворки\u200b' },
  { index: 7, label: 'Системы мониторинга\u200b' },
  { index: 8, label: 'Системы сбора и хранения логов\u200b' },
  { index: 9, label: 'Discovery-сервисы\u200b' },
  { index: 10, label: 'Базы данных SQL и NoSQL\u200b' },
  { index: 11, label: 'Системы хранения данных\u200b' },
  { index: 12, label: 'Нейросети\u200b' },
  { index: 13, label: 'Опишите другие инструменты, которыми владеете\u200b' },
  { index: 14, label: 'Укажите, пожалуйста, ваши зарплатные ожидания\u200b' },
  { index: 15, label: '*nix системы' },
  { index: 16, label: 'Виртуализация/Контейнеризация' },
  { index: 17, label: 'IaC (Ansible, Terraform)' },
  { index: 18, label: 'Языки программирования и фреймворки' },
  { index: 19, label: 'Системы сбора и хранения логов' },
  { index: 20, label: 'Базы данных SQL и NoSQL' },
  { index: 21, label: 'Системы хранения данных' },
  { index: 22, label: 'Опишите другие инструменты, которыми владеете' },
];
const dedupedGamedev = dedupeQuestionnaireQuestions(gamedevDupes);
if (dedupedGamedev.length !== 14) {
  console.error('FAIL: dedupe Gamedev 22→14', dedupedGamedev.length, dedupedGamedev.map((q) => q.label));
  process.exit(1);
}
if (formatQuestionLabel('*nix системы\u200b') !== '*nix системы') {
  console.error('FAIL: zero-width strip');
  process.exit(1);
}

const step1 = [
  { index: 1, label: 'В какой локации вы проживаете?' },
  { index: 2, label: 'Какие у вас ожидания по зарплате?' },
  { index: 3, label: 'Есть ли опыт с hosting-панелями?' },
];
const step2 = [{ index: 1, label: 'Опишите опыт с мониторингом (Prometheus, Grafana)' }];
const probeMerged = mergeProbeQuestionSteps(step1, step2);
if (probeMerged.length !== 4) {
  console.error('FAIL: mergeProbeQuestionSteps 3+1', probeMerged.length);
  process.exit(1);
}

console.log('[test] OK: ответы дашборда, темы, Maxima, remap, Gamedev 14 полей, dedupe, probe merge');
