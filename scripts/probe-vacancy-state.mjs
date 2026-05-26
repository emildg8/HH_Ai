/**
 * Статус отклика на странице вакансии hh.ru (без отправки формы).
 *   node scripts/probe-vacancy-state.mjs --id=<uuid>
 *   node scripts/probe-vacancy-state.mjs --url=https://hh.ru/vacancy/...
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import {
  buildHhApplySiteStatePatch,
  detectHhVacancySiteState,
  hhSiteStateSkipReason,
} from '../lib/hh-vacancy-response-state.mjs';

const idArg = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5).trim();
const urlArg = (process.argv.find((a) => a.startsWith('--url=')) || '').slice(6).trim();
const writeStore = process.argv.includes('--write');
const stayOpen = process.argv.includes('--stay-open');

async function main() {
  let url = urlArg;
  let id = idArg;
  if (id && !url) {
    const rec = getVacancyRecord(id);
    if (!rec?.url) {
      console.error('Нет записи или url для id=', id);
      process.exit(1);
    }
    url = rec.url;
  }
  if (!url) {
    console.error('Укажите --id= или --url=');
    process.exit(1);
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля. npm run login');
    process.exit(1);
  }

  const launchOpts = { headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'probe-state' });
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    console.log('[probe-state] URL:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1200);
    await assertHhLoggedIn(page);

    const det = await detectHhVacancySiteState(page);
    console.log('[probe-state] detection:', JSON.stringify(det, null, 2));
    if (!det.canApply) {
      console.log('[probe-state] skip:', hhSiteStateSkipReason(det.state));
    }

    if (writeStore && id) {
      const rec = getVacancyRecord(id);
      const hhApply = buildHhApplySiteStatePatch(rec?.hhApply || {}, det);
      updateVacancyRecord(id, { hhApply });
      console.log('[probe-state] записано в карточку', id);
    }

    if (stayOpen) {
      console.log('Enter — закрыть');
      await new Promise((r) => process.stdin.once('data', r));
    }
  } finally {
    await closeContextSafe(ctx);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
