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
else if (process.env.HH_DESKTOP_REQUIRE_RUST === '1') {
  fail('rust/cargo', 'установите https://rustup.rs для сборки Tauri');
} else {
  pass('rust/cargo', 'optional — нужен для tauri:build');
}

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
  if (/show_teleprompter|toggle_teleprompter|teleprompter/.test(src)) {
    pass('desktop/teleprompter-overlay');
  } else fail('desktop/teleprompter-overlay', 'нет teleprompter в main.rs');
  if (/dock_teleprompter|meeting-window-rect/.test(src)) {
    pass('desktop/dock-above-meeting');
  } else fail('desktop/dock-above-meeting', 'нет dock_teleprompter в main.rs');
  if (/global_shortcut|tauri_plugin_global_shortcut/.test(src)) {
    pass('desktop/panic-shortcut');
  } else fail('desktop/panic-shortcut', 'нет Ctrl+Shift+H в main.rs');
  if (/start_copilot|stop_copilot|copilot-loopback/.test(src)) {
    pass('desktop/copilot-capture');
    if (/COPILOT_SCRIPT_ONLY|COPILOT_PREP_CONTEXT|COPILOT_WASAPI_DEVICE/.test(src)) {
      pass('desktop/copilot-env');
    } else fail('desktop/copilot-env', 'нет env passthrough в start_copilot');
  } else fail('desktop/copilot-capture', 'нет start_copilot в main.rs');
} else fail('desktop/phase1-healthcheck', 'нет main.rs');

const copilotScript = path.join(ROOT, 'scripts', 'copilot-loopback-capture.mjs');
if (fs.existsSync(copilotScript)) pass('desktop/copilot-script');
else fail('desktop/copilot-script');

for (const f of [
  'lib/interview-copilot-qa.mjs',
  'lib/candidate-context-bundle.mjs',
  'lib/interview-copilot-post.mjs',
  'scripts/copilot-simulate.mjs',
  'lib/interview-copilot-simulate-run.mjs',
  'scripts/fixtures/interview-transcript-mini.json',
  'scripts/meeting-window-rect.mjs',
  'dashboard/public/teleprompter-prep.html',
]) {
  if (fs.existsSync(path.join(ROOT, f))) pass(`copilot/${path.basename(f)}`);
  else fail(`copilot/${path.basename(f)}`, `нет ${f}`);
}

const chromiumScript = path.join(ROOT, 'scripts', 'desktop-chromium.mjs');
if (fs.existsSync(chromiumScript)) pass('desktop/chromium-script');
else fail('desktop/chromium-script');

const bundleScript = path.join(ROOT, 'scripts', 'desktop-bundle.mjs');
if (fs.existsSync(bundleScript)) pass('desktop/bundle-script');
else fail('desktop/bundle-script');

const icons = path.join(tauriDir, 'icons', 'icon.ico');
if (fs.existsSync(icons)) pass('desktop/icons');
else fail('desktop/icons', 'запустите scripts/make-app-icon.ps1 && tauri icon');

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
