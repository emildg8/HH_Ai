/**
 * Проверка окружения для desktop (Tauri 3.0).
 *   npm run desktop:check
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const desktopDir = path.join(ROOT, 'desktop', 'hh-ai-desktop');
const checks = [];

function pass(id, detail = '') {
  checks.push({ id, ok: true, detail });
  console.log(`  OK  ${id}${detail ? ` — ${detail}` : ''}`);
}

function fail(id, detail = '') {
  checks.push({ id, ok: false, detail });
  console.error(` FAIL ${id}${detail ? ` — ${detail}` : ''}`);
}

function cmdOk(bin, args = []) {
  const r = spawnSync(bin, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return r.status === 0 ? (r.stdout || r.stderr || '').trim() : null;
}

pass('node', process.version);

const cargo = cmdOk('cargo', ['--version']);
if (cargo) pass('rust/cargo', cargo);
else fail('rust/cargo', 'установите https://rustup.rs для сборки Tauri');

const tauriDir = path.join(desktopDir, 'src-tauri');
if (fs.existsSync(path.join(tauriDir, 'tauri.conf.json'))) pass('desktop/scaffold', desktopDir);
else fail('desktop/scaffold', 'нет src-tauri/tauri.conf.json');

const mainRs = path.join(tauriDir, 'src', 'main.rs');
if (fs.existsSync(mainRs)) {
  const src = fs.readFileSync(mainRs, 'utf8');
  if (/dashboard_up|check_dashboard|spawn_dashboard|DashboardSidecar/.test(src)) {
    pass('desktop/phase1-healthcheck');
  } else fail('desktop/phase1-healthcheck', 'нет проверки дашборда в main.rs');
  if (/spawn_dashboard_child|DashboardSidecar|start_dashboard_sidecar/.test(src)) {
    pass('desktop/phase2-sidecar');
  } else fail('desktop/phase2-sidecar', 'нет sidecar spawn в main.rs');
  if (/install_chromium|check_chromium|desktop-chromium/.test(src)) {
    pass('desktop/phase3-chromium');
  } else fail('desktop/phase3-chromium', 'нет install chromium в main.rs');
} else fail('desktop/phase1-healthcheck', 'нет main.rs');

const chromiumScript = path.join(ROOT, 'scripts', 'desktop-chromium.mjs');
if (fs.existsSync(chromiumScript)) pass('desktop/chromium-script');
else fail('desktop/chromium-script');

const r = spawnSync(process.execPath, ['--check', path.join(ROOT, 'scripts', 'dashboard-server.mjs')], {
  encoding: 'utf8',
});
if (r.status === 0) pass('dashboard-server');
else fail('dashboard-server');

console.log('\n[desktop:check] Interim: npm run desktop:launcher (браузер + дашборд)');
console.log('[desktop:check] Tauri: cd desktop/hh-ai-desktop && npm install && npm run tauri:dev');
console.log('  docs: docs/TAURI-PLAN.md');

const ok = checks.every((c) => c.ok);
process.exit(ok ? 0 : 1);
