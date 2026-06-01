/**
 * Установить Telegram webhook на URL VPS.
 *   npm run remote:set-webhook
 *
 * .env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL, TELEGRAM_WEBHOOK_SECRET
 */

import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

async function main() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const url = String(process.env.TELEGRAM_WEBHOOK_URL || '').trim();
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!token || !url) {
    console.error('Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_URL в .env');
    process.exit(1);
  }

  const body = new URLSearchParams({ url });
  if (secret) body.set('secret_token', secret);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    body,
  });
  const data = await res.json();
  if (!data.ok) {
    console.error('setWebhook failed:', data);
    process.exit(1);
  }
  console.log('[remote:set-webhook] OK', url);

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
  console.log('[remote:set-webhook] info:', JSON.stringify(info.result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
