/**
 * Синхронизация чатов hh.ru → карточки очереди (вопросы / автоответы).
 *   npm run devops:sync-chats
 *   npm run devops:sync-chats -- --limit=5
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { scrapeChatsFromNegotiations } from '../lib/hh-chat-sync.mjs';
import { summarizeChatThread } from '../lib/chat-message-classify.mjs';
import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import { saveNegotiationsCache, loadNegotiationsCache } from '../lib/hh-negotiations-sync.mjs';
import { setSideJobPid, assertBrowserFreeForSideJob } from '../lib/browser-guard.mjs';

const limit = Math.max(
  1,
  Number((process.argv.find((a) => a.startsWith('--limit=')) || '').slice(8)) || 12
);

async function main() {
  setSideJobPid('syncChats', process.pid);
  try {
    assertBrowserFreeForSideJob('синхронизация чатов');
    const profile = sessionProfilePath();
    if (!fs.existsSync(profile)) {
      console.error('npm run login');
      process.exit(1);
    }

  const launchOpts = { headless: process.env.HH_HEADLESS !== '0', viewport: { width: 1280, height: 900 }, locale: 'ru-RU' };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'sync-chats' });
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await assertHhLoggedIn(page);
    const threads = await scrapeChatsFromNegotiations(page, limit);
    const cache = loadNegotiationsCache();
    cache.chatThreads = threads;
    saveNegotiationsCache(cache);

    const q = loadQueue();
    let updated = 0;
    for (const rec of q) {
      const thread = threads.find((t) => t.chatUrl && rec.hhApply?.chatUrl === t.chatUrl);
      if (!thread) continue;
      const summary = summarizeChatThread(thread.messages);
      updateVacancyRecord(rec.id, {
        hhApply: {
          ...(rec.hhApply || {}),
          chatMessages: thread.messages.slice(-20),
          chatSummary: summary,
          chatSyncedAt: thread.syncedAt,
        },
      });
      updated++;
    }
    console.log(`[sync-chats] Потоков: ${threads.length}, обновлено карточек: ${updated}`);
  } finally {
    await closeContextSafe(ctx, 'sync-chats');
  }
  } finally {
    setSideJobPid('syncChats', null);
  }
}

main().catch((e) => {
  setSideJobPid('syncChats', null);
  console.error(e);
  process.exit(1);
});
