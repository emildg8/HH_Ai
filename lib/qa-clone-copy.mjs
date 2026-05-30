/** Копия репозитория для QA «вариант A» (git clone) без личных data/. */

import fs from 'fs';
import path from 'path';

const QA_CLONE_SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  '.playwright-browsers',
  'playwright-report',
  'test-results',
  'backups',
  'CV',
  '.env',
  'config/secrets.local.env',
  'config/devops.env',
  'config/cover-letter.txt',
  'config/cover-letter-style-examples.txt',
]);

/**
 * @param {string} rel — путь относительно корня, с /
 */
export function shouldIgnoreQaClone(rel) {
  const n = rel.replace(/\\/g, '/');
  if (!n) return false;
  const top = n.split('/')[0];
  if (QA_CLONE_SKIP.has(top) || QA_CLONE_SKIP.has(n)) return true;
  if (n.startsWith('data/session/') || n === 'data/session') return true;
  if (/config\/profiles\/[^/]+\.env$/.test(n) && !n.endsWith('.example.env')) return true;
  if (n === 'data/vacancies-devops.json' || n === 'data/vacancies-queue.json') return true;
  if (/^data\/.*\.jsonl$/.test(n)) return true;
  if (/^data\/(qa-|hh-apply|harvest|batch|verify-|apply-chat|autopilot)/.test(n)) return true;
  if (/^data\/.*\.(png|log|pid)$/.test(n)) return true;
  if (/^data\/.*\.json$/.test(n) && !n.endsWith('.example.json')) return true;
  return false;
}

/**
 * @param {string} srcRoot
 * @param {string} destRoot
 */
export function copyRepoForQaClone(srcRoot, destRoot) {
  function walk(relDir) {
    const src = relDir ? path.join(srcRoot, relDir) : srcRoot;
    if (!fs.existsSync(src)) return;
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      const relPath = relDir ? `${relDir}/${ent.name}` : ent.name;
      const relNorm = relPath.replace(/\\/g, '/');
      if (shouldIgnoreQaClone(relNorm)) continue;
      const srcPath = path.join(srcRoot, relNorm);
      const destPath = path.join(destRoot, relNorm);
      if (ent.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(relPath);
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  fs.mkdirSync(destRoot, { recursive: true });
  walk('');
}
