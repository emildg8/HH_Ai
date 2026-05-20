/**
 * Локальная проверка: синтаксис, экспорт без секретов, UI дашборда (если запущен).
 *   npm run verify:local
 *   npm run verify:local -- --start-dashboard
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { shouldIgnoreExport } from '../lib/export-ignore.mjs';

const startDash = process.argv.includes('--start-dashboard');
const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';
const reportPath = path.join(ROOT, 'data', 'verify-last.json');

const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
  console.log(`  OK  ${msg}`);
}
function fail(msg) {
  failures.push(msg);
  console.error(` FAIL ${msg}`);
}

function checkSyntax() {
  const dirs = ['scripts', 'lib'];
  for (const dir of dirs) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      if (!name.endsWith('.mjs')) continue;
      const f = path.join(ROOT, dir, name);
      const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
      if (r.status !== 0) fail(`syntax ${dir}/${name}`);
    }
  }
  if (!failures.some((f) => f.startsWith('syntax'))) pass('syntax scripts/lib');
}

const PII_PATTERNS = [
  [/sk-or-v1-[a-zA-Z0-9._-]{20,}/, 'openrouter key'],
  [/emilianjob@ya\.ru/i, 'email'],
  [/emilianjob@yandex\.ru/i, 'email'],
  [/\+7\s*\(985\)\s*421-59-98/, 'phone'],
  [/@emildg8\b/i, 'telegram'],
  [/emil-shahvaladov/i, 'name in path'],
  [/D:\\Dev\\HH\\hh-ru-apply/i, 'local path'],
];

const PII_SKIP_FILES = new Set([
  'scripts/export-public.mjs',
  'scripts/smoke-release.mjs',
  'scripts/verify-local.mjs',
]);

function checkPiiInExport(exportRoot) {
  function walk(relDir) {
    const full = path.join(exportRoot, relDir);
    if (!fs.existsSync(full)) return;
    for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (shouldIgnoreExport(rel)) continue;
      if (PII_SKIP_FILES.has(rel)) continue;
      const p = path.join(full, ent.name);
      if (ent.isDirectory()) walk(rel);
      else {
        const ext = path.extname(ent.name).toLowerCase();
        const textLike = ['.mjs', '.js', '.json', '.md', '.txt', '.html', '.css', '.env', '.example'].some(
          (e) => ent.name.endsWith(e) || ext === e
        );
        if (!textLike) continue;
        const text = fs.readFileSync(p, 'utf8');
        for (const [re, label] of PII_PATTERNS) {
          if (re.test(text)) fail(`PII (${label}) in export: ${rel}`);
        }
      }
    }
  }
  walk('');
  if (!failures.some((f) => f.includes('PII'))) pass('export без PII и секретов');
}

function checkExport() {
  const r = spawnSync(process.execPath, ['scripts/export-public.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (r.status !== 0) {
    fail('export:public');
    return;
  }
  checkPiiInExport(path.join(ROOT, 'dist', 'hh-ai-public'));
  if (fs.existsSync(path.join(ROOT, 'dist', 'hh-ai-public', 'data', 'session'))) {
    fail('session in public export');
  } else pass('export:public без session');
}

async function waitHttp(url, ms = 25_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function checkDashboard(child) {
  if (!(await waitHttp(BASE))) {
    fail('dashboard не отвечает на ' + BASE);
    if (child) child.kill();
    return;
  }
  const r = spawnSync(process.execPath, ['scripts/test-dashboard-ui.mjs'], {
    cwd: ROOT,
    env: { ...process.env, DASHBOARD_URL: BASE },
    stdio: 'inherit',
  });
  if (r.status === 0) pass('test-dashboard-ui (85/100/115%, анкета)');
  else fail('test-dashboard-ui');
  if (child) child.kill();
}

async function main() {
  console.log('[verify-local] старт\n');
  checkSyntax();
  checkExport();

  let child = null;
  if (startDash) {
    child = spawn(process.execPath, ['scripts/dashboard-server.mjs'], {
      cwd: ROOT,
      stdio: 'ignore',
      detached: false,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    try {
      const res = await fetch(BASE);
      if (!res.ok) console.log('  … дашборд не запущен, UI-тест пропущен (npm run verify:local -- --start-dashboard)');
      else await checkDashboard(null);
    } catch {
      console.log('  … дашборд не запущен, UI-тест пропущен');
    }
  }
  if (startDash) await checkDashboard(child);

  const report = {
    at: new Date().toISOString(),
    version: fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(),
    passes,
    failures,
    ok: failures.length === 0,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n[verify-local] ${report.ok ? 'ВСЁ OK' : `ошибок: ${failures.length}`}`);
  console.log(`  отчёт: ${reportPath}`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
