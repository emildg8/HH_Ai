import assert from 'node:assert/strict';
import { clearPromptState } from '../lib/interview-prompt-bridge.mjs';
import { startLiveCopilot, stopLiveCopilot } from '../lib/interview-copilot-live.mjs';
import { getLiveSessionId } from '../lib/interview-copilot-session.mjs';
import { recordSpokenAnswer } from '../lib/interview-copilot-spoken.mjs';
import { injectQuestion } from '../lib/interview-copilot-session.mjs';
import { getCopilotSession } from '../lib/interview-copilot-session.mjs';

clearPromptState('all');

const s1 = await startLiveCopilot({
  title: 'T1',
  company: 'A',
  scriptOnlyOverlay: true,
});
const id1 = s1.id;

const s2 = await startLiveCopilot({
  title: 'T2',
  company: 'B',
  scriptOnlyOverlay: true,
});
assert.notEqual(id1, s2.id, 'повторный start создаёт новую сессию');
assert.equal(getLiveSessionId(), s2.id);

recordSpokenAnswer(s2, {
  questionText: 'Сколько лет в DevOps?',
  spokenText: 'Около трёх лет в банке.',
  source: 'manual',
});

const r = await injectQuestion(s2.id, 'Расскажите про ваш DevOps опыт?');
assert.ok(r.answer?.script);
assert.match(r.answer.script.toLowerCase(), /тр|3|банк|devops/i);

stopLiveCopilot(s2.id);
console.log('test-interview-copilot-live: OK');
