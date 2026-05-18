/**
 * Диагностика сбора URL с выдачи hh.ru
 *   node scripts/probe-harvest-search.mjs [keyword]
 */

import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import fs from 'fs';
import path from 'path';
import { sessionProfilePath, DATA_DIR } from '../lib/paths.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { buildHhSearchText } from '../lib/hh-search.mjs';
import { parseHarvestPeriodDays, applySearchPeriodToParams } from '../lib/hh-search-period.mjs';

const args = process.argv.slice(2);
const plain = args.includes('--plain');
const keyword = args.find((a) => !a.startsWith('-')) || 'DevOps';

loadEnv();
loadDevOpsEnv();
if (plain) process.env.HH_SEARCH_EXCLUDE_TOKENS = '';

function buildSearchUrl(text) {
  const params = new URLSearchParams();
  params.set('text', buildHhSearchText(text));
  params.set('ored_clusters', 'true');
  const area = (process.env.HH_AREA || '').trim();
  if (area) params.set('area', area);
  applySearchPeriodToParams(params, parseHarvestPeriodDays(process.env.HH_SEARCH_PERIOD));
  const orderBy = (process.env.HH_SEARCH_ORDER_BY || 'publication_time').trim();
  if (orderBy) params.set('order_by', orderBy);
  return `https://hh.ru/search/vacancy?${params.toString()}`;
}

async function collectStats(page) {
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const ids = new Set();
    for (const a of document.querySelectorAll('a[href*="/vacancy/"]')) {
      const m = (a.href || '').match(/\/vacancy\/(\d+)/);
      if (m) ids.add(m[1]);
    }
    const text = document.body?.innerText || '';
    const foundRe = text.match(/Найдено\s+([\d\s\u00a0]+)\s+ваканс/i);
    return {
      title: document.title,
      url: location.href,
      linkCount: ids.size,
      foundLine: foundRe ? foundRe[0] : null,
      hasCaptcha: /captcha|подтвердите|робот/i.test(text),
      snippet: text.replace(/\s+/g, ' ').slice(0, 400),
    };
  });
}

async function main() {
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля. npm run login');
    process.exit(1);
  }
  const url = buildSearchUrl(keyword);
  console.log('[probe] keyword:', keyword);
  console.log('[probe] URL:', url);
  console.log('[probe] text:', buildHhSearchText(keyword));

  const headless = process.env.HH_HEADLESS !== '0';
  const ctx = await launchPersistentContextSafe(
    profile,
    { headless, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' },
    { owner: 'probe-harvest' }
  );
  const page = ctx.pages()[0] || (await ctx.newPage());
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    let stats = await collectStats(page);
    console.log('[probe] stats:', JSON.stringify(stats, null, 2));

    const shot = path.join(DATA_DIR, 'probe-harvest-search.png');
    await page.screenshot({ path: shot, fullPage: true });
    console.log('[probe] screenshot:', shot);
  } finally {
    await closeContextSafe(ctx, 'probe-harvest');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
