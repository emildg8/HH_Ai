/**
 * Пересобрать savedAnswers: варианты — только подписи из options на hh.ru.
 *   node scripts/fix-record-questionnaire-answers.mjs --id=<recordId>
 */

import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { generateQuestionnaireAnswers } from '../lib/hh-questionnaire-answers.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { meaningfulQuestions, formatQuestionLabel } from '../lib/questionnaire-labels.mjs';
import {
  answerChoiceFromCvHeuristic,
  isChoiceQuestion,
  matchAnswerToOption,
} from '../lib/questionnaire-choice.mjs';
import { answerFromCvHeuristic } from '../lib/hh-questionnaire-cv-fill.mjs';
import {
  isRoleInterestQuestionLabel,
  isRtsGamesQuestionLabel,
  answerRoleInterestTextarea,
} from '../lib/questionnaire-special-answers.mjs';

function isTextareaQuestionLabel(label) {
  const t = String(label || '');
  return (
    isRoleInterestQuestionLabel(t) ||
    /мобильн\w*\s+игр|последние\s+3\s+месяц/i.test(t) ||
    /зарплат|ожидан|salary/i.test(t) ||
    /матчмейкинг|неясн\w*\s+задач/i.test(t)
  );
}

const id = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5).trim();
if (!id) {
  console.error('Укажите --id=<recordId>');
  process.exit(1);
}

const rec = getVacancyRecord(id);
if (!rec?.hhApply?.questionnaire?.questions?.length) {
  console.error('Нет анкеты в записи');
  process.exit(1);
}

const cv = await loadCvBundle();
const cvText = cv.text || '';
const questions = meaningfulQuestions(rec.hhApply.questionnaire.questions);
const ctx = { vacancyTitle: rec.title, description: rec.descriptionForLlm };

const answers = [];

for (const q of questions) {
  const label = formatQuestionLabel(q.label);

  if (isRoleInterestQuestionLabel(label)) {
    answers.push({
      index: q.index,
      answer: answerRoleInterestTextarea({ vacancyTitle: rec.title }),
    });
    continue;
  }

  if (isRtsGamesQuestionLabel(label) || /мобильн\w*\s+игр/i.test(label)) {
    const text = answerFromCvHeuristic({ label }, cvText, ctx);
    answers.push({
      index: q.index,
      answer:
        text ||
        'Играл в RTS (Warcraft III, StarCraft II); мобильные — по запросу на собеседовании.',
    });
    continue;
  }

  if (isChoiceQuestion(q)) {
    let raw = answerChoiceFromCvHeuristic({ ...q, label }, cvText);
    let opt = matchAnswerToOption(raw, q.options);
    if (!opt) {
      const { answers: gen } = await generateQuestionnaireAnswers({
        record: rec,
        questions: [q],
        cvText,
      });
      raw = gen[0]?.answer || raw;
      opt = matchAnswerToOption(raw, q.options);
    }
    if (opt) {
      answers.push({ index: q.index, answer: opt.label });
      continue;
    }
    if (q.options?.[0]?.label) {
      answers.push({ index: q.index, answer: q.options[0].label });
      console.warn(`[fix] fallback option #1 for Q${q.index}`);
      continue;
    }
  }

  if (isTextareaQuestionLabel(label) || q.type === 'textarea') {
    const text = answerFromCvHeuristic({ label }, cvText, ctx);
    if (text) {
      answers.push({ index: q.index, answer: text });
      continue;
    }
  }

  const { answers: gen } = await generateQuestionnaireAnswers({
    record: rec,
    questions: [q],
    cvText,
  });
  if (gen[0]?.answer) answers.push(gen[0]);
}

const now = new Date().toISOString();
updateVacancyRecord(id, {
  hhApply: {
    ...rec.hhApply,
    questionnaire: {
      ...rec.hhApply.questionnaire,
      questions,
      savedAnswers: answers,
      suggestedAnswers: answers,
      answersSavedAt: now,
      answersModel: 'cv-options-aligned',
      answersGeneratedAt: now,
      status: 'ready',
    },
  },
});

console.log(`[fix] ${rec.title || id}: ${answers.length} ответов`);
for (const row of answers) {
  const q = questions.find((x) => x.index === row.index);
  const ok =
    !isChoiceQuestion(q) || matchAnswerToOption(row.answer, q?.options || []);
  console.log(`  ${row.index}. ${ok ? 'OK' : '??'} ${String(row.answer).slice(0, 55)}…`);
}
