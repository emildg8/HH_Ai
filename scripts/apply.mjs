/**
 * Проверка сохранённой сессии: открывает раздел соискателя.
 * Использует общий lock/launch Chromium (как login и open-hh).
 *
 * Флаги:
 *   --stay-open  — не закрывать браузер, пока не нажмёте Enter в терминале.
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
  formatBrowserLaunchError,
  repairChromiumProfileCaches,
} from '../lib/chromium-session.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';

const stayOpen = process.argv.includes('--stay-open');
const headless = process.env.HH_HEADLESS === '1';

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
  if (!fs.existsSync(profile)) {
    console.error(
      'Профиль не найден. Сначала выполните: npm run login\nОжидалась папка:',
      profile
    );
    process.exit(1);
  }

  clearStaleBrowserLock();
  const lock = getBrowserLockInfo();
  if (lock.held) {
    console.warn(
      `Внимание: профиль может быть занят (${lock.owner}, pid=${lock.pid}). ` +
        'Остановите батч/сбор и закройте лишнее окно Chromium с data/session/chromium-profile.'
    );
  }

  const launchOpts = {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  let ctx;
  try {
    ctx = await launchPersistentContextSafe(profile, launchOpts, {
      owner: 'apply-check',
      retries: 4,
      skipMinimize: !headless,
      lockTimeoutMs: 60_000,
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/has been closed|process did exit/i.test(msg)) {
      const { removed } = repairChromiumProfileCaches(profile);
      console.warn(`[apply] Chromium не стартовал — сброшены кэши (${removed} каталогов), повтор…`);
      ctx = await launchPersistentContextSafe(profile, launchOpts, {
        owner: 'apply-check',
        retries: 4,
        skipMinimize: !headless,
        lockTimeoutMs: 60_000,
      });
    } else {
      throw e;
    }
  }

  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://hh.ru/applicant', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  try {
    await assertHhLoggedIn(page, {
      log: (s) => console.log('[apply]', s),
      captchaContext: 'проверка сессии',
    });
  } catch (e) {
    await closeContextSafe(ctx, 'apply-check');
    console.error(String(e?.message || e));
    console.error('Запустите: npm run login');
    process.exit(1);
  }

  console.log('Сессия активна. Текущий URL:', page.url());
  console.log(
    'Дальше: npm run dashboard — очередь и отклики; npm run open-hh — окно для капчи/входа.'
  );

  if (stayOpen) {
    await waitEnter('Нажмите Enter, чтобы закрыть браузер: ');
  }

  await closeContextSafe(ctx, 'apply-check');
}

main().catch((e) => {
  console.error(formatBrowserLaunchError(e));
  console.error(
    '\nЕсли браузер сразу закрылся: закройте окно автоматизации hh (профиль data/session), не рабочий Chrome. Затем: npm run login'
  );
  process.exit(1);
});
