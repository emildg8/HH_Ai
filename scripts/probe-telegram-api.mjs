#!/usr/bin/env node
/**
 * Проверка доступа к Telegram Bot API.
 *   node scripts/probe-telegram-api.mjs
 *   node scripts/probe-telegram-api.mjs --base https://....workers.dev
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../lib/load-env.mjs';
import { telegramFetch } from '../lib/telegram-fetch.mjs';
import { getTelegramApiSecret } from '../lib/telegram-api-base.mjs';

loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  /** @type {{ base?: string, json?: boolean }} */
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) out.base = args[++i];
    if (args[i] === '--json') out.json = true;
  }
  return out;
}

/**
 * @param {string} baseUrl
 * @param {string} botToken
 * @param {string} [secret]
 */
export async function probeTelegramApi(baseUrl, botToken, secret = getTelegramApiSecret()) {
  const base = String(baseUrl || 'https://api.telegram.org').replace(/\/$/, '');
  const t0 = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Tg-Proxy-Secret'] = secret;

  const res = await telegramFetch(`${base}/bot${botToken}/getWebhookInfo`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const raw = await res.text();
  const ms = Date.now() - t0;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`invalid json (${res.status}): ${raw.slice(0, 120)}`);
  }
  if (!data.ok) {
    throw new Error(data.description || `HTTP ${res.status}`);
  }
  return { ok: true, base, ms, webhookUrl: data.result?.url || '' };
}

async function main() {
  const opts = parseArgs();
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('[probe-telegram-api] нужен TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }

  const base = opts.base || process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
  try {
    const r = await probeTelegramApi(base, token);
    if (opts.json) {
      console.log(JSON.stringify(r));
    } else {
      console.log(`[probe-telegram-api] OK ${r.base} (${r.ms} ms)`);
    }
    process.exit(0);
  } catch (e) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, base, error: String(e.message || e) }));
    } else {
      console.error(`[probe-telegram-api] FAIL ${base}: ${e.message || e}`);
    }
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((e) => {
    console.error('[probe-telegram-api] fatal:', e.message || e);
    process.exit(1);
  });
}
