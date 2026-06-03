#!/usr/bin/env node
/**
 * Оформление бота: аватар, команды, кнопка Menu.
 *   npm run telegram:setup-ui
 */

import { loadEnv } from '../lib/load-env.mjs';
import { loadTelegramBotConfig } from '../lib/telegram-bot/config.mjs';
import { setupBotUi } from '../lib/telegram-bot/ui.mjs';

loadEnv();

async function main() {
  const cfg = loadTelegramBotConfig();
  if (!cfg.botToken) {
    console.error('[telegram:setup-ui] нужен TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }
  const results = await setupBotUi(cfg.botToken);
  for (const line of results) console.log(`[telegram:setup-ui] ${line}`);
  console.log('[telegram:setup-ui] готово — перезапустите Telegram или откройте чат заново');
}

main().catch((e) => {
  console.error('[telegram:setup-ui] fatal:', e.message || e);
  process.exit(1);
});
