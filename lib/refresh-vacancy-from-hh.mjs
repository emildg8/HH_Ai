import fs from 'fs';
import { chromium } from 'playwright';
import { sessionProfilePath } from './paths.mjs';
import { parseVacancyPage } from './vacancy-parse.mjs';

async function parseInPage(page, vacancyUrl) {
  await page.goto(vacancyUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  return parseVacancyPage(page);
}

function looksParsedOk(parsed) {
  const d = String(parsed?.description || '').trim();
  return d.length >= 80;
}

/**
 * Сначала отдельный Chromium без профиля (не держит lock на data/session — не конфликтует с открытым login).
 * Если описание пустое или ошибка — повтор с persistent-профилем (нужен npm run login).
 */
export async function fetchVacancyTextFromHh(vacancyUrl) {
  const headless = process.env.HH_HEADLESS !== '0';
  const forceSession = process.env.HH_VACANCY_REFRESH_USE_SESSION === '1';
  const channel = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();

  let lastErr = null;

  if (!forceSession) {
    let browser;
    try {
      const launchOpts = { headless };
      if (channel) launchOpts.channel = channel;
      browser = await chromium.launch(launchOpts);
      const context = await browser.newContext({
        locale: 'ru-RU',
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      try {
        const parsed = await parseInPage(page, vacancyUrl);
        if (looksParsedOk(parsed)) return parsed;
      } finally {
        await context.close();
      }
    } catch (e) {
      lastErr = e;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    throw new Error(
      lastErr?.message ||
        'Нет профиля Chromium (npm run login) и отдельный браузер не смог загрузить вакансию. Установите: npx playwright install chromium.'
    );
  }

  const persistentOpts = {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  };
  if (channel) persistentOpts.channel = channel;
  const ctx = await chromium.launchPersistentContext(profile, persistentOpts);
  try {
    const page = await ctx.newPage();
    const parsed = await parseInPage(page, vacancyUrl);
    if (!looksParsedOk(parsed)) {
      throw new Error(
        'Описание вакансии пустое. Обновите селекторы в lib/vacancy-parse.mjs или откройте URL вручную на hh.ru.'
      );
    }
    return parsed;
  } finally {
    await ctx.close();
  }
}
