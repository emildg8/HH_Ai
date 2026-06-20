import assert from 'node:assert/strict';
import { clearPromptState } from '../lib/interview-prompt-bridge.mjs';
import { startLiveCopilot, stopLiveCopilot } from '../lib/interview-copilot-live.mjs';
import { recordSpokenAnswer } from '../lib/interview-copilot-spoken.mjs';
import { injectQuestion } from '../lib/interview-copilot-session.mjs';
import { stageLengthHint } from '../lib/interview-copilot-qa.mjs';

clearPromptState('all');

const session = await startLiveCopilot({
  title: 'DevOps',
  company: 'Bank',
  scriptOnlyOverlay: true,
  interviewStage: 'tech',
});

recordSpokenAnswer(session, {
  questionText: 'Сколько лет в DevOps?',
  spokenText: 'Около трёх лет в банке, в основном инциденты и CI/CD.',
  source: 'manual',
});

const r = await injectQuestion(session.id, 'Расскажите подробнее про ваш опыт?');
assert.ok(r.answer?.script);
const script = r.answer.script.toLowerCase();
assert.ok(
  /тр|3|банк|devops|ci/i.test(script),
  `следующий ответ должен согласовываться со spoken: ${r.answer.script.slice(0, 120)}`
);

const screeningHint = stageLengthHint('screening');
const techHint = stageLengthHint('tech');
assert.match(screeningHint, /коротк/i);
assert.match(techHint, /2 строки|факты/i);

stopLiveCopilot(session.id);

const session2 = await startLiveCopilot({
  title: 'TAM',
  scriptOnlyOverlay: true,
  prepPack: {
    llm: { questionsToEmployer: ['Как устроен on-call в команде?'] },
  },
});

const emp = await injectQuestion(session2.id, 'Есть вопросы к нам?');
assert.equal(emp.answer?.script, 'Как устроен on-call в команде?');
assert.equal(emp.answer?.scriptSource, 'employer-prep');

stopLiveCopilot(session2.id);
console.log('test-interview-copilot-spoken: OK');
