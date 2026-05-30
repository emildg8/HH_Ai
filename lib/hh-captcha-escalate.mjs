/**
 * Экстренный переход headless → видимый Chromium (тот же профиль) для ручной капчи.
 */

import {
  launchPersistentContextSafe,
  closeContextSafe,
  bringBrowserToFront,
  waitForProfileChromiumExit,
  prepareChromiumProfileForLaunch,
} from './chromium-session.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} ctx
 * @param {{
 *   profile: string,
 *   owner: string,
 *   log?: (s: string) => void,
 *   launchBase?: import('playwright').BrowserContextOptions,
 * }} opts
 * @returns {Promise<{ ctx: import('playwright').BrowserContext, page: import('playwright').Page }>}
 */
export async function escalateHeadlessToVisibleBrowser(page, ctx, opts) {
  const log = opts.log || (() => {});
  const url = String(page.url() || '').trim();
  log('[hh-captcha] Экстренно: открываю видимый Chromium для проверки hh.ru…');

  // Важно: дать Windows/Playwright успеть отпустить профиль/процессы перед повторным launch.
  await closeContextSafe(ctx, opts.owner);
  const idle = await waitForProfileChromiumExit(opts.profile, 30_000, log);
  if (!idle) {
    log('[hh-captcha] Профиль ещё занят — ждём ещё 3 с перед повторным запуском…');
    await sleep(3000);
  } else {
    await sleep(800);
  }
  prepareChromiumProfileForLaunch(opts.profile);

  const launchOpts = {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
    ...(opts.launchBase || {}),
    args: [
      ...(opts.launchBase?.args || []),
      ...(process.platform === 'win32' ? ['--disable-gpu'] : []),
    ],
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const newCtx = await launchPersistentContextSafe(opts.profile, launchOpts, {
        owner: opts.owner,
        retries: 5,
        skipMinimize: true,
      });

      let newPage = newCtx.pages().find((p) => !p.isClosed()) || null;
      if (!newPage) newPage = await newCtx.newPage();

      if (url && !/^about:/i.test(url)) {
        await newPage
          .goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
          .catch(() => {});
      }

      await bringBrowserToFront(newCtx);
      return { ctx: newCtx, page: newPage };
    } catch (e) {
      lastErr = e;
      log(`[hh-captcha] Chromium не стартовал (attempt ${attempt}/5): ${e?.message || e}`);
      await sleep(900 + attempt * 700);
    }
  }
  throw lastErr || new Error('Не удалось открыть видимый Chromium для капчи');
}
