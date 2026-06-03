/**
 * Отправка ответа в чат hh.ru (одна карточка).
 *   npm run devops:send-chat-reply -- --id=RECORD_ID
 * Payload: data/chat-send-request.json (пишет дашборд).
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { DATA_DIR } from '../lib/paths.mjs';
import { sessionProfilePath } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { sendChatReplyInBrowser, buildChatSendPatch } from '../lib/chat-reply-send.mjs';
import { setSideJobPid, assertBrowserFreeForSideJob } from '../lib/browser-guard.mjs';

const REQUEST_FILE = path.join(DATA_DIR, 'chat-send-request.json');

async function main() {
  setSideJobPid('chatReplySend', process.pid);
  try {
    assertBrowserFreeForSideJob('отправка в чат');

    let payload = null;
    const idArg = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5);
    if (fs.existsSync(REQUEST_FILE)) {
      payload = JSON.parse(fs.readFileSync(REQUEST_FILE, 'utf8'));
    } else if (idArg) {
      payload = { id: idArg, text: process.env.HH_CHAT_SEND_TEXT || '' };
    }
    if (!payload?.id) {
      console.error('[send-chat-reply] Нет id в data/chat-send-request.json');
      process.exit(1);
    }

    const rec = getVacancyRecord(payload.id);
    if (!rec) {
      console.error('[send-chat-reply] Запись не найдена:', payload.id);
      process.exit(1);
    }

    const text = String(payload.text || rec.hhApply?.chatReplyDraft?.reply || '').trim();
    if (!text) {
      console.error('[send-chat-reply] Пустой текст');
      process.exit(1);
    }

    const profile = sessionProfilePath();
    if (!fs.existsSync(profile)) {
      console.error('npm run login');
      process.exit(1);
    }

    const launchOpts = {
      headless: process.env.HH_HEADLESS !== '0',
      viewport: { width: 1280, height: 900 },
      locale: 'ru-RU',
    };
    const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
    if (ch) launchOpts.channel = ch;

    const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'chat-reply-send' });
    const page = ctx.pages()[0] || (await ctx.newPage());

    try {
      await assertHhLoggedIn(page);
      await sendChatReplyInBrowser(page, rec, text, (m) => console.log(m));
      updateVacancyRecord(rec.id, buildChatSendPatch(rec, text));
      console.log(`[send-chat-reply] OK: ${rec.id}`);
    } finally {
      await closeContextSafe(ctx, 'chat-reply-send');
    }
  } finally {
    setSideJobPid('chatReplySend', null);
    try {
      fs.unlinkSync(REQUEST_FILE);
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  setSideJobPid('chatReplySend', null);
  console.error(e);
  process.exit(1);
});
