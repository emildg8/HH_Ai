/**
 * Тесты choice-анкеты (radio 1–5).
 *   node scripts/test-questionnaire-choice.mjs
 */

import {
  isChoiceQuestion,
  matchAnswerToOption,
  suggestChoiceAnswerFromCv,
  answerChoiceFromCvHeuristic,
} from '../lib/questionnaire-choice.mjs';
import { combineQuestionListsByPosition } from '../lib/hh-employer-questionnaire.mjs';
import {
  generateQuestionnaireAnswers,
  isWeakQuestionnaireAnswer,
} from '../lib/hh-questionnaire-answers.mjs';
import { prepareStoredQuestions } from '../lib/questionnaire-merge.mjs';

const devopsQ = {
  index: 1,
  label: 'Есть ли у вас опыт работы DevOps-инженером?',
  type: 'radio',
  choiceName: 'q1',
  options: [
    { value: '1', label: '1 (Нет)' },
    { value: '2', label: '2 (Меньше 6 мес)' },
    { value: '3', label: '3 (Опыт 1-2 года)' },
    { value: '4', label: '4 (Опыт 3-6 лет)' },
    { value: '5', label: '5 (Опыт 6+ лет)' },
  ],
};

if (!isChoiceQuestion(devopsQ)) {
  console.error('FAIL: isChoiceQuestion');
  process.exit(1);
}

const m1 = matchAnswerToOption('4 (Опыт 3-6 лет)', devopsQ.options);
if (!m1 || m1.value !== '4') {
  console.error('FAIL: matchAnswerToOption exact', m1);
  process.exit(1);
}

const m2 = matchAnswerToOption('4', devopsQ.options);
if (!m2 || m2.value !== '4') {
  console.error('FAIL: matchAnswerToOption by number', m2);
  process.exit(1);
}

const cv = `
DevOps-инженер, опыт 5 лет.
VMware, Proxmox, KVM, Docker, Kubernetes.
`;

const gradeQ = {
  index: 2,
  label: 'На какой грейд вы оцениваете свои навыки/знания?',
  type: 'radio',
  options: [
    { value: '1', label: '1 (Junior)' },
    { value: '2', label: '2 (Middle)' },
    { value: '3', label: '3 (Senior)' },
    { value: '4', label: '4 (Tech Lead)' },
    { value: '5', label: '5 (Team Lead)' },
  ],
};

const vmQ = {
  index: 3,
  label: 'Как вы оцениваете свои знания по работе с qemu/kvm, vmware?',
  type: 'radio',
  options: [
    { value: '1', label: '1 (Не знаком)' },
    { value: '2', label: '2 (Базовое понимание)' },
    { value: '3', label: '3 (Могу объяснить основные принципы)' },
    { value: '4', label: '4 (Хорошо разбираюсь)' },
    { value: '5', label: '5 (Профессионально владею)' },
  ],
};

const aDevops = suggestChoiceAnswerFromCv(devopsQ, cv);
if (!/3|4|5/.test(aDevops)) {
  console.error('FAIL: suggest DevOps', aDevops);
  process.exit(1);
}

const aGrade = answerChoiceFromCvHeuristic(gradeQ, cv);
if (!/middle|senior|2|3/i.test(aGrade)) {
  console.error('FAIL: suggest grade', aGrade);
  process.exit(1);
}

const aVm = answerChoiceFromCvHeuristic(vmQ, cv);
if (!/4|5|хорошо|профессион/i.test(aVm)) {
  console.error('FAIL: suggest vmware', aVm);
  process.exit(1);
}

if (isWeakQuestionnaireAnswer(devopsQ, aDevops)) {
  console.error('FAIL: choice answer marked weak', aDevops);
  process.exit(1);
}

const combined = combineQuestionListsByPosition(
  [{ ...devopsQ, docTop: 100 }, { ...gradeQ, docTop: 200 }],
  [{ index: 4, label: 'Укажите зарплату?', type: 'textarea', docTop: 300 }]
);
if (combined.length !== 3 || combined[0].label !== devopsQ.label) {
  console.error('FAIL: combineQuestionListsByPosition', combined);
  process.exit(1);
}

const stored = prepareStoredQuestions(combined);
if (!stored[0].options?.length) {
  console.error('FAIL: prepareStoredQuestions keeps options', stored[0]);
  process.exit(1);
}

const record = { title: 'Test', company: 'Co' };
const gen = await generateQuestionnaireAnswers({
  record,
  questions: [devopsQ, gradeQ, vmQ],
  cvText: cv,
});
if (gen.answers.length !== 3) {
  console.error('FAIL: generateQuestionnaireAnswers count', gen);
  process.exit(1);
}
for (const row of gen.answers) {
  const q = [devopsQ, gradeQ, vmQ].find((x) => x.index === row.index);
  if (!matchAnswerToOption(row.answer, q?.options || [])) {
    console.error('FAIL: generated not in options', row);
    process.exit(1);
  }
}

const formatQ = {
  index: 2,
  label: 'Какой формат работы для себя рассматриваешь?',
  type: 'radio',
  options: [
    { value: 'office', label: 'Офис' },
    { value: 'remote', label: 'Удаленка' },
    { value: 'hybrid', label: 'Гибрид' },
  ],
};
if (!isChoiceQuestion(formatQ)) {
  console.error('FAIL: format radio');
  process.exit(1);
}
const mFmt = matchAnswerToOption('Удаленный или Гибрид', formatQ.options);
if (!mFmt || !/удален/i.test(mFmt.label)) {
  console.error('FAIL: match format answer', mFmt);
  process.exit(1);
}
const fmtAns = answerChoiceFromCvHeuristic(formatQ, 'предпочитаю удалённую работу, гибрид возможен');
if (!/удален|гибрид/i.test(fmtAns)) {
  console.error('FAIL: format heuristic', fmtAns);
  process.exit(1);
}

console.log('OK: test-questionnaire-choice.mjs');
console.log('  DevOps:', gen.answers.find((a) => a.index === 1)?.answer);
console.log('  Grade:', gen.answers.find((a) => a.index === 2)?.answer);
console.log('  VM:', gen.answers.find((a) => a.index === 3)?.answer);
