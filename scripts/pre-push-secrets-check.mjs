/**
 * Проверка секретов и личных данных.
 *   npm run secrets:check — staged-файлы
 *   git hook: scripts/install-git-hooks.* — все коммиты, уходящие в remote
 */

import { spawnSync } from 'child_process';
import fs from 'fs';

const BLOCK_PATTERNS = [
  { re: /sk-or-v1-[a-zA-Z0-9._-]{20,}/, label: 'OpenRouter API key' },
  { re: /(?:OPENROUTER_API_KEY|OpenRouter_API_KEY)\s*=\s*sk-/i, label: 'OpenRouter key in env' },
  { re: /ghp_[a-zA-Z0-9]{20,}/, label: 'GitHub token' },
  { re: /gho_[a-zA-Z0-9]{20,}/, label: 'GitHub OAuth token' },
];

const BLOCK_PATHS = [
  /^config\/secrets\.local\.env$/,
  /^config\/profiles\/[^/]+\.env$/,
  /^config\/devops\.env$/,
  /^data\/vacancies-devops\.json$/,
  /^data\/session\//,
  /^\.env$/,
  /^CV\//,
];

const ZERO_SHA = /^0+$/;
const SHA = /^[0-9a-f]{40,64}$/i;

function fail(msg) {
  console.error(`[secrets:check] BLOCK: ${msg}`);
  process.exit(1);
}

function git(args) {
  const r = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    fail(`git ${args[0]} завершился с ошибкой; push отменён`);
  }
  return r.stdout || '';
}

function splitNull(out) {
  return out.split('\0').filter(Boolean);
}

function checkContent(rel, text) {
  for (const { re, label } of BLOCK_PATTERNS) {
    if (re.test(text)) fail(`${label} в ${rel}`);
  }
}

function checkPath(rel) {
  const norm = rel.replace(/\\/g, '/');
  for (const re of BLOCK_PATHS) {
    if (re.test(norm)) {
      fail(`нельзя отправлять ${rel} (личные данные/секреты)`);
    }
  }
}

function checkStaged() {
  const files = splitNull(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']));
  if (files.length === 0) {
    console.log('[secrets:check] нет staged-файлов — OK');
    return;
  }

  for (const rel of files) {
    checkPath(rel);
    checkContent(rel, git(['show', `:${rel}`]));
  }

  console.log(`[secrets:check] OK (${files.length} staged)`);
}

function parsePushUpdates(input) {
  const lines = input.split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4 || !SHA.test(fields[1]) || !SHA.test(fields[3])) {
      fail('не удалось разобрать данные pre-push; push отменён');
    }
    return {
      localRef: fields[0],
      localSha: fields[1],
      remoteRef: fields[2],
      remoteSha: fields[3],
    };
  });
}

function looksLikePushInput(input) {
  const lines = input.split(/\r?\n/).filter((line) => line.trim());
  return (
    lines.length > 0 &&
    lines.every((line) => {
      const fields = line.trim().split(/\s+/);
      return fields.length === 4 && SHA.test(fields[1]) && SHA.test(fields[3]);
    })
  );
}

function outgoingCommits(updates, remoteName) {
  const commits = new Set();
  for (const { localSha, remoteSha } of updates) {
    if (ZERO_SHA.test(localSha)) continue;
    const args = ['rev-list', localSha, '--not'];
    if (ZERO_SHA.test(remoteSha)) {
      args.push(`--remotes=${remoteName}`);
    } else {
      args.push(remoteSha);
    }
    for (const commit of git(args).split(/\r?\n/).filter(Boolean)) {
      commits.add(commit);
    }
  }
  return [...commits];
}

function checkOutgoing(input, remoteName = 'origin') {
  const updates = parsePushUpdates(input);
  const commits = outgoingCommits(updates, remoteName);
  const checked = new Set();

  for (const commit of commits) {
    const files = splitNull(
      git([
        'diff-tree',
        '--root',
        '-m',
        '--no-commit-id',
        '--name-only',
        '-r',
        '--diff-filter=ACMR',
        '-z',
        commit,
      ])
    );
    for (const rel of files) {
      const key = `${commit}\0${rel}`;
      if (checked.has(key)) continue;
      checked.add(key);
      checkPath(rel);
      checkContent(rel, git(['show', `${commit}:${rel}`]));
    }
  }

  console.log(`[secrets:check] OK (${commits.length} outgoing commits)`);
}

function main() {
  const explicitPrePush = process.argv.includes('--pre-push');
  const pipedInput = process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8');
  if (explicitPrePush || looksLikePushInput(pipedInput)) {
    checkOutgoing(pipedInput, process.argv[3] || 'origin');
  } else {
    checkStaged();
  }
}

main();
