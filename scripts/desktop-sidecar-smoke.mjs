/**
 * Smoke: sidecar-логика без Tauri (spawn dashboard + chromium check).
 *   npm run desktop:smoke
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const PORT = Number(process.env.DASHBOARD_PORT || 3849) || 3849;
const BASE = `http://127.0.0.1:${PORT}`;

/** @type {boolean[]} */
const results = [];

async function waitHttp(ms = 30_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function step(id, ok, detail = '') {
  results.push(ok);
  console.log(`  ${ok ? 'OK' : 'FAIL'}  ${id}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log('[desktop:smoke] sidecar + chromium\n');

  const mainRs = path.join(ROOT, 'desktop', 'hh-ai-desktop', 'src-tauri', 'src', 'main.rs');
  const src = fs.readFileSync(mainRs, 'utf8');
  step('sidecar-code', /spawn_dashboard_child/.test(src));
  step('chromium-code', /install_chromium|desktop-chromium/.test(src));

  const chromium = spawnSync(process.execPath, ['scripts/desktop-chromium.mjs', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  step('chromium-installed', chromium.status === 0, chromium.stdout?.trim() || 'missing');

  let child = null;
  try {
    child = spawn(
      process.execPath,
      ['scripts/dashboard-server.mjs', '--queue-file=./docs/demo/vacancies-demo.json'],
      {
        cwd: ROOT,
        stdio: 'ignore',
        env: { ...process.env, HH_VACANCIES_QUEUE_FILE: './docs/demo/vacancies-demo.json' },
      }
    );
    await new Promise((r) => setTimeout(r, 2000));
    const up = await waitHttp();
    step('dashboard-spawn', up, up ? BASE : 'timeout');
  } finally {
    if (child) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const ok = results.every(Boolean);
  console.log(`\n[desktop:smoke] ${ok ? 'ВСЁ OK' : 'есть ошибки'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
