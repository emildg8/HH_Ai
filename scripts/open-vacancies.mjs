/**
 * Поиск по ключам из config/search-keywords.txt и открытие вакансий во вкладках Chromium.
 * Сессия — тот же persistent-профиль, что и у login/apply. Не параллельте с открытым npm run login.
 *
 * Флаги:
 *   --stay-open  — не закрывать браузер, пока не нажмёте Enter в терминале (по умолчанию без headless ждёт Enter).
 *
 * Переменные: HH_SESSION_LIMIT (или HH_MAX_TOTAL), HH_PER_KEYWORD_LIMIT, HH_OPEN_DELAY_MIN_MS,
 *   HH_OPEN_DELAY_MAX_MS, HH_SEARCH_JITTER_MIN_MS, HH_SEARCH_JITTER_MAX_MS, HH_KEYWORDS_FILE, HH_AREA, HH_HEADLESS,
 *   HH_GOTO_MAX_RETRIES, HH_GOTO_RETRY_BACKOFF_MIN_MS, HH_GOTO_RETRY_BACKOFF_MAX_MS,
 *   HH_MAX_OPEN_VACANCY_TABS — одновременно открытых вкладок с вакансиями (старые закрываются).
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import 'dotenv/config';
import { loadSearchKeywords } from '../lib/load-keywords.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SESSION_DIR = process.env.HH_SESSION_DIR
  ? path.resolve(process.cwd(), process.env.HH_SESSION_DIR)
  : path.join(ROOT, 'data', 'session');
const PERSISTENT_PROFILE = path.join(SESSION_DIR, 'chromium-profile');

const DEFAULT_KEYWORDS_FILE = path.join(ROOT, 'config', 'search-keywords.txt');

const headless = process.env.HH_HEADLESS === '1';
const stayOpen = process.argv.includes('--stay-open');

/** Максимум вакансий за один запуск (открытых вкладок). */
const MAX_VACANCIES_PER_RUN = 500;

const perKeyLimit = Math.min(
  MAX_VACANCIES_PER_RUN,
  Math.max(1, Number(process.env.HH_PER_KEYWORD_LIMIT || MAX_VACANCIES_PER_RUN) || MAX_VACANCIES_PER_RUN)
);
const sessionLimitRaw =
  process.env.HH_SESSION_LIMIT ?? process.env.HH_MAX_TOTAL ?? String(MAX_VACANCIES_PER_RUN);
const sessionLimit = Math.min(
  MAX_VACANCIES_PER_RUN,
  Math.max(1, Number(sessionLimitRaw) || MAX_VACANCIES_PER_RUN)
);

const openDelayMin = Math.max(0, Number(process.env.HH_OPEN_DELAY_MIN_MS || 3000) || 3000);
const openDelayMax = Math.max(openDelayMin, Number(process.env.HH_OPEN_DELAY_MAX_MS || 5000) || 5000);

const searchJitterMin = Math.max(0, Number(process.env.HH_SEARCH_JITTER_MIN_MS || 1000) || 1000);
const searchJitterMax = Math.max(searchJitterMin, Number(process.env.HH_SEARCH_JITTER_MAX_MS || 2000) || 2000);

const postLoadMin = Math.max(0, Number(process.env.HH_POST_LOAD_JITTER_MIN_MS || 200) || 200);
const postLoadMax = Math.max(postLoadMin, Number(process.env.HH_POST_LOAD_JITTER_MAX_MS || 800) || 800);

const gotoMaxRetries = Math.max(1, Number(process.env.HH_GOTO_MAX_RETRIES || 3) || 3);
const gotoRetryBackoffMin = Math.max(0, Number(process.env.HH_GOTO_RETRY_BACKOFF_MIN_MS || 2000) || 2000);
const gotoRetryBackoffMax = Math.max(
  gotoRetryBackoffMin,
  Number(process.env.HH_GOTO_RETRY_BACKOFF_MAX_MS || 6000) || 6000
);

const gotoDefaultOptions = { waitUntil: 'domcontentloaded', timeout: 60_000 };

/** Сколько вкладок с карточками вакансий держать открытыми; лишние закрываются с начала очереди. */
const maxOpenVacancyTabs = Math.max(1, Number(process.env.HH_MAX_OPEN_VACANCY_TABS || 10) || 10);

