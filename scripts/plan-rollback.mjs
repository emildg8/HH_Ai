#!/usr/bin/env node
/**
 * Откат настроек из снимка data/plan-rollback/.
 *   npm run devops:plan-rollback
 *   npm run devops:plan-rollback -- --list
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

import { ROOT, PREFS_FILE, DATA_DIR } from '../lib/paths.mjs';

const ROLLBACK_DIR = path.join(DATA_DIR, 'plan-rollback');

function listBackups() {
  if (!fs.existsSync(ROLLBACK_DIR)) return [];
  return fs
    .readdirSync(ROLLBACK_DIR)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .reverse();
}

function saveBackup(kind, srcPath) {
  if (!fs.existsSync(srcPath)) return null;
  fs.mkdirSync(ROLLBACK_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(ROLLBACK_DIR, `${kind}-${stamp}.json`);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

function main() {
  if (process.argv.includes('--list')) {
    console.log(listBackups().join('\n') || '(пусто)');
    return;
  }

  if (process.argv.includes('--save')) {
    const prefs = saveBackup('preferences', PREFS_FILE);
    console.log('[rollback] сохранено:', prefs || 'нет preferences');
    return;
  }

  const backups = listBackups();
  const prefsBackup = backups.find((n) => n.startsWith('preferences-'));
  if (!prefsBackup) {
    console.error('[rollback] Нет бэкапа preferences. Сначала: npm run devops:plan-rollback -- --save');
    process.exit(1);
  }
  fs.copyFileSync(path.join(ROLLBACK_DIR, prefsBackup), PREFS_FILE);
  console.log('[rollback] восстановлен', PREFS_FILE, 'из', prefsBackup);
}

main();
