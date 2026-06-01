#!/usr/bin/env node
/**
 * Автонастройка доступа к Telegram Bot API (бесплатно):
 *   1) прямой api.telegram.org
 *   2) Cloudflare WARP (winget)
 *   3) Cloudflare Worker прокси (бесплатный tier)
 *
 *   npm run telegram:setup-access
 */

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../lib/load-env.mjs';
import { upsertEnvVar } from '../lib/env-file.mjs';
import { ROOT } from '../lib/paths.mjs';
import { ensureTorRunning, torSocksUrl } from '../lib/tor-local.mjs';
import { resetTelegramFetchCache } from '../lib/telegram-fetch.mjs';
import { probeTelegramApi } from './probe-telegram-api.mjs';

loadEnv();

const ENV_PATH = path.join(ROOT, '.env');
const WORKER_DIR = path.join(ROOT, 'deploy', 'cf-telegram-proxy');
const CF_CONFIG_PATH = path.join(ROOT, 'config', 'telegram-cf-proxy.json');
const SETUP_STATE_PATH = path.join(ROOT, 'data', 'telegram-setup-state.json');
const DIRECT = 'https://api.telegram.org';

function log(msg) {
  console.log(`[telegram:setup] ${msg}`);
}

function readSetupState() {
  try {
    return JSON.parse(fs.readFileSync(SETUP_STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeSetupState(patch) {
  fs.mkdirSync(path.dirname(SETUP_STATE_PATH), { recursive: true });
  const next = { ...readSetupState(), ...patch };
  fs.writeFileSync(SETUP_STATE_PATH, JSON.stringify(next, null, 2), 'utf8');
}

function loadCfConfigFile() {
  if (!fs.existsSync(CF_CONFIG_PATH)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(CF_CONFIG_PATH, 'utf8'));
    const base = String(j.base || '').trim();
    const secret = String(j.secret || '').trim();
    if (!base) return null;
    return { mode: 'cf-worker-file', base, secret };
  } catch {
    return null;
  }
}

async function tryCfConfigFile(token) {
  const cfg = loadCfConfigFile();
  if (!cfg) return null;
  return tryProbe('cf-config', cfg.base, token, cfg.secret);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: true,
    stdio: opts.silent ? 'pipe' : 'inherit',
    cwd: opts.cwd,
    input: opts.input,
    env: { ...process.env, ...opts.env },
  });
  return r;
}

function findWarpCli() {
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Cloudflare', 'Cloudflare WARP', 'warp-cli.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Cloudflare WARP', 'warp-cli.exe'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

async function tryProbe(label, base, token, secret = '') {
  resetTelegramFetchCache();
  try {
    const r = await probeTelegramApi(base, token, secret);
    log(`OK (${label}): ${r.base} — ${r.ms} ms`);
    return { mode: label, base: r.base, secret };
  } catch (e) {
    log(`нет (${label}): ${e.message || e}`);
    return null;
  }
}

async function tryDirect(token) {
  return tryProbe('direct', DIRECT, token);
}

async function tryConfigured(token) {
  const base = String(process.env.TELEGRAM_API_BASE || '').trim();
  if (!base || base === DIRECT) return null;
  const secret = String(process.env.TELEGRAM_API_SECRET || '').trim();
  return tryProbe('configured', base, token, secret);
}

async function ensureWarpConnected() {
  const state = readSetupState();
  if (state.warpInstallFailed) {
    log('WARP: пропуск (ранее не установился — см. docs/TELEGRAM-BOT-ACCESS.md)');
    return false;
  }

  let cli = findWarpCli();
  if (!cli) {
    log('ставлю Cloudflare WARP (бесплатный VPN)...');
    run('winget', [
      'install',
      '-e',
      '--id',
      'Cloudflare.Warp',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ]);
    await sleep(5000);
    cli = findWarpCli();
  }
  if (!cli) {
    log('warp-cli не найден после установки');
    writeSetupState({ warpInstallFailed: true });
    return false;
  }

  run(cli, ['registration', 'new'], { silent: true });
  run(cli, ['connect']);
  await sleep(4000);
  const st = run(cli, ['status'], { silent: true });
  const out = `${st.stdout || ''}${st.stderr || ''}`;
  if (/Connected|Status update: Connected/i.test(out)) {
    log('WARP подключён');
    return true;
  }
  log(`WARP статус: ${out.trim().slice(0, 200) || '(пусто)'}`);
  return false;
}

function wrangler(args, opts = {}) {
  return run('npx', ['--yes', 'wrangler@3', ...args], { cwd: WORKER_DIR, ...opts });
}

function wranglerAuthed() {
  if (String(process.env.CLOUDFLARE_API_TOKEN || '').trim()) return true;
  const w = wrangler(['whoami'], { silent: true });
  return w.status === 0;
}

function ensureWranglerAuth() {
  if (wranglerAuthed()) return true;
  if (!process.stdin.isTTY) {
    log('Cloudflare: нужен CLOUDFLARE_API_TOKEN в .env или интерактивный wrangler login');
    return false;
  }
  log('Cloudflare: один раз войдите в браузере (OAuth)...');
  const login = wrangler(['login']);
  return login.status === 0;
}

async function tryTor(token) {
  log('Tor (бесплатный SOCKS5, без аккаунта)…');
  const up = await ensureTorRunning();
  if (!up) {
    log('Tor не поднялся за 3 мин');
    return null;
  }
  process.env.TELEGRAM_PROXY = torSocksUrl();
  return tryProbe('tor', DIRECT, token);
}

async function deployCfWorker() {
  if (!fs.existsSync(WORKER_DIR)) {
    log('нет deploy/cf-telegram-proxy');
    return null;
  }
  if (!ensureWranglerAuth()) {
    log('Cloudflare не авторизован — пропускаю Worker');
    return null;
  }

  const suffix = crypto.randomBytes(3).toString('hex');
  const workerName = `hh-ai-tg-${suffix}`;
  const tomlPath = path.join(WORKER_DIR, 'wrangler.toml');
  const toml = fs.readFileSync(tomlPath, 'utf8');
  fs.writeFileSync(tomlPath, toml.replace(/^name = .*$/m, `name = "${workerName}"`), 'utf8');

  const secret = crypto.randomBytes(24).toString('hex');
  log(`деploy Worker ${workerName}…`);
  const put = wrangler(['secret', 'put', 'PROXY_SECRET'], { input: `${secret}\n`, silent: true });
  if (put.status !== 0) {
    log(`secret put: ${(put.stderr || put.stdout || '').trim()}`);
    return null;
  }

  const dep = wrangler(['deploy'], { silent: true });
  const out = `${dep.stdout || ''}\n${dep.stderr || ''}`;
  if (dep.status !== 0) {
    log(`deploy fail: ${out.trim().slice(0, 400)}`);
    return null;
  }

  const match = out.match(/https:\/\/[^\s]+\.workers\.dev/i);
  const base = match ? match[0].replace(/\/$/, '') : `https://${workerName}.workers.dev`;
  log(`Worker: ${base}`);
  return { mode: 'cf-worker', base, secret };
}

function applyEnv(result) {
  if (result.mode === 'cf-worker' || result.mode === 'cf-worker-file' || result.mode === 'cf-config') {
    upsertEnvVar(
      ENV_PATH,
      'TELEGRAM_API_BASE',
      result.base,
      '# Cloudflare Worker → api.telegram.org'
    );
    if (result.secret) {
      upsertEnvVar(ENV_PATH, 'TELEGRAM_API_SECRET', result.secret, '# секрет CF Worker');
      process.env.TELEGRAM_API_SECRET = result.secret;
    }
    process.env.TELEGRAM_API_BASE = result.base;
    return;
  }

  if (result.mode === 'tor') {
    upsertEnvVar(
      ENV_PATH,
      'TELEGRAM_PROXY',
      torSocksUrl(),
      '# Tor SOCKS5 (бесплатно, npm run telegram:setup-access)'
    );
    upsertEnvVar(ENV_PATH, 'TELEGRAM_API_BASE', DIRECT, '# прямой Bot API через Tor');
    process.env.TELEGRAM_PROXY = torSocksUrl();
    process.env.TELEGRAM_API_BASE = DIRECT;
    return;
  }

  if (result.base && result.base !== DIRECT) {
    upsertEnvVar(
      ENV_PATH,
      'TELEGRAM_API_BASE',
      result.base,
      '# Cloudflare Worker → api.telegram.org (бесплатно, npm run telegram:setup-access)'
    );
  } else {
    upsertEnvVar(ENV_PATH, 'TELEGRAM_API_BASE', DIRECT, '# прямой доступ к Bot API');
  }

  if (result.secret) {
    upsertEnvVar(ENV_PATH, 'TELEGRAM_API_SECRET', result.secret, '# секрет CF Worker (X-Tg-Proxy-Secret)');
  }

  process.env.TELEGRAM_API_BASE = result.base || DIRECT;
  if (result.secret) process.env.TELEGRAM_API_SECRET = result.secret;
}

function installAutostart() {
  const ps1 = path.join(ROOT, 'scripts', 'install-telegram-bot-task.ps1');
  if (!fs.existsSync(ps1)) return;
  log('автозапуск при входе в Windows…');
  run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1]);
}

