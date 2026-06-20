import assert from 'node:assert/strict';
import {
  buildAnswerScript,
  enrichPackWithScripts,
  formatScriptPromptText,
} from '../lib/interview-copilot-answers.mjs';

const answer = await buildAnswerScript('Как у вас устроен CI/CD?', {
  title: 'DevOps',
  company: 'Bank',
  cvText: 'Опыт L2, GitLab CI, Docker, Kubernetes, банковский прод. Сократил время релиза на 40%.',
  focus: ['CI/CD', 'Docker'],
});

assert.equal(answer.question, 'Как у вас устроен CI/CD?');
assert.ok(answer.bullets.length >= 2);
assert.ok(answer.script.length > 20);
assert.doesNotMatch(answer.script, /\[object Object\]/);

const ice = await buildAnswerScript('На ты нормально, удобно?', { title: 'TAM' });
assert.match(ice.script, /ты|удобно/i);
assert.ok(ice.script.length < 120);
assert.doesNotMatch(ice.script, /CI\/CD|Docker/i);

const pack = await enrichPackWithScripts(
  {
    source: 'mock-tech',
    title: 'DevOps',
    company: 'X',
    questions: ['Docker?', { question: 'K8s?' }],
  },
  { maxQuestions: 2 }
);

assert.equal(pack.answerScripts.length, 2);
const text = formatScriptPromptText(pack);
assert.match(text, /Вопрос:/);
assert.match(text, /→ Скажи:/);
assert.doesNotMatch(text, /\[object Object\]/);

console.log('test-interview-copilot-answers: OK');
