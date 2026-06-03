#!/usr/bin/env node
/**
 * North Star gate: portable export → install → demo queue → dashboard API.
 * Автоматический прокси D0→D4 (без login). Цель maintainer: ≤15 мин; human North Star: ≤45 мин.
 *
 *   npm run quickstart:gate
 *   npm run quickstart:gate -- --skip-npm
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const OUT = path.join(ROOT, 'dist', 'quickstart-gate');
const REPORT = path.join(ROOT, 'data', 'quickstart-gate-last.json');
const PORT = 3857;
const AUTOMATED_MAX_SEC = Number(process.env.QUICKSTART_GATE_MAX_SEC || 900);
const HUMAN_NORTH_STAR_MIN = 45;
const skipNpm = process.argv.includes('--skip-npm');
const started = Date.now();

function fail(msg) {
  console.error(`[quickstart:gate] FAIL: ${msg}`);
  process.exit(1);
}

function step(id, ok, detail = '') {
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`  ${mark}  ${id}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function writeReport(version, extra) {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(
    REPORT,
    `${JSON.stringify(
      {
        at: new Date().toISOString(),
        version,
        automatedMaxSec: AUTOMATED_MAX_SEC,
        humanNorthStarMin: HUMAN_NORTH_STAR_MIN,
        ...extra,
      },
      null,
      2
    )}\n`
  );
}

async function main() {
  console.log('[quickstart:gate] North Star proxy (portable B)\n');
  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  const exp = spawnSync(process.execPath, ['scripts/export-public.mjs', `--out=${OUT}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (!step('export', exp.status === 0)) fail('export-public');

  for (const f of [
    'docs/demo/vacancies-demo.json',
    'data/vacancies-queue.example.json',
    'scripts/install-portable.ps1',
    'EXPORT-README.md',
  ]) {
    step(`structure:${f}`, fs.existsSync(path.join(OUT, f)), fs.existsSync(path.join(OUT, f)) ? '' : 'missing');
  }

  if (skipNpm) {
    writeReport(version, { skippedNpm: true, ok: true });
    console.log('\n[quickstart:gate] structure OK (--skip-npm)');
    return;
  }

  console.log('\n[quickstart:gate] npm install…');
  const npm = spawnSync('npm', ['install', '--ignore-scripts'], { cwd: OUT, stdio: 'inherit', shell: true });
  if (!step('npm-install', npm.status === 0)) fail('npm install');

  const act = spawnSync(process.execPath, ['scripts/smoke-activation-check.mjs', OUT, String(PORT)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (!step('dashboard-api', act.status === 0)) fail('activation check');

  const check = spawnSync(process.execPath, ['scripts/setup-check.mjs'], {
    cwd: OUT,
    env: { ...process.env, HH_QA_CLEAN: '1' },
    encoding: 'utf8',
  });
  step('setup-check', check.status === 0);
  if (check.status !== 0) fail('setup-check');

  const durationSec = Math.round((Date.now() - started) / 1000);
  const ok = durationSec <= AUTOMATED_MAX_SEC;
  step(
    'time-budget',
    ok,
    `${durationSec}s (max ${AUTOMATED_MAX_SEC}s automated; human target ${HUMAN_NORTH_STAR_MIN} min)`
  );
  writeReport(version, { ok, durationSec, humanNorthStarMin: HUMAN_NORTH_STAR_MIN });
  if (!ok) fail(`automated path > ${AUTOMATED_MAX_SEC}s`);
  console.log(`\n[quickstart:gate] PASSED (${durationSec}s) → ${REPORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
