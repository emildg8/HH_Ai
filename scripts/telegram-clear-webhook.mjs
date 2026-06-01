/**
 * Снять Telegram webhook (перед локальным polling).
 *   npm run telegram:clear-webhook
 */

import { loadEnv } from '../lib/load-env.mjs';
import { deleteWebhook, getWebhookInfo } from '../lib/telegram-bot/api.mjs';

loadEnv();

async function main() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('Нужен TELEGRAM_BOT_TOKEN в .env');
    process.exit(1);
  }
  const before = await getWebhookInfo(token);
  if (!before?.url) {
    console.log('[telegram:clear-webhook] webhook не установлен — polling можно запускать');
    return;
  }
  await deleteWebhook(token);
  const after = await getWebhookInfo(token);
  console.log('[telegram:clear-webhook] OK, было:', before.url);
  console.log('[telegram:clear-webhook] сейчас:', after?.url || '(нет)');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
