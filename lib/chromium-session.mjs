/**
 * Один Chromium-профиль — один процесс Playwright.
 * Иначе launchPersistentContext падает: «Target page, context or browser has been closed».
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';
import { DATA_DIR } from './paths.mjs';

const execFileAsync = promisify(execFile);

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
      : 'Закройте только окно Chromium с профилем hh-ru-apply (data/session/chromium-profile), не обычный Chrome для работы.',
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
      'Для отклика с окном: закройте окно автоматизации hh (профиль в data/session), не рабочий Chrome. Перезапустите дашборд или npm run login.'
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

/** Сброс кэшей/GPU — сессия hh.ru (Cookies) обычно сохраняется. */
export function repairChromiumProfileCaches(profilePath) {
  prepareChromiumProfileForLaunch(profilePath);
  const relPaths = [
    'BrowserMetrics',
    'Crashpad',
    'GrShaderCache',
    'GraphiteDawnCache',
    'ShaderCache',
    'GPUCache',
    path.join('Default', 'GPUCache'),
    path.join('Default', 'Code Cache'),
    path.join('Default', 'Cache'),
    path.join('Default', 'DawnGraphiteCache'),
    path.join('Default', 'DawnWebGPUCache'),
    path.join('Default', 'Service Worker'),
  ];
  let removed = 0;
  for (const rel of relPaths) {
    const fp = path.join(profilePath, rel);
    try {
      if (fs.existsSync(fp)) {
        fs.rmSync(fp, { recursive: true, force: true });
        removed++;
      }
    } catch {
      /* ignore */
    }
  }
  return { removed };
}

/** Свёрнутое окно при батче (капчу можно развернуть из панели задач). */
export function shouldLaunchBrowserInBackground() {
  if (process.env.HH_HEADLESS === '1') return false;
  if (String(process.env.HH_BROWSER_BACKGROUND || '').trim() === '0') return false;
  if (String(process.env.HH_BROWSER_BACKGROUND || '').trim() === '1') return true;
  return process.env.HH_BATCH === '1';
}

/** @returns {string[]} */
export function backgroundBrowserLaunchArgs() {
  if (!shouldLaunchBrowserInBackground()) return [];
  return ['--start-minimized'];
}

/**
 * На Windows --start-minimized не всегда срабатывает стабильно.
 * Дублируем сворачивание через CDP сразу после старта контекста.
 * @param {import('playwright').BrowserContext} ctx
 */
/** Вывести окно Chromium на передний план (после экстренного открытия при капче). */
export async function bringBrowserToFront(ctx) {
  try {
    let page = ctx.pages().find((p) => !p.isClosed()) || null;
    if (!page) {
      page = await ctx.newPage();
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {});
    }
    const session = await ctx.newCDPSession(page);
    const win = await session.send('Browser.getWindowForTarget');
    if (win?.windowId != null) {
      await session.send('Browser.setWindowBounds', {
        windowId: win.windowId,
        bounds: { windowState: 'normal' },
      });
    }
    await session.detach().catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Дождаться, пока Chrome с user-data-dir проекта не завершится (после close headless).
 * Только процессы с путём профиля в командной строке — не трогаем личный Chrome.
 * @param {string} profilePath
 * @param {number} [timeoutMs]
 * @param {(s: string) => void} [log]
 */
export async function waitForProfileChromiumExit(profilePath, timeoutMs = 20_000, log) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pids = await findChromePidsUsingProfile(profilePath);
    if (!pids.length) return true;
    log?.(`[chromium] ждём освобождения профиля (${pids.length} proc)…`);
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** @param {string} profilePath @returns {Promise<number[]>} */
async function findChromePidsUsingProfile(profilePath) {
  const resolved = path.resolve(profilePath);
  const needle = resolved.replace(/\\/g, '/').toLowerCase();
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*${needle.replace(/'/g, "''")}*' -or $_.CommandLine -like '*${resolved.replace(/\\/g, '\\\\').replace(/'/g, "''")}*') } | Select-Object -ExpandProperty ProcessId`,
        ],
        { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 }
      );
      return stdout
        .split(/\r?\n/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * CDP-сворачивание сразу после старта на Windows часто роняет Chromium (мигание и exit 2147483651).
 * По умолчанию только --start-minimized; CDP: HH_BROWSER_BACKGROUND_CDP=1
 */
async function enforceMinimizedWindow(ctx, { skip } = {}) {
  if (skip) return;
  if (process.platform !== 'win32') return;
  if (!shouldLaunchBrowserInBackground()) return;
  if (process.env.HH_HEADLESS === '1') return;
  if (String(process.env.HH_BROWSER_BACKGROUND_CDP || '').trim() !== '1') return;

  const delayMs = Math.max(500, parseInt(process.env.HH_BROWSER_MINIMIZE_DELAY_MS || '2500', 10) || 2500);
  await new Promise((r) => setTimeout(r, delayMs));

  try {
    let page = ctx.pages().find((p) => !p.isClosed()) || null;
    if (!page) return;
    const session = await ctx.newCDPSession(page);
    const win = await session.send('Browser.getWindowForTarget');
    if (win?.windowId != null) {
      await session.send('Browser.setWindowBounds', {
        windowId: win.windowId,
        bounds: { windowState: 'minimized' },
      });
    }
    await session.detach().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** channel только если явно задан HH_PLAYWRIGHT_CHANNEL (иначе bundled Chromium). */
export function mergePlaywrightLaunchOpts(launchOpts = {}) {
  const merged = { ...launchOpts };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) merged.channel = ch;
  return merged;
}

export async function launchPersistentContextSafe(profile, launchOpts, meta) {
  const owner = meta.owner || 'playwright';
  const retries = meta.retries ?? 3;
  await acquireBrowserLock(owner, { timeoutMs: meta.lockTimeoutMs ?? 120_000 });

  const extraArgs = ['--no-first-run', ...backgroundBrowserLaunchArgs()];
  const baseOpts = mergePlaywrightLaunchOpts(launchOpts);
  const isHeadlessLaunch = baseOpts.headless === true;
  const disableGpu =
    isHeadlessLaunch &&
    (process.env.HH_PLAYWRIGHT_DISABLE_GPU === '1' ||
      (process.platform === 'win32' && process.env.HH_PLAYWRIGHT_DISABLE_GPU !== '0'));
  if (disableGpu) {
    extraArgs.push('--disable-gpu', '--disable-software-rasterizer');
  }
  const mergedOpts = {
    ...baseOpts,
    args: [...(launchOpts.args || []), ...extraArgs],
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    prepareChromiumProfileForLaunch(profile);
    try {
      const ctx = await chromium.launchPersistentContext(profile, mergedOpts);
      if (meta.skipMinimize !== true) {
        enforceMinimizedWindow(ctx).catch(() => {});
      }
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
      if (attempt === 1 && /has been closed|process did exit/i.test(msg)) {
        repairChromiumProfileCaches(profile);
      }
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
