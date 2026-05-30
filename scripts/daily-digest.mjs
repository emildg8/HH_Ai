/**
 * Вечерний дайджест: data/daily-digest-last.json + опционально Telegram.
 *   npm run devops:daily-digest
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { writeDailyDigest } from '../lib/daily-digest.mjs';

const sendTelegram = !process.argv.includes('--no-telegram');

async function main() {
  const result = await writeDailyDigest({ sendTelegram });
  console.log(result.text);
  console.log('\n[daily-digest] Записано:', result.file);
  if (result.telegram?.ok) console.log('[daily-digest] Telegram: отправлено');
  else if (result.telegram?.skipped) console.log('[daily-digest] Telegram: пропуск (нет token/chat_id)');
  else if (result.telegram?.error) console.warn('[daily-digest] Telegram:', result.telegram.error);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
