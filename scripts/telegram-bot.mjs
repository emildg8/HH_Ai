#!/usr/bin/env node
/**
 * Telegram-бот управления HH Ai (long polling).
 *
 *   npm run telegram-bot
 *
 * .env: TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHAT_IDS или TELEGRAM_CHAT_ID
 * config/telegram-bot.json — опционально
 */

import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { loadTelegramBotConfig, readBotOffset, writeBotOffset } from '../lib/telegram-bot/config.mjs';
import { deleteWebhook, getUpdates, getWebhookInfo } from '../lib/telegram-bot/api.mjs';
import { handleTelegramUpdate } from '../lib/telegram-bot/router.mjs';
import { setupBotUi } from '../lib/telegram-bot/ui.mjs';
import { telegramAccessHint } from '../lib/telegram-api-base.mjs';
import { ensureTorRunning } from '../lib/tor-local.mjs';
import { acquireTelegramBotLock } from '../lib/telegram-bot/singleton.mjs';

loadEnv();
applyStoredProfile();

async function ensureTorIfConfigured() {
  const proxy = String(process.env.TELEGRAM_PROXY || '').trim();
  if (/127\.0\.0\.1:9050|:9050/.test(proxy)) {
    const ok = await ensureTorRunning();
    if (!ok) console.warn('[telegram-bot] Tor SOCKS :9050 не доступен');
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await ensureTorIfConfigured();
  const lock = acquireTelegramBotLock();
  if (!lock.ok) {
    console.error(`[telegram-bot] ${lock.error}`);
    process.exit(1);
  }
  const cfg = loadTelegramBotConfig();
  if (!cfg.botToken) {
    console.error('[telegram-bot] Задайте TELEGRAM_BOT_TOKEN в .env или secrets.local.env');
    process.exit(1);
  }
  if (!cfg.allowedChatIds.length && !cfg.allowedUserIds.length) {
    console.error(
      '[telegram-bot] Задайте TELEGRAM_ALLOWED_CHAT_IDS или TELEGRAM_CHAT_ID (whitelist chat_id)'
    );
    process.exit(1);
  }

  try {
    const hook = await getWebhookInfo(cfg.botToken);
    if (hook?.url) {
      console.log(`[telegram-bot] снимаю webhook (нужен polling): ${hook.url}`);
      await deleteWebhook(cfg.botToken);
    }
  } catch (e) {
    console.warn('[telegram-bot] webhook check:', e.message || e);
  }

  let offset = readBotOffset();
  console.log('[telegram-bot] polling… Ctrl+C для выхода');
  console.log(`[telegram-bot] разрешено chat_id: ${cfg.allowedChatIds.join(', ') || '—'}`);
  const accessHint = telegramAccessHint();
  if (accessHint) console.log(`[telegram-bot] ${accessHint}`);

  try {
    const ui = await setupBotUi(cfg.botToken, { skipPhoto: true });
    console.log(`[telegram-bot] UI: ${ui.filter((x) => !x.includes(':')).join(', ') || 'ok'}`);
  } catch (e) {
    console.warn('[telegram-bot] UI setup:', e.message || e);
  }

  while (true) {
    try {
      const updates = await getUpdates(cfg.botToken, offset, 25);
      for (const update of updates || []) {
        try {
          await handleTelegramUpdate(cfg, update);
          offset = update.update_id + 1;
          writeBotOffset(offset);
        } catch (e) {
          console.error('[telegram-bot] update error:', e.message || e);
          await sleep(2000);
          break;
        }
      }
    } catch (e) {
      console.error('[telegram-bot] poll error:', e.message || e);
      await sleep(Math.max(cfg.pollIntervalMs, 3000));
    }
  }
}

main().catch((e) => {
  console.error('[telegram-bot] fatal:', e.message || e);
  process.exit(1);
});
