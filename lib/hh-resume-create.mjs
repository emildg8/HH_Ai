/**
 * Создание резюме на hh.ru (мастер «Создать резюме» + копия существующего профиля).
 */

import { sleepJitter } from './hh-human-delay.mjs';
import {
  RESUME_LIST_URL,
  RESUME_CREATE_URL,
  RESUME_CREATE_BUTTON,
  resumeCardLink,
  RESUME_TITLE_INPUT,
} from './hh-resume-selectors.mjs';
import { listApplicantResumes } from './hh-resume-editor.mjs';

async function clickCreateResume(page) {
  await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1000);
  for (const sel of RESUME_CREATE_BUTTON) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 1200 }).catch(() => false)) {
      await loc.click();
      await page.waitForTimeout(2500);
      return true;
    }
  }
  await page.goto(RESUME_CREATE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(2000);
  return true;
}

/**
 * Мастер hh: «Создать резюме» → выбор «на основе существующего» если есть.
 * @param {import('playwright').Page} page
 * @param {{ newTitle: string, copyFromHash?: string, log?: (s:string)=>void }} opts
 */
export async function createResumeFromTemplate(page, opts) {
  const log = opts.log || (() => {});
  const before = await listApplicantResumes(page);
  await clickCreateResume(page);

  const copyBtn = page.getByRole('button', { name: /скопировать|на основе|из существующ|дублир/i }).first();
  const copyLink = page.getByRole('link', { name: /скопировать|на основе/i }).first();
  if (await copyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await copyBtn.click();
    log('[hh-resume-create] Режим копирования резюме');
    await page.waitForTimeout(1500);
  } else if (await copyLink.isVisible({ timeout: 1500 }).catch(() => false)) {
    await copyLink.click();
    await page.waitForTimeout(1500);
  }

  if (opts.copyFromHash) {
    const card = page.locator(resumeCardLink(opts.copyFromHash)).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(1000);
    }
  }

  for (const sel of RESUME_TITLE_INPUT) {
    const inp = page.locator(sel).first();
    if (await inp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inp.fill(opts.newTitle);
      break;
    }
  }

  const next = page.getByRole('button', { name: /далее|продолжить|сохранить|готово/i });
  for (let i = 0; i < 6; i++) {
    const btn = next.nth(i);
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1200);
    }
  }

  await page.waitForTimeout(2000);
  const after = await listApplicantResumes(page);
  const created = after.find(
    (r) =>
      !before.some((b) => b.hash === r.hash) &&
      r.title.toLowerCase().includes(opts.newTitle.toLowerCase().slice(0, 12))
  );
  const newest = after.filter((r) => !before.some((b) => b.hash === r.hash))[0];

  return {
    ok: Boolean(created || newest),
    hash: (created || newest)?.hash || '',
    title: (created || newest)?.title || opts.newTitle,
    beforeCount: before.length,
    afterCount: after.length,
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ titles: string[], sourceHash?: string, log?: (s:string)=>void }} opts
 */
export async function ensureResumeTitlesExist(page, opts) {
  const log = opts.log || (() => {});
  let existing = await listApplicantResumes(page);
  const sourceHash = opts.sourceHash || existing[0]?.hash;
  const results = [];

  for (const title of opts.titles) {
    const hit = existing.find((r) =>
      title.length > 5
        ? r.title.toLowerCase().includes(title.toLowerCase().slice(0, 12))
        : false
    );
    if (hit) {
      results.push({ title, hash: hit.hash, created: false });
      continue;
    }
    log(`[hh-resume-create] Создаём «${title}»…`);
    try {
      const r = await createResumeFromTemplate(page, {
        newTitle: title,
        copyFromHash: sourceHash,
        log,
      });
      results.push({ title, hash: r.hash, created: r.ok });
      if (r.hash) existing.push({ hash: r.hash, title: r.title || title });
    } catch (e) {
      results.push({ title, error: e.message, created: false });
    }
    await sleepJitter(page, 1000, 2000);
  }
  return results;
}
