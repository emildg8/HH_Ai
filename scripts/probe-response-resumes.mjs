/**
 * Какие резюме hh.ru показывает в форме отклика + какой выбор сделает picker.
 *   npm run devops:probe-response-resumes -- --id=<uuid>
 *   npm run devops:probe-response-resumes -- --url=https://hh.ru/vacancy/... --stay-open
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { getVacancyRecord } from '../lib/store.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { openVacancyResponseFlow } from '../lib/hh-response-modal.mjs';
import { listResponseFormResumes } from '../lib/hh-resume-upload.mjs';
import { pickBestFromEmployerList, dedupeEmployerResumes } from '../lib/hh-resume-picker.mjs';
import { resolveResumeForVacancy } from '../lib/resume-routing.mjs';
import { detectHhVacancySiteState } from '../lib/hh-vacancy-response-state.mjs';

const idArg = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5).trim();
const urlArg = (process.argv.find((a) => a.startsWith('--url=')) || '').slice(6).trim();
const stayOpen = process.argv.includes('--stay-open');

async function main() {
  let rec = idArg ? getVacancyRecord(idArg) : null;
  const url = urlArg || rec?.url;
  if (!url) {
    console.error('Укажите --id= или --url=');
    process.exit(1);
  }
  if (!rec) rec = { id: 'probe', title: 'probe', url };

  const routing = resolveResumeForVacancy(rec);
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля. npm run login');
    process.exit(1);
  }

  const ctx = await launchPersistentContextSafe(
    profile,
    { headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' },
    { owner: 'probe-resumes' }
  );
  const pages = ctx.pages();
  for (let i = 1; i < pages.length; i++) await pages[i].close().catch(() => {});
  const page = pages[0] && !pages[0].isClosed() ? pages[0] : await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1200);
    await assertHhLoggedIn(page);

    const site = await detectHhVacancySiteState(page);
    console.log('\n[probe-resumes] Статус на странице вакансии:', site);

    const open = await openVacancyResponseFlow(page, {
      vacancyUrl: url,
      vacancyId: rec.vacancyId,
      resumeHash: routing.hash,
      preferredResumeTitle: routing.title,
      log: (m) => console.log(m),
    });
    console.log('[probe-resumes] open:', open, 'url:', page.url());

    const available = dedupeEmployerResumes(await listResponseFormResumes(page));
    console.log('\n[probe-resumes] Routing:', routing);
    console.log('[probe-resumes] Список на hh.ru:');
    for (const a of available) {
      console.log(`  · ${a.title}  hash=${a.hash || '—'}`);
    }

    const decision = pickBestFromEmployerList(available, routing.role);
    console.log('\n[probe-resumes] Решение picker:', decision);

    if (stayOpen) {
      console.log('\nEnter — закрыть');
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
