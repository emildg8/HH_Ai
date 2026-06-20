/**
 * ops-log.jsonl — схема строки (если файл есть).
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const LOG = path.join(ROOT, 'data', 'ops-log.jsonl');
const FIXTURE = path.join(ROOT, 'scripts', 'fixtures', 'ops-log-example.jsonl');

function validateLine(obj, label) {
  assert.ok(obj.at, `${label}: at`);
  assert.ok(obj.type, `${label}: type`);
  assert.ok(Number.isFinite(Date.parse(obj.at)), `${label}: at ISO`);
}

if (fs.existsSync(LOG)) {
  const lines = fs.readFileSync(LOG, 'utf8').trim().split(/\n/).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    validateLine(JSON.parse(lines[i]), `ops-log:${i + 1}`);
  }
} else if (fs.existsSync(FIXTURE)) {
  const line = fs.readFileSync(FIXTURE, 'utf8').trim().split(/\n/)[0];
  validateLine(JSON.parse(line), 'fixture');
} else {
  fs.writeFileSync(
    FIXTURE,
    '{"at":"2026-06-19T12:00:00.000Z","type":"llm_budget_decision","note":"example"}\n',
    'utf8'
  );
  validateLine(JSON.parse(fs.readFileSync(FIXTURE, 'utf8').trim()), 'fixture');
}

console.log('test-ops-log-schema: OK');
