/**
 * Локальная проверка: синтаксис, экспорт без секретов, UI дашборда (если запущен).
 *   npm run verify:local
 *   npm run verify:local -- --start-dashboard
 */

import { spawn, spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { ROOT } from '../lib/paths.mjs';
import { shouldIgnoreExport } from '../lib/export-ignore.mjs';

loadEnv();
applyStoredProfile();

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

function killDashboardPort() {
  const port = Number(process.env.DASHBOARD_PORT) || 3849;
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { encoding: 'utf8', cwd: ROOT }
      ).trim();
      for (const pid of out.split(/\s+/).filter((x) => /^\d+$/.test(x))) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { cwd: ROOT, stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    execSync(`lsof -ti :${port} | xargs -r kill -9`, { cwd: ROOT, stdio: 'ignore' });
  } catch {
    /* порт свободен */
  }
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
  const dashCheck = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-dashboard-modules.mjs')], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  if (dashCheck.status !== 0) {
    if (dashCheck.stdout) process.stdout.write(dashCheck.stdout);
    if (dashCheck.stderr) process.stderr.write(dashCheck.stderr);
    fail('check:dashboard');
  }
  if (!failures.some((f) => f.startsWith('syntax') || f === 'check:dashboard')) {
    pass('syntax scripts/lib + check:dashboard');
  }
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

function runDashboardScript(script, label) {
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, DASHBOARD_URL: BASE },
    stdio: 'inherit',
  });
  if (r.status === 0) pass(label);
  else fail(label);
}

async function checkDashboard(child) {
  if (!(await waitHttp(BASE))) {
    fail('dashboard не отвечает на ' + BASE);
    if (child) child.kill();
    return;
  }
  // Дать фронту подтянуть /api/vacancies и отрисовать список после cold start.
  await new Promise((r) => setTimeout(r, child ? 1500 : 0));
  runDashboardScript('scripts/test-dashboard-ui.mjs', 'test-dashboard-ui (85/100/115%, анкета)');
  runDashboardScript(
    'scripts/test-dashboard-integration.mjs',
    'test-dashboard-integration (API + кнопки/тогглы)'
  );
  runDashboardScript('scripts/test-restore-action.mjs', 'test-restore-action (restore/unhide API)');
  runDashboardScript('scripts/test-rejected-filter.mjs', 'test-rejected-filter (auto/manual API)');
  runDashboardScript('scripts/test-section-counters.mjs', 'test-section-counters (вкладки раздела)');
  runDashboardScript('scripts/test-dashboard-copy.mjs', 'test-dashboard-copy (plain language)');
  runDashboardScript('scripts/test-dashboard-docks.mjs', 'test-dashboard-docks (сплиттеры)');
  if (child) child.kill();
}

function checkUxAndApply() {
  const steps = [
    ['scripts/test-apply-session.mjs', 'test-apply-session'],
    ['scripts/test-outcome-feedback.mjs', 'test-outcome-feedback'],
    ['scripts/test-apply-view-deferred.mjs', 'test-apply-view-deferred'],
    ['scripts/test-export-portable.mjs', 'test-export-portable'],
    ['scripts/test-ux-lib.mjs', 'test-ux-lib'],
    ['scripts/test-sidebar-builder.mjs', 'test-sidebar-builder'],
    ['scripts/test-mobile-layout.mjs', 'test-mobile-layout'],
    ['scripts/test-list-breadcrumbs.mjs', 'test-list-breadcrumbs'],
    ['scripts/test-apply-copy-dom.mjs', 'test-apply-copy-dom'],
    ['scripts/test-questionnaire-auto-reprobe.mjs', 'test-questionnaire-auto-reprobe'],
    ['scripts/test-role-reject-learn.mjs', 'test-role-reject-learn'],
    ['scripts/test-reject-source.mjs', 'test-reject-source'],
    ['scripts/test-playwright-display-mode.mjs', 'test-playwright-display-mode'],
    ['scripts/test-funnel-charts.mjs', 'test-funnel-charts'],
    ['scripts/test-funnel-export.mjs', 'test-funnel-export'],
    ['scripts/test-job-progress-ui.mjs', 'test-job-progress-ui'],
    ['scripts/test-dashboard-preferences.mjs', 'test-dashboard-preferences'],
    ['scripts/test-batch-scope.mjs', 'test-batch-scope'],
    ['scripts/test-batch-candidates.mjs', 'test-batch-candidates'],
    ['scripts/test-vacancy-work-format.mjs', 'test-vacancy-work-format'],
    ['scripts/test-batch-letter-quality.mjs', 'test-batch-letter-quality'],
    ['scripts/test-letters.mjs', 'test-letters'],
    ['scripts/test-cover-letter-issues.mjs', 'test-cover-letter-issues'],
    ['scripts/test-letter-quality-golden.mjs', 'test-letter-quality-golden'],
    ['scripts/test-cover-letter-quality-hub.mjs', 'test-cover-letter-quality-hub'],
    ['scripts/test-cover-letter-quality-scan.mjs', 'test-cover-letter-quality-scan'],
    ['scripts/test-cover-letter-prepare.mjs', 'test-cover-letter-prepare'],
    ['scripts/test-cover-letter-quality-retry.mjs', 'test-cover-letter-quality-retry'],
    ['scripts/test-cover-letter-brief-cache.mjs', 'test-cover-letter-brief-cache'],
    ['scripts/test-letter-invite-correlation.mjs', 'test-letter-invite-correlation'],
    ['scripts/test-letter-style-learning.mjs', 'test-letter-style-learning'],
    ['scripts/test-targeting-golden.mjs', 'test-targeting-golden'],
    ['scripts/test-false-positive-analytics.mjs', 'test-false-positive-analytics'],
    ['scripts/test-vacancy-targeting.mjs', 'test-vacancy-targeting'],
    ['scripts/test-quality-baseline.mjs', 'test-quality-baseline'],
    ['scripts/test-learning-auto-apply.mjs', 'test-learning-auto-apply'],
    ['scripts/test-cover-letter-company-name.mjs', 'test-cover-letter-company-name'],
    ['scripts/test-batch-letter-quality-report.mjs', 'test-batch-letter-quality-report'],
    ['scripts/test-letter-score.mjs', 'test-letter-score'],
    ['scripts/test-workspace-docks-logic.mjs', 'test-workspace-docks-logic'],
    ['scripts/test-vacancy-defer.mjs', 'test-vacancy-defer'],
    ['scripts/test-telegram-bot.mjs', 'test-telegram-bot'],
    ['scripts/test-chat-inbox.mjs', 'test-chat-inbox'],
    ['scripts/test-remote-stats.mjs', 'test-remote-stats'],
  ];
  for (const [script, label] of steps) {
    const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' });
    if (r.status === 0) pass(label);
    else fail(label);
  }
}

async function main() {
  console.log('[verify-local] старт\n');
  checkSyntax();
  checkUxAndApply();
  checkExport();

  let child = null;
  if (startDash) {
    killDashboardPort();
    await new Promise((r) => setTimeout(r, 500));
    child = spawn(process.execPath, ['scripts/dashboard-server.mjs'], {
      cwd: ROOT,
      stdio: 'ignore',
      detached: false,
      env: { ...process.env },
    });
    await new Promise((r) => setTimeout(r, 2500));
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
