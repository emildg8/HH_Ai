/**
 * Проверка сохранённой сессии: открывает раздел соискателя.
 * Массовые отклики и селекторы форм — отдельная доработка (верстка hh.ru меняется).
 *
 * Флаги:
 *   --stay-open  — не закрывать браузер, пока не нажмёте Enter в терминале.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SESSION_DIR = process.env.HH_SESSION_DIR
  ? path.resolve(process.cwd(), process.env.HH_SESSION_DIR)
  : path.join(ROOT, 'data', 'session');
const PERSISTENT_PROFILE = path.join(SESSION_DIR, 'chromium-profile');

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

function looksLikeLoginUrl(url) {
  const u = url.toLowerCase();
  return u.includes('/account/login') || u.includes('oauth.hh.ru') || u.includes('/logon');
}

async function main() {
  if (!fs.existsSync(PERSISTENT_PROFILE)) {
    console.error(
      'Профиль не найден. Сначала выполните: npm run login\nОжидалась папка:',
      PERSISTENT_PROFILE
    );
    process.exit(1);
  }

  const ctx = await chromium.launchPersistentContext(PERSISTENT_PROFILE, {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  await page.goto('https://hh.ru/applicant', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await new Promise((r) => setTimeout(r, 1500));

  const url = page.url();
  if (looksLikeLoginUrl(url)) {
    await ctx.close();
    console.error('Сессия не активна (редирект на логин). Запустите: npm run login');
    process.exit(1);
  }

  console.log('Сессия активна. Текущий URL:', url);
  console.log(
    'Дальше сюда можно добавить переход к вакансиям и отправку отклика (селекторы уточнять вручную).'
  );

  if (stayOpen) {
    await waitEnter('Нажмите Enter, чтобы закрыть браузер: ');
  }

  await ctx.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
