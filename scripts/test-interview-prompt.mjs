import assert from 'node:assert/strict';
import {
  buildPromptPackFromPrep,
  buildPromptPackFromTechMock,
  buildPromptPackFromHrMock,
  buildPromptState,
  formatPromptText,
} from '../lib/interview-prompt.mjs';
import { pushPromptState, getPromptState, clearPromptState } from '../lib/interview-prompt-bridge.mjs';
import { promptPresetLabel, promptSourceLabel } from '../lib/interview-prompt-labels.mjs';

const prep = buildPromptPackFromPrep({
  vacancyTitle: 'DevOps',
  company: 'Bank',
  checklist: ['On-call', 'CI/CD'],
  llm: { pitch: '14 лет L2', techQuestions: ['Kubernetes?'], behavioralQuestions: ['Инцидент?'] },
});
assert.equal(prep.source, 'prep');
assert.ok(prep.questions.length >= 2);

assert.equal(promptPresetLabel('thesis'), 'Кратко');
assert.equal(promptSourceLabel('mock-tech'), 'Тех. вопросы');

const tech = buildPromptPackFromTechMock({
  questions: [{ question: 'Docker?' }, 'Linux?'],
  focus: ['Kubernetes'],
  tips: [{ tip: 'Говори цифрами' }],
}, { title: 'DevOps', company: 'X' });
const thesis = formatPromptText(tech, 'thesis');
assert.match(thesis, /Docker/);
assert.doesNotMatch(thesis, /\[object Object\]/);
const star = formatPromptText(tech, 'star');
assert.match(star, /С — ситуация/);
const key5 = formatPromptText(tech, 'key5');
assert.ok(key5.split('\n').length <= 5);

const hr = buildPromptPackFromHrMock({
  questions: ['ЗП?'],
  checklist: ['Удалёнка'],
  suggestedAnswers: '150-180k',
}, { title: 'HR' });
assert.ok(hr.questions.length);

const state = buildPromptState(tech, 'thesis');
assert.ok(state.text.length > 10);
assert.equal(state.preset, 'thesis');
assert.equal(state.presetLabel, 'Кратко');
assert.equal(state.sourceLabel, 'Тех. вопросы');

clearPromptState();
assert.equal(getPromptState(), null);
const pushed = pushPromptState(state);
assert.ok(pushed.revision);
assert.equal(getPromptState()?.text, state.text);

console.log('test-interview-prompt: OK');
