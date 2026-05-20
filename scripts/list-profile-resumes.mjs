/**
 * Список резюме на hh.ru (название + hash для config/devops.env).
 *   node scripts/list-profile-resumes.mjs
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { assertHhLoggedIn, isLoggedInOnHh } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';

async function main() {
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля. npm run login');
    process.exit(1);
  }

  const ctx = await launchPersistentContextSafe(
    profile,
    { headless: true, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' },
    { owner: 'list-resumes' }
  );
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1500);
    if (!(await isLoggedInOnHh(page))) {
      console.error('Не залогинены. npm run login');
      process.exit(1);
    }
    await assertHhLoggedIn(page);

    const rows = await page.evaluate(() => {
      const out = [];
      const cards = document.querySelectorAll(
        '[data-qa="resume"], [data-qa^="resume-card"], a[href*="/resume/"]'
      );
      const seen = new Set();
      for (const el of cards) {
        const a = el.tagName === 'A' ? el : el.querySelector('a[href*="/resume/"]');
        const href = a?.getAttribute('href') || '';
        const m = href.match(/\/resume\/([a-f0-9]{16,})/i);
        if (!m || seen.has(m[1])) continue;
        seen.add(m[1]);
        const title =
          el.querySelector('[data-qa="resume-title"]')?.innerText?.trim() ||
          a?.innerText?.trim() ||
          el.innerText?.trim().slice(0, 120) ||
          '';
        out.push({ hash: m[1], title: title.replace(/\s+/g, ' ').trim() });
      }
      return out;
    });

    if (!rows.length) {
      console.error('Резюме не найдены на странице /applicant/resumes');
      process.exit(1);
    }

    const want = String(process.env.HH_PROFILE_RESUME_TITLE || 'DevOps').toLowerCase();
    console.log('Резюме на hh.ru:\n');
    for (const r of rows) {
      const mark =
        r.title.toLowerCase().includes(want) || want.includes(r.title.toLowerCase().slice(0, 6))
          ? '  ← подходит для HH_PROFILE_RESUME_TITLE'
          : '';
      console.log(`  ${r.title}`);
      console.log(`    HH_PROFILE_RESUME_HASH=${r.hash}${mark}\n`);
    }
    const cfgHash = String(process.env.HH_PROFILE_RESUME_HASH || '').trim();
    if (cfgHash) {
      const hit = rows.find((r) => r.hash === cfgHash);
      console.log(
        hit
          ? `Текущий hash в config → «${hit.title}»`
          : `В config задан hash ${cfgHash.slice(0, 8)}… — на странице не найден`
      );
    }
  } finally {
    await closeContextSafe(ctx, 'list-resumes');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
