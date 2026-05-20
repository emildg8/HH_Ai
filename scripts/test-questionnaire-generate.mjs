/**
 * Проверка генерации ответов анкеты: полнота, непустые ответы, упоминания из CV.
 *   HH_VACANCIES_QUEUE_FILE=./data/vacancies-devops.json node scripts/test-questionnaire-generate.mjs --id=<uuid>
 */

import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { meaningfulQuestions } from '../lib/questionnaire-labels.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import {
  generateQuestionnaireAnswers,
  alignAnswersToQuestions,
  isWeakQuestionnaireAnswer,
  isEmployerVoiceAnswer,
  isLikelyEnglishAnswer,
  isQuestionnaireLlmEnabled,
} from '../lib/hh-questionnaire-answers.mjs';

const id = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5).trim();
if (!id) {
  console.error('Укажите --id=<recordId>');
  process.exit(1);
}

const rec = getVacancyRecord(id);
if (!rec?.hhApply?.questionnaire) {
  console.error('Нет анкеты в записи');
  process.exit(1);
}

const questions = meaningfulQuestions(rec.hhApply.questionnaire.questions);
if (!questions.length) {
  console.error('Нет осмысленных вопросов — сначала probe');
  process.exit(1);
}

const cv = await loadCvBundle();
if (!cv.text.trim()) {
  console.error('Пустой CV');
  process.exit(1);
}

const cvLower = cv.text.toLowerCase();
const cvTokens = ['docker', 'grafana', 'linux', 'postgresql', 'gitlab', 'ansible', 'openshift'];

console.log('[test] Вопросов:', questions.length);
console.log('[test] CV файлов:', cv.files?.join(', ') || '—');
console.log('[test] Режим LLM:', isQuestionnaireLlmEnabled() ? 'включён' : 'выключен (только резюме)');

if (isQuestionnaireLlmEnabled()) {
  console.warn('[test] WARN: HH_QUESTIONNAIRE_LLM=1 — для стабильного теста отключите LLM в .env');
}

const t0 = Date.now();
const result = await generateQuestionnaireAnswers({
  record: rec,
  questions,
  cvText: cv.text,
});
const aligned = alignAnswersToQuestions(result.answers, questions);

if (aligned.length !== questions.length) {
  console.error(`FAIL: ответов ${aligned.length}, нужно ${questions.length}`);
  process.exit(1);
}

let cvHits = 0;
for (const q of questions) {
  const a = aligned.find((x) => x.index === q.index);
  if (
    !a?.answer ||
    a.answer.length < 4 ||
    isWeakQuestionnaireAnswer(q, a.answer) ||
    isEmployerVoiceAnswer(a.answer) ||
    isLikelyEnglishAnswer(a.answer)
  ) {
    console.error(`FAIL: слабый/англ. ответ на ${q.index}. ${q.label} → ${a?.answer || ''}`);
    process.exit(1);
  }
  const al = a.answer.toLowerCase();
  const hit = cvTokens.some((tok) => al.includes(tok) || cvLower.includes(tok));
  if (hit) cvHits++;
  console.log(`\n${q.index}. ${q.label}`);
  console.log(`   → ${a.answer.slice(0, 220)}${a.answer.length > 220 ? '…' : ''}`);
}

if (cvHits < Math.min(2, questions.length)) {
  console.warn(
    `WARN: мало пересечений с CV (${cvHits}/${questions.length}) — проверьте вручную`
  );
}

if (!/^cv-heuristic$/i.test(result.model)) {
  console.error(`FAIL: ожидалась модель cv-heuristic, получено: ${result.model}`);
  process.exit(1);
}

const now = new Date().toISOString();
updateVacancyRecord(id, {
  hhApply: {
    ...rec.hhApply,
    lastAt: now,
    questionnaire: {
      ...rec.hhApply.questionnaire,
      questions,
      suggestedAnswers: aligned,
      savedAnswers: rec.hhApply?.questionnaire?.savedAnswers,
      answersModel: result.model,
      answersGeneratedAt: now,
    },
  },
});

console.log(`\n[test] OK за ${((Date.now() - t0) / 1000).toFixed(1)}s, модель ${result.model}, ответов ${aligned.length} (записано в очередь)`);
