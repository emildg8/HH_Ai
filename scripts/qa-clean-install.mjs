/**
 * Автоматический прогон QA «вариант B» (zip / portable) без личных data/.
 * Симулирует чистую установку: export → npm install → setup:check → дашборд + UI smoke.
 *
 *   npm run qa:clean-install
 *   npm run qa:clean-install -- --skip-playwright   # быстрее, если Chromium уже есть
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const skipPlaywright = process.argv.includes('--skip-playwright');
const OUT = path.join(ROOT, 'dist', 'qa-clean-install');
const REPORT = path.join(ROOT, 'data', 'qa-clean-install-report.json');
const started = Date.now();

/** @type {Array<{ id: string, ok: boolean, detail?: string, ms?: number }>} */
const steps = [];

function step(id, ok, detail = '') {
  steps.push({ id, ok, detail, ms: Date.now() - started });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`  ${mark}  ${id}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function runNode(args, cwd, env = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: false,
  });
  return { status: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function waitHttp(url, ms = 30_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
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

function mustExist(rel) {
  const p = path.join(OUT, rel);
  return fs.existsSync(p);
}

async function main() {
  console.log('[qa:clean-install] вариант B (portable zip simulation)\n');

  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });

  const exp = runNode(['scripts/export-public.mjs', `--out=${OUT}`], ROOT);
  if (!step('B-export', exp.status === 0, exp.status !== 0 ? exp.stderr.slice(0, 200) : '')) {
    writeReport(false);
    process.exit(1);
  }

  for (const f of [
    'EXPORT-README.md',
    'scripts/install-portable.ps1',
    'start-dashboard.bat',
    'docs/demo/vacancies-demo.json',
    'config/presets/no-llm.env',
  ]) {
    step(`B-structure:${f}`, mustExist(f), mustExist(f) ? '' : 'missing');
  }

  const readme = fs.readFileSync(path.join(OUT, 'EXPORT-README.md'), 'utf8');
  step('B-readme-portable', /install-portable/i.test(readme));

  console.log('\n[qa:clean-install] npm install (может занять 1–2 мин)…');
  const npm = spawnSync('npm', ['install', '--ignore-scripts'], {
    cwd: OUT,
    stdio: 'inherit',
    shell: true,
  });
  if (!step('B-npm-install', npm.status === 0)) {
    writeReport(false);
    process.exit(1);
  }

  if (!skipPlaywright) {
    console.log('[qa:clean-install] playwright chromium…');
    const pw = spawnSync('npx', ['playwright', 'install', 'chromium'], {
      cwd: OUT,
      stdio: 'inherit',
      shell: true,
    });
    step('B-playwright', pw.status === 0);
  } else {
    step('B-playwright', true, 'skipped');
  }

  // Эмуляция install-portable.ps1 (копии конфигов)
  const copies = [
    ['.env.example', '.env'],
    ['config/presets/no-llm.env', 'config/secrets.local.env'],
    ['config/profiles/devops.env.example', 'config/profiles/devops.env'],
    ['config/cover-letter.example.txt', 'config/cover-letter.txt'],
    ['config/resume-routing.example.json', 'config/resume-routing.json'],
  ];
  for (const [src, dest] of copies) {
    const sp = path.join(OUT, src);
    const dp = path.join(OUT, dest);
    if (fs.existsSync(sp) && !fs.existsSync(dp)) {
      fs.mkdirSync(path.dirname(dp), { recursive: true });
      fs.copyFileSync(sp, dp);
    }
  }
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'CV'), { recursive: true });
  step('B-portable-config', fs.existsSync(path.join(OUT, 'config/secrets.local.env')));

  const check = runNode(['scripts/setup-check.mjs'], OUT, { HH_QA_CLEAN: '1' });
  const checkOk = check.status === 0;
  step('B-setup-check', checkOk, checkOk ? '' : check.stdout.split('\n').slice(-5).join(' '));

  let child = null;
  try {
    child = spawn(process.execPath, ['scripts/dashboard-server.mjs', '--queue-file=./docs/demo/vacancies-demo.json'], {
      cwd: OUT,
      stdio: 'ignore',
      env: { ...process.env, HH_VACANCIES_QUEUE_FILE: './docs/demo/vacancies-demo.json' },
    });
    await new Promise((r) => setTimeout(r, 2500));
    const up = await waitHttp('http://127.0.0.1:3849');
    step('B-dashboard-up', up);

    if (up) {
      if (!skipPlaywright) {
        spawnSync('npx', ['playwright', 'install', 'chromium'], {
          cwd: OUT,
          stdio: 'ignore',
          shell: true,
        });
      }
      const ui = runNode(['scripts/test-dashboard-ui.mjs'], OUT, {
        DASHBOARD_URL: 'http://127.0.0.1:3849',
      });
      step('B-dashboard-ui', ui.status === 0, ui.status !== 0 ? ui.stderr.slice(0, 300) : '');
    }
  } finally {
    if (child) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  }

  const friction = [];
  if (!checkOk) friction.push({ step: 'B-setup-check', issue: 'setup:check не green после portable-копий' });
  if (!mustExist('config/profiles/devops.env.example') && !fs.existsSync(path.join(OUT, 'config/profiles/devops.env.example'))) {
    friction.push({ step: 'B-portable', issue: 'install-portable не копирует profile/secrets как install.ps1' });
  }

  const ok = steps.every((s) => s.ok);
  writeReport(ok, friction);
  console.log(`\n[qa:clean-install] ${ok ? 'ВСЁ OK' : 'есть ошибки'} (${Math.round((Date.now() - started) / 1000)} с)`);
  console.log(`  отчёт: ${REPORT}`);
  process.exit(ok ? 0 : 1);
}

function writeReport(ok, friction = []) {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(
    REPORT,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        variant: 'B-portable-simulation',
        ok,
        durationSec: Math.round((Date.now() - started) / 1000),
        steps,
        friction,
        version: fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
