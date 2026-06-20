#!/usr/bin/env node
/**
 * Pre-release проверки перед тегом v*.*
 *   npm run verify:release
 *   npm run verify:release -- --skip-smoke   # без export/install smoke
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const skipSmoke = process.argv.includes('--skip-smoke');
const failures = [];

function run(label, args, opts = {}) {
  console.log(`\n[verify:release] ${label}…`);
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    ...opts,
  });
  if (r.status !== 0) failures.push(label);
  return r.status === 0;
}

function checkVersionSync() {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const tauri = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'desktop', 'hh-ai-desktop', 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  if (pkg.version !== ver) failures.push(`package.json (${pkg.version}) != VERSION (${ver})`);
  if (tauri.version !== ver) failures.push(`tauri.conf (${tauri.version}) != VERSION (${ver})`);
  if (!failures.length) console.log(`[verify:release] VERSION ${ver} OK`);
}

function checkBaselines() {
  const dir = path.join(ROOT, 'docs', 'screenshots', 'baseline');
  const needed = [
    '01-queue.png',
    '02-settings.png',
    '03-service-drawer.png',
    '04-chat-inbox.png',
    '05-funnel.png',
    '06-applied-view.png',
  ];
  for (const f of needed) {
    if (!fs.existsSync(path.join(dir, f))) failures.push(`baseline missing: ${f}`);
  }
  if (!failures.some((x) => x.startsWith('baseline'))) {
    console.log('[verify:release] screenshot baselines OK');
  }
}

console.log('[verify:release] HH Ai pre-tag checks\n');
checkVersionSync();
checkBaselines();

run('check:dashboard', ['scripts/check-dashboard-modules.mjs']);
run('test-demo-queue', ['scripts/test-demo-queue.mjs']);
run('gate-b', ['scripts/gate-b-check.mjs']);
run('test-dashboard-a11y', ['scripts/test-dashboard-a11y.mjs']);
run('test-chat-inbox-ui', ['scripts/test-chat-inbox-ui.mjs']);
run('test-dashboard-screenshots', ['scripts/test-dashboard-screenshots.mjs']);
run('quickstart:gate', ['scripts/quickstart-gate.mjs', '--skip-npm']);
run('test:copilot', ['scripts/test-copilot-gate.mjs']);
run('desktop:check', ['scripts/desktop-check.mjs']);

if (!skipSmoke) {
  run('smoke:release', ['scripts/smoke-release.mjs']);
} else {
  console.log('\n[verify:release] smoke:release skipped');
}

console.log('');
if (failures.length) {
  console.error(`[verify:release] FAIL (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[verify:release] ALL OK — можно тегировать: git tag v' + fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim());
