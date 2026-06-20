import assert from 'node:assert/strict';
import { clearPromptState } from '../lib/interview-prompt-bridge.mjs';
import { startLiveCopilot, stopLiveCopilot } from '../lib/interview-copilot-live.mjs';
import { injectQuestion } from '../lib/interview-copilot-session.mjs';
import { getCopilotSessionSnapshot } from '../lib/interview-copilot-session.mjs';

clearPromptState('all');

const session = await startLiveCopilot({
  title: 'Latency',
  company: 'Test',
  scriptOnlyOverlay: true,
  interviewStage: 'screening',
});

const t0 = Date.now();
const r = await injectQuestion(session.id, 'На ты нормально, удобно?');
assert.equal(r.updated, true);
const snap = getCopilotSessionSnapshot(session.id);
assert.ok(snap?.tier1At || snap?.lastAnswerTier === 1 || r.answer?.tier === 1, 'tier1 path');
const elapsed = (snap?.tier1At || Date.now()) - t0;
assert.ok(elapsed < 1500, `tier1 budget ${elapsed}ms`);

stopLiveCopilot(session.id);
console.log('test-interview-copilot-latency: OK');
