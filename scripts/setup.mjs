#!/usr/bin/env node
/**
 * Первый запуск: проверка окружения, defaults, опционально демо-очередь (R-02).
 *   npm run setup
 *   npm run setup -- --demo
 *   npm run setup -- --dashboard
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT } from '../lib/paths.mjs';
import {
  copyDemoToQueueIfMissing,
  ensureQueueExampleFile,
  getQueueMeta,
  loadDemoIntoActiveQueue,
} from '../lib/demo-queue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const withDemo = args.has('--demo');
const openDashboard = args.has('--dashboard');

function log(step, msg) {
  console.log(`[setup] ${step}. ${msg}`);
}

function runNode(script, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script), ...extraArgs], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

function copyIfMissing(src, dest, label) {
  if (fs.existsSync(dest)) return;
  if (!fs.existsSync(src)) {
    console.warn(`[setup] пропуск ${label}: нет ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  log('+', label);
}

async function main() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(nodeMajor) || nodeMajor < 18) {
    console.error('[setup] Нужен Node.js 18+. Скачайте LTS с https://nodejs.org');
    process.exit(1);
  }
  log('1/4', `Node ${process.version}`);

  copyIfMissing(path.join(ROOT, '.env.example'), path.join(ROOT, '.env'), '.env');
  copyIfMissing(
    path.join(ROOT, 'config', 'presets', 'no-llm.env'),
    path.join(ROOT, 'config', 'secrets.local.env'),
    'config/secrets.local.env'
  );
  copyIfMissing(
    path.join(ROOT, 'config', 'profiles', 'devops.env.example'),
    path.join(ROOT, 'config', 'profiles', 'devops.env'),
    'config/profiles/devops.env'
  );
  copyIfMissing(
    path.join(ROOT, 'config', 'cover-letter.example.txt'),
    path.join(ROOT, 'config', 'cover-letter.txt'),
    'config/cover-letter.txt'
  );
  copyIfMissing(
    path.join(ROOT, 'config', 'resume-routing.example.json'),
    path.join(ROOT, 'config', 'resume-routing.json'),
    'config/resume-routing.json'
  );
  copyIfMissing(
    path.join(ROOT, 'dashboard', 'public', 'local-dashboard-defaults.example.mjs'),
    path.join(ROOT, 'dashboard', 'public', 'local-dashboard-defaults.mjs'),
    'local-dashboard-defaults.mjs'
  );
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'CV'), { recursive: true });
  ensureQueueExampleFile();

  log('2/4', 'Файлы конфигурации готовы');

  try {
    await runNode('setup-check.mjs');
  } catch {
    log('!', 'setup:check — есть предупреждения (ожидаемо до login)');
  }

  log('3/4', 'Проверка setup:check выполнена');

  if (withDemo || getQueueMeta().empty) {
    const r = withDemo ? loadDemoIntoActiveQueue({ replace: true }) : copyDemoToQueueIfMissing();
    if (r.ok) log('4/4', `Демо-очередь: ${r.count} вакансий`);
    else if (r.skipped) log('4/4', `Очередь не пуста (${r.count ?? '—'} записей), демо не загружали`);
    else log('4/4', 'Очередь без изменений');
  } else {
    log('4/4', 'Очередь уже содержит записи');
  }

  console.log('');
  console.log('Дальше:');
  console.log('  1. npm run login');
  console.log('  2. npm run dashboard  →  http://127.0.0.1:3849');
  console.log('  3. Ctrl+F5 после обновления UI');
  console.log('');

  if (openDashboard) {
    const child = spawn(process.execPath, ['scripts/dashboard-server.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
      detached: process.platform !== 'win32',
    });
    child.unref();
  }
}

main().catch((e) => {
  console.error('[setup] FAIL:', e.message || e);
  process.exit(1);
});
