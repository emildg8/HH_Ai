/**
 * Один экземпляр telegram-bot (getUpdates conflict при двух процессах).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../paths.mjs';

const LOCK_FILE = path.join(DATA_DIR, 'telegram-bot.pid');

function isAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** @returns {{ ok: true } | { ok: false, error: string, pid?: number }} */
export function acquireTelegramBotLock() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const old = Number(JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')).pid);
      if (isAlive(old) && old !== process.pid) {
        return { ok: false, error: `Уже запущен telegram-bot (pid ${old})`, pid: old };
      }
    } catch {
      /* stale lock */
    }
  }
  fs.writeFileSync(
    LOCK_FILE,
    `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`,
    'utf8'
  );
  const cleanup = () => {
    try {
      const cur = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      if (Number(cur.pid) === process.pid) fs.unlinkSync(LOCK_FILE);
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  return { ok: true };
}
