/**
 * Первый вход: открывается Chromium с постоянным профилем в data/session/chromium-profile.
 * Войдите на hh.ru вручную, затем нажмите Enter в терминале — профиль сохранится для npm run apply.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { launchPersistentContextSafe, closeContextSafe, getBrowserLockInfo } from '../lib/chromium-session.mjs';

function waitEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const profile = sessionProfilePath();
  fs.mkdirSync(path.dirname(profile), { recursive: true });

  const lock = getBrowserLockInfo();
  if (lock.held) {
    console.warn(
      `Внимание: профиль может быть занят (${lock.owner}, pid=${lock.pid}). ` +
        'Закройте другие окна Chromium с data/session/chromium-profile.'
    );
  }

  const launchOpts = {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const ctx = await launchPersistentContextSafe(profile, launchOpts, {
    owner: 'login',
    retries: 4,
    lockTimeoutMs: 30_000,
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://hh.ru/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  await waitEnter(
    'Войдите в аккаунт hh.ru в открытом окне. Когда закончите, нажмите Enter здесь: '
  );

  await closeContextSafe(ctx, 'login');
  console.log('Профиль сохранён:', profile);
}

main().catch((e) => {
  console.error(e);
  console.error(
    '\nЕсли браузер сразу закрылся: закройте все окна с профилем hh-ru-apply и повторите npm run login.'
  );
  process.exit(1);
});