function randomIntInclusive(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableNavigationError(err) {
  const msg = String(err?.message ?? err);
  return /TIMED_OUT|timeout exceeded|Timeout \d+ms exceeded|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_ABORTED/i.test(
    msg
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 * @param {import('playwright').PageGotoOptions} [options]
 */
async function gotoWithRetry(page, url, options = {}) {
  const merged = { ...gotoDefaultOptions, ...options };
  let lastErr;
  for (let attempt = 1; attempt <= gotoMaxRetries; attempt++) {
    try {
      await page.goto(url, merged);
      return;
    } catch (e) {
      lastErr = e;
      const retriable = isRetriableNavigationError(e);
      if (!retriable || attempt === gotoMaxRetries) throw e;
      const wait = randomIntInclusive(gotoRetryBackoffMin, gotoRetryBackoffMax);
      console.warn(
        `Сеть/таймаут при goto (попытка ${attempt}/${gotoMaxRetries}), пауза ${wait} мс: ${String(e?.message ?? e)}`
      );
      await sleepMs(wait);
    }
  }
  throw lastErr;
}

const keywordsPath = path.resolve(
  process.cwd(),
  (process.env.HH_KEYWORDS_FILE || '').trim() || DEFAULT_KEYWORDS_FILE
);

function looksLikeLoginUrl(url) {
  const u = url.toLowerCase();
  return u.includes('/account/login') || u.includes('oauth.hh.ru') || u.includes('/logon');
}

function waitEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function buildSearchUrl(text) {
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('ored_clusters', 'true');
  const area = (process.env.HH_AREA || '').trim();
  if (area) params.set('area', area);
  return `https://hh.ru/search/vacancy?${params.toString()}`;
}

async function collectVacancyUrls(page) {
  await page.waitForTimeout(2000);
  return page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/vacancy/"]')) {
      const href = a.href || '';
      const m = href.match(/\/vacancy\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(`https://hh.ru/vacancy/${id}`);
    }
    return out;
  });
}

async function main() {
  if (!fs.existsSync(keywordsPath)) {
    console.error('Файл ключей не найден:', keywordsPath);
    process.exit(1);
  }

  const keywords = loadSearchKeywords(keywordsPath);
  if (!keywords.length) {
    console.error('В файле нет ни одного ключа:', keywordsPath);
    process.exit(1);
  }

  if (!fs.existsSync(PERSISTENT_PROFILE)) {
    console.error('Профиль не найден. Сначала: npm run login\n', PERSISTENT_PROFILE);
    process.exit(1);
  }

  const ctx = await chromium.launchPersistentContext(PERSISTENT_PROFILE, {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  });

  const searchPage = ctx.pages()[0] || (await ctx.newPage());

  try {
    await gotoWithRetry(searchPage, 'https://hh.ru/applicant');
    await searchPage.waitForTimeout(1500);
    if (looksLikeLoginUrl(searchPage.url())) {
      console.error('Сессия не активна. Выполните: npm run login');
      process.exit(1);
    }

    const globalSeen = new Set();
    const toOpen = [];

    for (const key of keywords) {
      if (toOpen.length >= sessionLimit) break;
      const url = buildSearchUrl(key);
      console.log('Поиск:', key, '→', url);
      try {
        await gotoWithRetry(searchPage, url);
      } catch (e) {
        console.error(`Не удалось открыть выдачу для «${key}» после ${gotoMaxRetries} попыток:`, e?.message ?? e);
        continue;
      }
      await sleepMs(randomIntInclusive(searchJitterMin, searchJitterMax));
      const found = await collectVacancyUrls(searchPage);
      let n = 0;
      for (const v of found) {
        if (toOpen.length >= sessionLimit) break;
        if (n >= perKeyLimit) break;
        const id = v.match(/\/vacancy\/(\d+)/)?.[1];
        if (!id || globalSeen.has(id)) continue;
        globalSeen.add(id);
        toOpen.push({ url: v, query: key });
        n++;
      }
      console.log(`  «${key}»: добавлено ${n} новых вакансий (всего в очереди ${toOpen.length})`);
    }

    if (!toOpen.length) {
      console.log('Нечего открыть — проверьте выдачу или селекторы.');
      return;
    }

    console.log(
      `Одновременно открытых вкладок с вакансиями не больше ${maxOpenVacancyTabs} — при лишних старые закрываются.`
    );

    const vacancyPages = [];
    let vacancyOpenedTotal = 0;
    for (let i = 0; i < toOpen.length; i++) {
      const { url, query } = toOpen[i];
      if (i > 0) {
        const pause = randomIntInclusive(openDelayMin, openDelayMax);
        console.log(`Пауза ${pause} мс перед следующей вакансией…`);
        await sleepMs(pause);
      }
      const p = await ctx.newPage();
      console.log('Открываю:', url, `(запрос: ${query})`);
      try {
        await gotoWithRetry(p, url);
        await sleepMs(randomIntInclusive(postLoadMin, postLoadMax));
        vacancyPages.push(p);
        vacancyOpenedTotal++;
        while (vacancyPages.length > maxOpenVacancyTabs) {
          const old = vacancyPages.shift();
          await old?.close().catch(() => {});
        }
      } catch (e) {
        console.error(
          `Пропуск вакансии после ${gotoMaxRetries} попыток:`,
          url,
          String(e?.message ?? e)
        );
        await p.close().catch(() => {});
      }
    }

    await searchPage.close().catch(() => {});

    console.log(
      `Вакансий успешно открыто за прогон: ${vacancyOpenedTotal}. Сейчас активно вкладок: ${vacancyPages.length}.`
    );

    const needWait = stayOpen || !headless;
    if (needWait) {
      await waitEnter('Нажмите Enter, чтобы закрыть браузер: ');
    }
  } finally {
    await ctx.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
