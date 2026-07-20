import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./pre-push-secrets-check.mjs', import.meta.url));
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-ai-secrets-check-'));

function git(args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return (result.stdout || '').trim();
}

function write(rel, text) {
  const file = path.join(repo, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function commit(message) {
  git(['add', '-A']);
  git(['commit', '-q', '-m', message]);
  return git(['rev-parse', 'HEAD']);
}

function check(args = [], input = '') {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: repo,
    input,
    encoding: 'utf8',
  });
}

function pushLine(localSha, remoteSha) {
  return `refs/heads/test ${localSha} refs/heads/test ${remoteSha}\n`;
}

try {
  git(['init', '-q']);
  git(['config', 'user.name', 'Secrets Test']);
  git(['config', 'user.email', 'secrets-test@example.invalid']);

  write('README.md', 'safe base\n');
  const base = commit('base');

  write('docs/safe.md', 'safe outgoing change\n');
  const safe = commit('safe');
  const safeResult = check(['--pre-push', 'origin', 'example.invalid'], pushLine(safe, base));
  assert.equal(safeResult.status, 0, safeResult.stderr);
  assert.match(safeResult.stdout, /1 outgoing commits/);

  const fakeToken = ['sk', 'or', 'v1', 'A'.repeat(24)].join('-');
  write('docs/credentials.txt', `${fakeToken}\n`);
  commit('accidentally add secret');
  fs.rmSync(path.join(repo, 'docs', 'credentials.txt'));
  const cleanedTip = commit('remove secret');

  // Legacy installed hooks do not pass --pre-push, so piped hook input must still select push mode.
  const leakedHistory = check([], pushLine(cleanedTip, safe));
  assert.equal(leakedHistory.status, 1);
  assert.match(leakedHistory.stderr, /OpenRouter API key/);

  write('config/devops.env', 'HH_PROFILE=devops\n');
  git(['add', 'config/devops.env']);
  const stagedResult = check();
  assert.equal(stagedResult.status, 1);
  assert.match(stagedResult.stderr, /config\/devops\.env/);

  console.log('test-pre-push-secrets-check: OK');
} finally {
  fs.rmSync(repo, { recursive: true, force: true });
}
