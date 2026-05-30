/**
 * Автоматический прогон QA чистой установки (варианты A и B).
 *
 *   npm run qa:clean-install                    # A + B
 *   npm run qa:clean-install -- --variant=b     # только portable zip
 *   npm run qa:clean-install -- --variant=a     # только git clone
 *   npm run qa:clean-install -- --skip-playwright
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { copyRepoForQaClone } from '../lib/qa-clone-copy.mjs';

const skipPlaywright = process.argv.includes('--skip-playwright');
const variantArg = (process.argv.find((a) => a.startsWith('--variant=')) || '--variant=all').slice(
  '--variant='.length
);
const REPORT = path.join(ROOT, 'data', 'qa-clean-install-report.json');
const started = Date.now();

/** @type {Record<string, Array<{ id: string, ok: boolean, detail?: string, ms?: number }>>} */
const byVariant = {};

function parseVariants() {
  const v = variantArg.toLowerCase();
  if (v === 'a') return ['A'];
  if (v === 'b') return ['B'];
  return ['A', 'B'];
}

function step(variant, id, ok, detail = '') {
  if (!byVariant[variant]) byVariant[variant] = [];
  byVariant[variant].push({ id, ok, detail, ms: Date.now() - started });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`  ${mark}  ${variant}-${id}${detail ? ` — ${detail}` : ''}`);
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

function mustExist(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function applyInstallCopies(root, variant) {
  const copies = [
    ['.env.example', '.env'],
    ['config/presets/no-llm.env', 'config/secrets.local.env'],
    ['config/profiles/devops.env.example', 'config/profiles/devops.env'],
    ['config/cover-letter.example.txt', 'config/cover-letter.txt'],
    ['config/cover-letter-style-examples.example.txt', 'config/cover-letter-style-examples.txt'],
    ['config/resume-routing.example.json', 'config/resume-routing.json'],
    ['config/resume-raise-schedule.example.json', 'config/resume-raise-schedule.json'],
    ['config/resume-variants.example.json', 'config/resume-variants.json'],
  ];
  for (const [src, dest] of copies) {
    const sp = path.join(root, src);
    const dp = path.join(root, dest);
    if (fs.existsSync(sp) && !fs.existsSync(dp)) {
      fs.mkdirSync(path.dirname(dp), { recursive: true });
      fs.copyFileSync(sp, dp);
    }
  }
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'CV'), { recursive: true });
  step(variant, 'portable-config', fs.existsSync(path.join(root, 'config/secrets.local.env')));
}

