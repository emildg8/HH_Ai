/**
 * Runtime-файлы data/ не должны быть в git (кроме allowlist).
 *   node scripts/test-data-gitignore.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT } from '../lib/paths.mjs';

const ALLOWLIST = new Set([
  'data/vacancies-queue.example.json',
]);

const RUNTIME_PATTERNS = [
  /^data\/intelligence-.*\.json$/,
  /^data\/plan-snapshots\//,
  /^data\/plan-rollback\//,
  /^data\/chat-follow-up-state\.json$/,
  /^data\/daily-digest-last\.json$/,
  /^data\/letter-quality-report\.json$/,
  /^data\/interview-replay-plans\//,
  /^data\/candidate-profiles\//,
  /^data\/hh-negotiations-cache\.json$/,
  /^data\/hh-negotiations-cache\.json\.bak/,
  /^data\/telegram-bot\.pid$/,
  /^data\/vacancies-devops\.json$/,
  /^data\/vacancies-queue\.json$/,
];

const tracked = spawnSync('git', ['ls-files', 'data'], { cwd: ROOT, encoding: 'utf8' });
if (tracked.status !== 0) {
  console.log('test-data-gitignore: skip (not a git repo or git unavailable)');
  process.exit(0);
}

const files = tracked.stdout
  .split(/\r?\n/)
  .map((l) => l.trim().replace(/\\/g, '/'))
  .filter(Boolean);

const violations = [];
for (const rel of files) {
  if (ALLOWLIST.has(rel)) continue;
  for (const re of RUNTIME_PATTERNS) {
    if (re.test(rel)) {
      violations.push(rel);
      break;
    }
  }
}

if (violations.length) {
  console.error('test-data-gitignore: runtime data tracked in git:');
  for (const v of violations) console.error(' -', v);
  process.exit(1);
}

const gitignorePath = path.join(ROOT, '.gitignore');
const gitignore = fs.readFileSync(gitignorePath, 'utf8');
const mustContain = ['data/intelligence-', 'data/plan-snapshots/', 'scripts/__pycache__/'];
for (const needle of mustContain) {
  assert.ok(gitignore.includes(needle), `.gitignore должен содержать: ${needle}`);
}

console.log('test-data-gitignore: OK');
