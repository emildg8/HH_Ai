/**
 * Открыть видимый Chromium с профилем hh (капча, вход, проверка сессии).
 * Окно не сворачивается; закрытие — Enter в терминале.
 *
 *   npm run open-hh
 *   npm run open-hh -- --url=https://hh.ru/vacancy/123
 */

import fs from 'fs';
import readline from 'readline';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import {
  launchPersistentContextSafe,
  closeContextSafe,
  clearStaleBrowserLock,
  getBrowserLockInfo,
  bringBrowserToFront,
  repairChromiumProfileCaches,
} from '../lib/chromium-session.mjs';

function waitEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function argUrl() {
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--url=')) return a.slice(6).trim();
  }
  return 'https://hh.ru/';
}

async function main() {
  const profile = sessionProfilePath();
  fs.mkdirSync(profile, { recursive: true });
  clearStaleBrowserLock();

  const lock = getBrowserLockInfo();
  if (lock.held) {
    console.warn(
      `Профиль может быть занят (${lock.owner}, pid=${lock.pid}). ` +
        'Остановите батч/дашборд-отклик и закройте окно Chromium hh-ru-apply.'
    );
  }

  const url = argUrl();
  console.log('[open-hh] Профиль:', profile);
  console.log('[open-hh] URL:', url);
  console.log('[open-hh] Решите капчу / войдите. Закрытие браузера — Enter в этом терминале.\n');

  const launchOpts = {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
  };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  let ctx;
  try {
    ctx = await launchPersistentContextSafe(profile, launchOpts, {
      owner: 'open-hh',
      retries: 5,
      skipMinimize: true,
      lockTimeoutMs: 60_000,
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (!/has been closed|process did exit/i.test(msg)) throw e;
    const { removed } = repairChromiumProfileCaches(profile);
    console.warn(`[open-hh] Профиль не стартовал — сброшены кэши (${removed} каталогов), повтор…`);
    ctx = await launchPersistentContextSafe(profile, launchOpts, {
      owner: 'open-hh',
      retries: 5,
      skipMinimize: true,
      lockTimeoutMs: 60_000,
    });
  }

  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 }).catch(() => {});
  const { ensureApplicantOnboardingDismissed } = await import('../lib/hh-applicant-onboarding.mjs');
  await ensureApplicantOnboardingDismissed(page, { log: (s) => console.log(s) });
  await bringBrowserToFront(ctx);

  await waitEnter('Готово — нажмите Enter (закрою Chromium и освобожу профиль для батча): ');
  await closeContextSafe(ctx, 'open-hh');
  console.log('[open-hh] Профиль сохранён.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
