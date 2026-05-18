/**
 * Диагностика отклика: сессия, клик «Откликнуться», видна ли форма.
 *   node scripts/probe-vacancy-response.mjs [--url=...] [--stay-open]
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import {
  openVacancyResponseFlow,
  waitForVacancyResponseForm,
  resolvePageAfterResponseClick,
} from '../lib/hh-response-modal.mjs';
import { assertHhLoggedIn, isLoggedInOnHh } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';

const url =
  (process.argv.find((a) => a.startsWith('--url=')) || '').slice(6).trim() ||
  'https://hh.ru/vacancy/133197168';
const stayOpen = process.argv.includes('--stay-open');

async function main() {
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля. npm run login');
    process.exit(1);
  }

  const launchOpts = { headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'probe' });
  let page = ctx.pages()[0] || (await ctx.newPage());

  try {
    console.log('[probe] URL:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1500);

    const loggedIn = await isLoggedInOnHh(page);
    console.log('[probe] loggedIn:', loggedIn, 'pageUrl:', page.url());
    if (!loggedIn) {
      console.error('[probe] FAIL: не залогинены. npm run login');
      process.exit(1);
    }
    await assertHhLoggedIn(page);

    const btn = await openVacancyResponseFlow(page, { humanClicks: false });
    console.log('[probe] open:', btn);
    page = (await resolvePageAfterResponseClick(ctx, page)) || page;

    const open = await waitForVacancyResponseForm(page, 20_000);
    console.log('[probe] formOpen:', open, 'url:', page.url());

    const shot = 'data/probe-vacancy-response.png';
    await page.screenshot({ path: shot, fullPage: true });
    console.log('[probe] screenshot:', shot);

    if (!open) {
      console.error('[probe] FAIL: форма отклика не появилась');
      process.exit(1);
    }
    console.log('[probe] OK');
    if (stayOpen) {
      await new Promise((r) => {
        process.stdin.once('data', r);
      });
    }
  } finally {
    await closeContextSafe(ctx, 'probe');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
