/**
 * Проверить, есть ли отклик на вакансию в переписке / на карточке.
 * node scripts/check-vacancy-applied.mjs --vacancyId=131991789
 */

import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { detectHhVacancySiteState } from '../lib/hh-vacancy-response-state.mjs';
import { isResponseAlreadySubmitted } from '../lib/hh-response-modal.mjs';

const vid = (process.argv.find((a) => a.startsWith('--vacancyId=')) || '').slice(12) || '131991789';
const profile = sessionProfilePath();
const ctx = await launchPersistentContextSafe(
  profile,
  { headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' },
  { owner: 'check-applied' }
);
const page = ctx.pages()[0] || (await ctx.newPage());

try {
  await page.goto(`https://hh.ru/vacancy/${vid}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await assertHhLoggedIn(page);
  const det = await detectHhVacancySiteState(page);
  const applied = await isResponseAlreadySubmitted(page);
  console.log('vacancy page:', { det, applied, url: page.url() });

  await page.goto('https://hh.ru/applicant/negotiations', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2000);
  const blob = await page.locator('body').innerText().catch(() => '');
  const hasVid = blob.includes(vid);
  const hasGear = /gear games|junior software development engineer in test/i.test(blob);
  console.log('negotiations:', { hasVid, hasGear, snippet: blob.slice(0, 500) });
} finally {
  await closeContextSafe(ctx, 'check-applied');
}
