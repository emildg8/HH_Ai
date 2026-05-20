/**
 * Проверка staged-файлов перед push (секреты и личные данные).
 *   npm run secrets:check
 *   git hook: scripts/install-git-hooks.*
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) return '';
  return (r.stdout || '').trim();
}

function stagedFiles() {
  const out = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function fail(msg) {
  console.error(`[secrets:check] BLOCK: ${msg}`);
  process.exit(1);
}

function checkContent(rel, text) {
  for (const { re, label } of BLOCK_PATTERNS) {
    if (re.test(text)) fail(`${label} в ${rel}`);
  }
}

function main() {
  const files = stagedFiles();
  if (files.length === 0) {
    console.log('[secrets:check] нет staged-файлов — OK');
    return;
  }

  for (const rel of files) {
    const norm = rel.replace(/\\/g, '/');
    for (const re of BLOCK_PATHS) {
      if (re.test(norm)) {
        fail(`нельзя коммитить ${rel} (личные данные/секреты)`);
      }
    }
    try {
      const blob = git(['show', `:${rel}`]);
      if (blob) checkContent(rel, blob);
    } catch {
      const full = path.resolve(rel);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        const text = fs.readFileSync(full, 'utf8');
        checkContent(rel, text);
      }
    }
  }

  console.log(`[secrets:check] OK (${files.length} staged)`);
}

main();
