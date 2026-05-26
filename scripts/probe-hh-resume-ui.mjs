/**
 * Сканирование UI резюме hh.ru: список, просмотр, редактирование, дублирование.
 *   npm run devops:probe-resume-ui
 *   npm run devops:probe-resume-ui -- --stay-open
 *
 * Результат: data/hh-resume-probe.json
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath, DATA_DIR } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { listApplicantResumes, openResumeEditPage } from '../lib/hh-resume-editor.mjs';

const stayOpen = process.argv.includes('--stay-open');
const OUT = path.join(DATA_DIR, 'hh-resume-probe.json');

/**
 * @param {import('playwright').Page} page
 */
async function collectDomSnapshot(page, label) {
  return page.evaluate((lbl) => {
    const qas = [...document.querySelectorAll('[data-qa]')].map((el) => ({
      qa: el.getAttribute('data-qa'),
      tag: el.tagName,
      text: (el.innerText || '').trim().slice(0, 80),
    }));
    const buttons = [...document.querySelectorAll('button, a[role="button"], a.bloko-button, a[data-qa]')]
      .filter((el) => (el.innerText || '').trim().length > 0 && (el.innerText || '').length < 120)
      .slice(0, 80)
      .map((el) => ({
        tag: el.tagName,
        qa: el.getAttribute('data-qa'),
        href: el.getAttribute('href') || '',
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      }));
    const textareas = [...document.querySelectorAll('textarea, [contenteditable="true"]')].map((el) => ({
      qa: el.getAttribute('data-qa'),
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder') || '',
    }));
    return { label: lbl, url: location.href, qas: qas.slice(0, 120), buttons, textareas };
  }, label);
}

async function main() {
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('npm run login');
    process.exit(1);
  }

  const launchOpts = { headless: false, viewport: { width: 1400, height: 900 }, locale: 'ru-RU' };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const report = { at: new Date().toISOString(), pages: [], resumes: [], errors: [] };

  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'probe-resume' });
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await assertHhLoggedIn(page);

    report.resumes = await listApplicantResumes(page);
    console.log('[probe-resume] Резюме:', report.resumes.length);
    for (const r of report.resumes) console.log(' ', r.title, r.hash);

    report.pages.push(await collectDomSnapshot(page, 'applicant/resumes'));

    if (report.resumes[0]?.hash) {
      const hash = report.resumes[0].hash;
      await openResumeEditPage(page, hash);
      report.pages.push(await collectDomSnapshot(page, 'resume/view'));

      const editAbout = page.getByRole('button', { name: /о себе/i }).first();
      if (await editAbout.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editAbout.click();
        await page.waitForTimeout(1500);
        report.pages.push(await collectDomSnapshot(page, 'resume/edit-about'));
        await page.keyboard.press('Escape').catch(() => {});
      }

      const editExp = page.getByRole('button', { name: /опыт работы|обязанност|должност/i }).first();
      if (await editExp.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editExp.click();
        await page.waitForTimeout(1500);
        report.pages.push(await collectDomSnapshot(page, 'resume/edit-experience'));
      }
    }

    await page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1000);

    const createLink = page.getByRole('link', { name: /создать резюме|добавить резюме|новое резюме/i }).first();
    const dupBtn = page.getByRole('button', { name: /дублировать|копировать/i }).first();
    const createVisible = await createLink.isVisible({ timeout: 1500 }).catch(() => false);
    const dupVisible = await dupBtn.isVisible({ timeout: 800 }).catch(() => false);
    report.createResumeLinkVisible = createVisible;
    report.duplicateButtonVisible = dupVisible;

    if (createVisible) {
      const href = await createLink.getAttribute('href').catch(() => '');
      report.createResumeHref = href;
    }

    if (dupVisible) {
      await dupBtn.click();
      await page.waitForTimeout(2000);
      report.pages.push(await collectDomSnapshot(page, 'after-duplicate-click'));
    } else if (createVisible) {
      await createLink.click();
      await page.waitForTimeout(2500);
      report.pages.push(await collectDomSnapshot(page, 'create-resume-wizard'));
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('[probe-resume] Записано:', OUT);

    if (stayOpen) {
      console.log('Enter — закрыть');
      await new Promise((r) => process.stdin.once('data', r));
    }
  } catch (e) {
    report.errors.push(String(e.message || e));
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    throw e;
  } finally {
    await closeContextSafe(ctx, 'probe-resume');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
