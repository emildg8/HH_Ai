/**
 * Синхронизация статусов откликов с hh.ru → очередь + data/hh-negotiations-cache.json
 *   npm run devops:sync-responses
 *   npm run devops:sync-responses -- --dry-run
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import {
  scrapeHhNegotiationsList,
  saveNegotiationsCache,
  mergeNegotiationsIntoQueue,
} from '../lib/hh-negotiations-sync.mjs';
import { computeConversionStats } from '../lib/conversion-stats.mjs';
import { setSideJobPid } from '../lib/browser-guard.mjs';
import { assertBrowserFreeForSideJob } from '../lib/browser-guard.mjs';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  setSideJobPid('syncResponses', process.pid);
  try {
    assertBrowserFreeForSideJob('синхронизация откликов');
    const profile = sessionProfilePath();
    if (!fs.existsSync(profile)) {
      console.error('Нет профиля. npm run login');
      process.exit(1);
    }

    const launchOpts = {
      headless: process.env.HH_HEADLESS !== '0',
      viewport: { width: 1280, height: 900 },
      locale: 'ru-RU',
    };
    const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
    if (ch) launchOpts.channel = ch;

    const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'sync-responses' });
    const page = ctx.pages()[0] || (await ctx.newPage());

    try {
      await assertHhLoggedIn(page);
      const items = await scrapeHhNegotiationsList(page);
      console.log(`[sync-responses] Переписок/откликов на hh.ru: ${items.length}`);

      saveNegotiationsCache({ items });
      if (!dryRun) {
        try {
          const r = mergeNegotiationsIntoQueue({ items });
          console.log(`[sync-responses] Обновлено карточек в очереди: ${r.updated} / ${r.total}`);
        } catch (e) {
          console.warn('[sync-responses] Кэш сохранён, очередь не обновлена:', e.message);
          console.warn('Нажмите «Статусы в очередь» в дашборде или npm run devops:apply-negotiations-cache');
        }
      } else {
        console.log('[sync-responses] dry-run: кэш записан, очередь не тронута');
      }

      const stats = computeConversionStats();
      console.log('[sync-responses] Конверсия:', JSON.stringify(stats, null, 2));
    } finally {
      await closeContextSafe(ctx, 'sync-responses');
    }
  } finally {
    setSideJobPid('syncResponses', null);
  }
}

main().catch((e) => {
  setSideJobPid('syncResponses', null);
  console.error(e);
  process.exit(1);
});
