/**
 * Проверка / установка Chromium для desktop (Tauri).
 *   node scripts/desktop-chromium.mjs --check
 *   node scripts/desktop-chromium.mjs --install
 *   npm run desktop:install-chromium
 */

import { spawnSync } from 'child_process';
import { ROOT } from '../lib/paths.mjs';
import { playwrightChromiumInstalled } from '../lib/playwright-launch.mjs';

const install = process.argv.includes('--install');

if (!install) {
  const ok = playwrightChromiumInstalled();
  process.stdout.write(ok ? 'installed\n' : 'missing\n');
  process.exit(ok ? 0 : 1);
}

if (playwrightChromiumInstalled()) {
  process.stdout.write('installed\n');
  process.exit(0);
}

const r = spawnSync('npx', ['playwright', 'install', 'chromium'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (r.status !== 0) {
  const err = (r.stderr || r.stdout || 'playwright install failed').trim();
  process.stderr.write(err.slice(0, 500) + '\n');
  process.exit(r.status ?? 1);
}

if (!playwrightChromiumInstalled()) {
  process.stderr.write('Chromium не найден после установки\n');
  process.exit(1);
}

process.stdout.write('installed\n');
