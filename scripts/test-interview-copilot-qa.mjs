import assert from 'node:assert/strict';
import { clearPromptState, getPromptState } from '../lib/interview-prompt-bridge.mjs';
import { setCopilotMode, clearCopilotMode } from '../lib/interview-copilot-mode.mjs';
import { startLiveCopilot, stopLiveCopilot } from '../lib/interview-copilot-live.mjs';
import { injectQuestion } from '../lib/interview-copilot-session.mjs';
import { processLiveChunk } from '../lib/interview-copilot-qa.mjs';
import { getCopilotSession } from '../lib/interview-copilot-session.mjs';

clearPromptState('all');
clearCopilotMode();

const session = await startLiveCopilot({
  title: 'DevOps',
  company: 'TestCo',
  scriptOnlyOverlay: true,
  prepContext: 'Стек: Kubernetes, CI/CD',
  interviewStage: 'tech',
});

assert.ok(session.id);
assert.equal(session.scriptOnlyOverlay, true);

const inj = await injectQuestion(session.id, 'На ты нормально, удобно?');
assert.equal(inj.updated, true);
assert.ok(inj.answer?.script);

const state = getPromptState('live');
assert.ok(state?.text);
assert.ok(!state.text.includes('Вопрос:'), 'overlay без блока вопроса');

setCopilotMode('live', session.id);
const chunk = await processLiveChunk(session, 'Расскажите про ваш опыт с мониторингом?');
assert.equal(chunk.updated, true);

stopLiveCopilot(session.id);
assert.equal(getPromptState('live'), null);

console.log('test-interview-copilot-qa: OK');
