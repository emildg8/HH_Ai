/**
 * Публикует ветку wispbyte-bot — только Telegram webhook (~50 KB), без всего монорепо.
 *   npm run remote:sync-wispbyte-bot
 *
 * Wispbyte: Repository URL тот же, Branch = wispbyte-bot
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'deploy', 'vdsina');
const BRANCH = 'wispbyte-bot';
const BRANCH_ALIASES = ['bot']; // Wispbyte UI обрезает имена веток (~11 символов)
const SKIP = new Set(['systemd', 'nginx', 'install-on-server.sh']);

function run(cmd, args, opts = {}) {
  const useShell = opts.shell ?? false;
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    shell: useShell,
    stdio: opts.silent ? 'pipe' : 'inherit',
  });
  if (r.status !== 0) {
    if (opts.silent && (r.stderr || r.stdout)) console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return r.stdout?.trim() || '';
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function writeBotExtras(dir) {
  fs.writeFileSync(
    path.join(dir, 'README.md'),
    `# HH Ai — Telegram bot (Wispbyte)

Только webhook. Исходник: \`deploy/vdsina/\` в основном репо.

Startup:
\`\`\`bash
pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-8080}
\`\`\`

Документация: docs/DEPLOY-WISPBYTE.md в репозитории HH_Ai.
`,
    'utf8',
  );
  fs.writeFileSync(path.join(dir, '.gitignore'), 'data/\n.env\n__pycache__/\n*.pyc\n', 'utf8');
  fs.writeFileSync(
    path.join(dir, '.env.example'),
    `# Wispbyte → Environment (не файл .env на диске)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ALLOWED_CHAT_IDS=
HH_REMOTE_API_TOKEN=
HH_VDSINA_DATA_DIR=./data
HH_DASHBOARD_PUBLIC_URL=http://127.0.0.1:3849
`,
    'utf8',
  );
}

function tryRun(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  });
  if (r.status !== 0) return null;
  return r.stdout?.trim() || '';
}

function resolvePushRemote() {
  const preferred = String(process.env.HH_GITHUB_REMOTE || '').trim();
  if (preferred) return preferred;
  for (const name of ['hh_ai', 'origin']) {
    const url = tryRun('git', ['remote', 'get-url', name]);
    if (url) return url;
  }
  console.error('[sync-wispbyte-bot] нет git remote (hh_ai или origin)');
  process.exit(1);
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('[sync-wispbyte-bot] нет deploy/vdsina/');
    process.exit(1);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-wispbyte-bot-'));
  copyTree(SRC, tmp);
  writeBotExtras(tmp);
  const remote = resolvePushRemote();

  run('git', ['init'], { cwd: tmp, silent: true });
  run('git', ['add', '-A'], { cwd: tmp, silent: true });
  const sha = run('git', ['rev-parse', '--short', 'HEAD'], { silent: true });
  run('git', ['commit', '-m', `sync-wispbyte-bot-from-${sha}`], { cwd: tmp, silent: true });
  run('git', ['branch', '-M', BRANCH], { cwd: tmp, silent: true });
  run('git', ['remote', 'add', 'origin', remote], { cwd: tmp, silent: true });
  const branches = [BRANCH, ...BRANCH_ALIASES];
  for (const name of branches) {
    if (name !== BRANCH) run('git', ['branch', '-f', name, BRANCH], { cwd: tmp, silent: true });
    run('git', ['push', 'origin', name, '--force'], { cwd: tmp });
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`[sync-wispbyte-bot] OK → ${remote} (${branches.join(', ')})`);
}

main();
