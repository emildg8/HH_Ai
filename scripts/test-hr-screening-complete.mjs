/**
 * hr-screening-answers: структура example + опционально личный файл.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { loadHrScreeningAnswers } from '../lib/hr-screening-answers.mjs';

const EXAMPLE = path.join(ROOT, 'config', 'hr-screening-answers.example.json');
const PERSONAL = path.join(ROOT, 'config', 'hr-screening-answers.json');

const REQUIRED = [
  'startDate',
  'salary',
  'employment',
  'remote',
  'english',
  'careerBridge',
  'onCall',
  'probation',
];

assert.ok(fs.existsSync(EXAMPLE), 'config/hr-screening-answers.example.json');
const example = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
for (const k of REQUIRED) {
  assert.ok(String(example[k] || '').trim().length > 10, `example.${k} заполнен`);
}

const loaded = loadHrScreeningAnswers();
for (const k of REQUIRED) {
  assert.ok(String(loaded[k] || '').trim(), `loadHrScreeningAnswers.${k}`);
}

if (fs.existsSync(PERSONAL)) {
  const personal = fs.readFileSync(PERSONAL, 'utf8');
  assert.ok(!/ВСТАВЬТЕ/i.test(personal), 'личный hr-screening без ВСТАВЬТЕ');
}

console.log('test-hr-screening-complete: OK');
