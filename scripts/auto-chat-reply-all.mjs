#!/usr/bin/env node
/**
 * Авто-ответы на все чаты «нужен ответ».
 *   npm run devops:auto-chat-reply
 *   npm run devops:auto-chat-reply -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { DATA_DIR } from '../lib/paths.mjs';
import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import { draftChatReply } from '../lib/chat-reply-draft.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const REQUEST_FILE = path.join(DATA_DIR, 'chat-send-request.json');

function needsReply(rec) {
  const s = rec?.hhApply?.chatSummary || {};
  return Boolean(s.needsReply || s.questionNeedsReply);
}

function runSendChat(id, text) {
  return new Promise((resolve, reject) => {
    fs.writeFileSync(REQUEST_FILE, `${JSON.stringify({ id, text }, null, 2)}\n`, 'utf8');
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'send-chat-reply.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, HH_HEADLESS: process.env.HH_HEADLESS || '1' },
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`send exit ${code}`))));
  });
}

async function main() {
  const records = loadQueue();
  const pending = records.filter(needsReply);
  console.log(`[auto-chat] нужен ответ: ${pending.length}`);
  if (!pending.length) return;

  for (const rec of pending) {
    const messages = rec.hhApply?.chatMessages || [];
    const draft = await draftChatReply({
      vacancyTitle: rec.title,
      company: rec.company,
      messages,
    });
    if (!draft.reply) {
      console.warn('[auto-chat] пустой черновик:', rec.id);
      continue;
    }
    updateVacancyRecord(rec.id, {
      hhApply: {
        ...rec.hhApply,
        chatReplyDraft: { reply: draft.reply, source: draft.source, at: new Date().toISOString() },
      },
    });
    console.log(`[auto-chat] ${rec.company}: ${draft.reply.slice(0, 80)}…`);
    if (dryRun) continue;
    try {
      await runSendChat(rec.id, draft.reply);
    } catch (e) {
      console.error('[auto-chat] ошибка отправки', rec.id, e.message || e);
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
