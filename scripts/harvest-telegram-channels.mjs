#!/usr/bin/env node
/**
 * Ingest из Telegram-каналов @g_jobbot, EkleftJob
 */

import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import {
  DEFAULT_TELEGRAM_CHANNELS,
  ingestTelegramChannel,
} from '../lib/telegram-vacancy-ingest.mjs';

loadEnv();
applyStoredProfile();

const dryRun = process.argv.includes('--dry-run');
const channels = process.argv.includes('--channel')
  ? [process.argv[process.argv.indexOf('--channel') + 1]]
  : DEFAULT_TELEGRAM_CHANNELS;

async function main() {
  let added = 0;
  for (const ch of channels) {
    console.log(`[telegram] @${ch}`);
    if (dryRun) {
      const { fetchTelegramChannelHtml, extractUrlsFromTelegramHtml } = await import(
        '../lib/telegram-vacancy-ingest.mjs'
      );
      const html = await fetchTelegramChannelHtml(ch);
      const urls = extractUrlsFromTelegramHtml(html);
      console.log(`  urls: ${urls.length}`, urls.slice(0, 5));
      continue;
    }
    const r = await ingestTelegramChannel(ch);
    const n = r.results.filter((x) => x.added).length;
    added += n;
    console.log(`  found ${r.found}, added ${n}`);
  }
  console.log(`[telegram] всего добавлено: ${added}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