async function main() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('[telegram:setup] задайте TELEGRAM_BOT_TOKEN в .env');
    process.exit(1);
  }

  log('проверяю доступ к Bot API…');

  let result =
    (await tryConfigured(token)) ||
    (await tryCfConfigFile(token)) ||
    (await tryDirect(token));

  if (!result && (await ensureWarpConnected())) {
    result = await tryDirect(token);
  }

  if (!result) {
    result = await tryTor(token);
  }

  if (!result) {
    result = await deployCfWorker();
    if (result) {
      const ok = await tryProbe('cf-worker', result.base, token, result.secret);
      if (!ok) result = null;
    }
  }

  if (!result) {
    console.error(`
[telegram:setup] Не удалось настроить доступ автоматически.

Бесплатные варианты:
  A) GitHub Actions (рекомендуется, если Tor/WARP не качаются):
     1. https://dash.cloudflare.com → API Token (Edit Cloudflare Workers)
     2. GitHub repo → Settings → Secrets → CLOUDFLARE_API_TOKEN
     3. Actions → «Deploy CF Telegram proxy» → Run workflow
     4. Скопируйте TELEGRAM_API_BASE и TELEGRAM_API_SECRET из summary
        в .env или в config/telegram-cf-proxy.json
     5. Снова: npm run telegram:setup-access

  B) Локально: npx wrangler login && npm run telegram:setup-access
  C) Cloudflare WARP вручную + npm run telegram:setup-access

Документация: docs/TELEGRAM-BOT-ACCESS.md
`);
    process.exit(1);
  }

  applyEnv(result);
  installAutostart();

  log(`готово: режим «${result.mode}», base=${result.base || DIRECT}`);
  log('запуск бота: npm run telegram-bot');
  log('проверка: npm run telegram:probe-api');
}

main().catch((e) => {
  console.error('[telegram:setup] fatal:', e.message || e);
  process.exit(1);
});
