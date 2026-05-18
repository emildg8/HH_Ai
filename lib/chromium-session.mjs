/**
 * Один Chromium-профиль — один процесс Playwright.
 * Иначе launchPersistentContext падает: «Target page, context or browser has been closed».
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { DATA_DIR } from './paths.mjs';

const LOCK_FILE = path.join(DATA_DIR, 'session', 'browser.lock');
const STALE_MS = 15 * 60 * 1000;

function readLock() {
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getBrowserLockInfo() {
  const lock = readLock();
  if (!lock) return { held: false };
  const alive = isPidAlive(lock.pid);
  const age = Date.now() - (lock.at || 0);
  const stale = !alive || age > STALE_MS;
  return {
    held: !stale,
    stale,
    owner: lock.owner || 'unknown',
    pid: lock.pid,
    at: lock.at,
    hint: stale
      ? null
      : 'Закройте другие окна Chromium с профилем hh-ru-apply или дождитесь завершения сбора/отклика.',
  };
}

/**
 * @param {string} owner — метка процесса (harvest, apply-chat, …)
 * @param {{ timeoutMs?: number }} opts
 */
export async function acquireBrowserLock(owner, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });

  while (Date.now() < deadline) {
    const info = getBrowserLockInfo();
    if (!info.held) {
      try {
        fs.writeFileSync(
          LOCK_FILE,
          JSON.stringify({ pid: process.pid, owner, at: Date.now() }),
          'utf8'
        );
        return;
      } catch {
        /* retry */
      }
    } else if (info.owner === owner && info.pid === process.pid) {
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const info = getBrowserLockInfo();
  throw new Error(
    `Профиль браузера занят (${info.owner || 'другой процесс'}, pid=${info.pid}). ` +
      `Закройте лишний Chromium с data/session/chromium-profile и повторите.`
  );
}

export function releaseBrowserLock(owner) {
  const lock = readLock();
  if (!lock) return;
  if (lock.pid === process.pid && (!owner || lock.owner === owner)) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      /* ignore */
    }
  }
}

/** Снять lock, если процесс уже не жив или запись устарела. */
export function clearStaleBrowserLock() {
  const info = getBrowserLockInfo();
  if (!info.held && readLock()) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      /* ignore */
    }
    return { cleared: true, reason: 'orphan-lock-file' };
  }
  if (info.stale) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      /* ignore */
    }
    return { cleared: true, reason: 'stale', previous: info };
  }
  return { cleared: false, info };
}

/** @param {unknown} err */
export function formatBrowserLaunchError(err) {
  const msg = String(err?.message || err);
  if (/Профиль браузера занят/i.test(msg)) return msg;
  if (/Target page, context or browser has been closed/i.test(msg)) {
    return (
      'Chromium закрылся сразу после запуска. Для сбора включите HH_HEADLESS=1 (в дашборде уже так по умолчанию). ' +
      'Для отклика с окном: закройте лишний Chrome, перезапустите дашборд. Если не помогло — npm run login заново.'
    );
  }
  if (/SingletonLock/i.test(msg)) {
    return (
      'Профиль Chromium уже открыт в другом процессе. Закройте лишние окна браузера с hh.ru и повторите сбор.'
    );
  }
  return msg;
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} [preferred]
 * @param {number} [timeoutMs]
 * @returns {Promise<import('playwright').Page|null>}
 */
export async function waitForActivePage(context, preferred, timeoutMs = 8000) {
  if (preferred && !preferred.isClosed()) return preferred;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const alive = context.pages().filter((p) => !p.isClosed());
    if (alive.length) return alive[alive.length - 1];
    const left = Math.max(200, deadline - Date.now());
    try {
      const p = await context.waitForEvent('page', { timeout: Math.min(1200, left) });
      if (p && !p.isClosed()) return p;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {number} ms
 */
export async function safePageWait(page, ms) {
  if (page.isClosed()) {
    const err = new Error('Target page, context or browser has been closed');
    err.code = 'PAGE_CLOSED';
    throw err;
  }
  try {
    await page.waitForTimeout(ms);
  } catch (e) {
    const msg = String(e?.message || e);
    if (/has been closed/i.test(msg)) {
      const err = new Error(msg);
      err.code = 'PAGE_CLOSED';
      throw err;
    }
    throw e;
  }
}

/**
 * @param {string} profile
 * @param {import('playwright').BrowserContextOptions} launchOpts
 * @param {{ owner: string, retries?: number }} meta
 */
/**
 * @param {string} profilePath
 */
export function prepareChromiumProfileForLaunch(profilePath) {
  clearStaleBrowserLock();
  const lockNames = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile'];
  for (const dir of [profilePath, path.join(profilePath, 'Default')]) {
    for (const name of lockNames) {
      const fp = path.join(dir, name);
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function launchPersistentContextSafe(profile, launchOpts, meta) {
  const owner = meta.owner || 'playwright';
  const retries = meta.retries ?? 3;
  await acquireBrowserLock(owner, { timeoutMs: meta.lockTimeoutMs ?? 120_000 });

  const mergedOpts = {
    ...launchOpts,
    args: [
      ...(launchOpts.args || []),
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
    ],
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    prepareChromiumProfileForLaunch(profile);
    try {
      const ctx = await chromium.launchPersistentContext(profile, mergedOpts);
      return ctx;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const retryable =
        /Target page, context or browser has been closed/i.test(msg) ||
        /process did exit/i.test(msg) ||
        /gracefully close/i.test(msg) ||
        /SingletonLock/i.test(msg);
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  releaseBrowserLock(owner);
  throw lastErr || new Error('Не удалось запустить Chromium');
}

export async function closeContextSafe(ctx, owner) {
  try {
    if (ctx) await ctx.close();
  } catch {
    /* ignore */
  } finally {
    releaseBrowserLock(owner);
  }
}
