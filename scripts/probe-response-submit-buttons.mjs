/**
 * Список кнопок на форме vacancy_response после заполнения анкеты.
 * node scripts/probe-response-submit-buttons.mjs --id=<recordId>
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { getVacancyRecord } from '../lib/store.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { assertHhLoggedIn, isLoggedInOnHh } from '../lib/hh-session-check.mjs';
import {
  openVacancyResponseFlow,
  resolvePageAfterResponseClick,
} from '../lib/hh-response-modal.mjs';
import { tryAutoFillEmployerQuestionnaireWithWizard } from '../lib/hh-questionnaire-auto.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { recordHasDashboardQuestionnaireAnswers } from '../lib/hh-questionnaire-auto.mjs';

const id = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5).trim();
const rec = getVacancyRecord(id);
if (!rec) {
  console.error('no record');
  process.exit(1);
}

const profile = sessionProfilePath();
const ctx = await launchPersistentContextSafe(
  profile,
  { headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' },
  { owner: 'probe-submit' }
);
let page = ctx.pages()[0] || (await ctx.newPage());

try {
  await page.goto(rec.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await assertHhLoggedIn(page);
  await openVacancyResponseFlow(page, { humanClicks: false, vacancyUrl: rec.url, vacancyId: rec.vacancyId });
  page = (await resolvePageAfterResponseClick(ctx, page)) || page;
  const cv = await loadCvBundle();
  if (recordHasDashboardQuestionnaireAnswers(rec)) {
    await tryAutoFillEmployerQuestionnaireWithWizard(page, { record: rec, cvText: cv.text || '', log: console.log });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const buttons = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, input[type="submit"], a[role="button"], [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      out.push({
        tag: el.tagName,
        text: text.slice(0, 80),
        qa: el.getAttribute('data-qa') || '',
        type: el.getAttribute('type') || '',
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        y: Math.round(r.y),
      });
    }
    return out.sort((a, b) => b.y - a.y).slice(0, 25);
  });

  console.log('url:', page.url());
  console.log('buttons (bottom first):');
  for (const b of buttons) {
    console.log(`  y=${b.y} [${b.tag}] disabled=${b.disabled} qa=${b.qa} "${b.text}"`);
  }
  await page.screenshot({ path: 'data/probe-submit-buttons.png', fullPage: true });
  console.log('screenshot: data/probe-submit-buttons.png');
} finally {
  await closeContextSafe(ctx, 'probe-submit');
}
