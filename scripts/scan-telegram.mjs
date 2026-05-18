/**
 * Поиск вакансий по ключевым словам в сохранённой сессии, краткий разбор карточек,
 * отправка в Telegram для ручного решения об отклике.
 *
 * Важно: один процесс = один Chromium с профилем. Не запускайте параллельно с открытым `npm run login`.
 *
 * Использование:
 *   npm run scan-tg -- golang разработчик   # слова из argv
 *   HH_KEYWORDS="go,микросервисы" npm run scan-tg
 *   npm run scan-tg -- --dry-run golang     # только консоль, без Telegram
 *
 * Переменные .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HH_SCAN_LIMIT, HH_PAUSE_MS, HH_AREA, HH_HEADLESS
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { buildHhSearchText } from '../lib/hh-search.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SESSION_DIR = process.env.HH_SESSION_DIR
  ? path.resolve(process.cwd(), process.env.HH_SESSION_DIR)
  : path.join(ROOT, 'data', 'session');
const PERSISTENT_PROFILE = path.join(SESSION_DIR, 'chromium-profile');

const headless = process.env.HH_HEADLESS === '1';
const dryRun = process.argv.includes('--dry-run');
const limit = Math.min(50, Math.max(1, Number(process.env.HH_SCAN_LIMIT || 10) || 10));
const pauseMs = Math.max(500, Number(process.env.HH_PAUSE_MS || 2500) || 2500);

function looksLikeLoginUrl(url) {
  const u = url.toLowerCase();
  return u.includes('/account/login') || u.includes('oauth.hh.ru') || u.includes('/logon');
}

function keywordsFromArgs() {
  const argv = process.argv.slice(2).filter((a) => a !== '--dry-run' && !a.startsWith('--'));
  if (argv.length) return argv.join(' ').trim();
  const raw = process.env.HH_KEYWORDS || '';
  const parts = raw
    .split(/[|,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(' ').trim();
}

function buildSearchUrl(text) {
  const params = new URLSearchParams();
  params.set('text', buildHhSearchText(text));
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

async function scrapeVacancyCard(page, vacancyUrl) {
  await page.goto(vacancyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const t = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ')?.trim() || '';
    const title = t('h1[data-qa="vacancy-title"]') || t('h1');
    const company =
      t('[data-qa="vacancy-company-name"]') ||
      t('a[data-qa="vacancy-company-name"]') ||
      t('[data-qa="vacancy-serp__vacancy-employer"]');
    const salary = t('[data-qa="vacancy-salary"]');
    let desc =
      t('[data-qa="vacancy-description"]') ||
      t('.vacancy-description') ||
      t('[itemprop="description"]');
    if (desc.length > 3500) desc = `${desc.slice(0, 3500)}…`;
    return { title, company, salary, desc };
  });
}

async function sendTelegram(botToken, chatId, text) {
  const cap = 3900;
  for (let i = 0; i < text.length; i += cap) {
    const chunk = text.slice(i, i + cap);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram ${res.status}: ${body}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function main() {
  const query = keywordsFromArgs();
  if (!query) {
    console.error(
      'Укажите ключевые слова: npm run scan-tg -- ваш запрос\nили HH_KEYWORDS в .env'
    );
    process.exit(1);
  }

  if (!dryRun && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
    console.error(
      'Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env, либо запуск с флагом --dry-run'
    );
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
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await page.goto('https://hh.ru/applicant', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    if (looksLikeLoginUrl(page.url())) {
      console.error('Сессия не активна. Выполните: npm run login');
      process.exit(1);
    }

    const searchUrl = buildSearchUrl(query);
    console.log('Поиск:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2000);

    let urls = await collectVacancyUrls(page);
    urls = urls.slice(0, limit);
    if (!urls.length) {
      console.log('Вакансии на первой странице не найдены (селекторы/выдача могли измениться).');
      return;
    }

    console.log(`Найдено ссылок (до лимита ${limit}):`, urls.length);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[${i + 1}/${urls.length}]`, url);
      let card;
      try {
        card = await scrapeVacancyCard(page, url);
      } catch (e) {
        console.error('  ошибка страницы:', e.message);
        continue;
      }

      const block = [
        `📌 ${card.title || '(без названия)'}`,
        card.company ? `🏢 ${card.company}` : null,
        card.salary ? `💰 ${card.salary}` : null,
        '',
        card.desc || '(описание не распознано — проверьте вёрстку hh.ru)',
        '',
        url,
      ]
        .filter(Boolean)
        .join('\n');

      if (dryRun) {
        console.log('---');
        console.log(block);
        console.log('---');
      } else {
        await sendTelegram(botToken, chatId, block);
      }

      await new Promise((r) => setTimeout(r, pauseMs));
    }

    if (!dryRun) {
      await sendTelegram(botToken, chatId, `Готово: отправлено ${urls.length} вакансий по запросу «${query}».`);
    }
    console.log('Готово.');
  } finally {
    await ctx.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