async function npmInstall(root, variant) {
  console.log(`\n[qa:clean-install] ${variant}: npm install (может занять 1–2 мин)…`);
  const npm = spawnSync('npm', ['install', '--ignore-scripts'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  return step(variant, 'npm-install', npm.status === 0);
}

async function playwrightInstall(root, variant) {
  if (skipPlaywright) {
    step(variant, 'playwright', true, 'skipped');
    return true;
  }
  console.log(`[qa:clean-install] ${variant}: playwright chromium…`);
  const pw = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  return step(variant, 'playwright', pw.status === 0);
}

async function runDashboardSmoke(root, variant) {
  let child = null;
  try {
    child = spawn(process.execPath, ['scripts/dashboard-server.mjs', '--queue-file=./docs/demo/vacancies-demo.json'], {
      cwd: root,
      stdio: 'ignore',
      env: { ...process.env, HH_VACANCIES_QUEUE_FILE: './docs/demo/vacancies-demo.json' },
    });
    await new Promise((r) => setTimeout(r, 2500));
    const up = await waitHttp('http://127.0.0.1:3849');
    step(variant, 'dashboard-up', up);

    if (up) {
      if (!skipPlaywright) {
        spawnSync('npx', ['playwright', 'install', 'chromium'], {
          cwd: root,
          stdio: 'ignore',
          shell: true,
        });
      }
      const ui = runNode(['scripts/test-dashboard-ui.mjs'], root, {
        DASHBOARD_URL: 'http://127.0.0.1:3849',
      });
      step(variant, 'dashboard-ui', ui.status === 0, ui.status !== 0 ? ui.stderr.slice(0, 300) : '');
    }
  } finally {
    if (child) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

async function runVariantA() {
  const variant = 'A';
  const OUT = path.join(ROOT, 'dist', 'qa-git-clone');
  console.log(`\n[qa:clean-install] вариант A (git clone simulation)\n`);

  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  copyRepoForQaClone(ROOT, OUT);
  step(variant, 'clone-copy', fs.existsSync(path.join(OUT, 'package.json')));

  for (const f of [
    'scripts/install.ps1',
    'scripts/install.sh',
    '.github/workflows/ci.yml',
    'docs/demo/vacancies-demo.json',
    'config/presets/no-llm.env',
  ]) {
    step(variant, `structure:${f}`, mustExist(OUT, f), mustExist(OUT, f) ? '' : 'missing');
  }

  if (!(await npmInstall(OUT, variant))) return false;
  if (!(await playwrightInstall(OUT, variant))) return false;

  applyInstallCopies(OUT, variant);

  const check = runNode(['scripts/setup-check.mjs'], OUT, { HH_QA_CLEAN: '1' });
  step(variant, 'setup-check', check.status === 0, check.status !== 0 ? check.stdout.split('\n').slice(-5).join(' ') : '');

  await runDashboardSmoke(OUT, variant);
  return byVariant[variant].every((s) => s.ok);
}

async function runVariantB() {
  const variant = 'B';
  const OUT = path.join(ROOT, 'dist', 'qa-clean-install');
  console.log(`\n[qa:clean-install] вариант B (portable zip simulation)\n`);

  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });

  const exp = runNode(['scripts/export-public.mjs', `--out=${OUT}`], ROOT);
  if (!step(variant, 'export', exp.status === 0, exp.status !== 0 ? exp.stderr.slice(0, 200) : '')) {
    return false;
  }

  for (const f of [
    'EXPORT-README.md',
    'scripts/install-portable.ps1',
    'start-dashboard.bat',
    'docs/demo/vacancies-demo.json',
    'config/presets/no-llm.env',
  ]) {
    step(variant, `structure:${f}`, mustExist(OUT, f), mustExist(OUT, f) ? '' : 'missing');
  }

  const readme = fs.readFileSync(path.join(OUT, 'EXPORT-README.md'), 'utf8');
  step(variant, 'readme-portable', /install-portable/i.test(readme));

  if (!(await npmInstall(OUT, variant))) return false;
  if (!(await playwrightInstall(OUT, variant))) return false;

  applyInstallCopies(OUT, variant);

  const check = runNode(['scripts/setup-check.mjs'], OUT, { HH_QA_CLEAN: '1' });
  step(variant, 'setup-check', check.status === 0, check.status !== 0 ? check.stdout.split('\n').slice(-5).join(' ') : '');

  await runDashboardSmoke(OUT, variant);
  return byVariant[variant].every((s) => s.ok);
}

async function main() {
  const variants = parseVariants();
  console.log(`[qa:clean-install] варианты: ${variants.join(' + ')}\n`);

  const results = {};
  for (const v of variants) {
    results[v] = v === 'A' ? await runVariantA() : await runVariantB();
  }

  const ok = Object.values(results).every(Boolean);
  writeReport(ok, results, variants);
  console.log(`\n[qa:clean-install] ${ok ? 'ВСЁ OK' : 'есть ошибки'} (${Math.round((Date.now() - started) / 1000)} с)`);
  for (const v of variants) {
    console.log(`  ${v}: ${results[v] ? 'OK' : 'FAIL'}`);
  }
  console.log(`  отчёт: ${REPORT}`);
  process.exit(ok ? 0 : 1);
}

function writeReport(ok, results, variants) {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(
    REPORT,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        variants: variants.map((v) => ({
          id: v,
          ok: results[v],
          steps: byVariant[v] || [],
        })),
        ok,
        durationSec: Math.round((Date.now() - started) / 1000),
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
