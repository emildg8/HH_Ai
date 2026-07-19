#!/usr/bin/env node
/**
 * Включить видимость резюме для HH-клиентов перед откликом.
 *   node scripts/devops-emil-fix-resume-visibility.mjs --hash=806e0f3a
 */
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { listApplicantResumes } from '../lib/hh-resume-editor.mjs';
import { showResumeVisibleToHhClients } from '../lib/hh-resume-visibility.mjs';

const hashArg = (process.argv.find((a) => a.startsWith('--hash=')) || '').slice(7).trim();

async function main() {
  if (!hashArg) {
    console.error('--hash= required');
    process.exit(1);
  }
  const headless = process.env.HH_HEADLESS !== '0';
  const ctx = await launchPersistentContextSafe(
    sessionProfilePath(),
    { headless, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' },
    { owner: 'resume-vis-fix' }
  );
  const page = ctx.pages()[0] || (await ctx.newPage());
  try {
    const listed = await listApplicantResumes(page);
    const row = listed.find((r) => r.hash?.startsWith(hashArg) || hashArg.startsWith(r.hash?.slice(0, 8)));
    if (!row?.hash) {
      console.error('resume not found in list:', listed.map((r) => `${r.hash?.slice(0, 8)} ${r.title}`).join('; '));
      process.exit(2);
    }
    console.log(`[fix-vis] ${row.title} (${row.hash.slice(0, 8)}…)`);
    const res = await showResumeVisibleToHhClients(page, row.hash, {
      verifyVacancyId: process.env.HH_VERIFY_VACANCY_ID || '133643774',
    });
    console.log(JSON.stringify(res, null, 2));
    if (!res.ok) process.exit(3);

    const verifyUrl = `https://hh.ru/applicant/vacancy_response?vacancyId=133643774&resumeId=${row.hash}&hhtmFrom=vacancy`;
    await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2000);
    const hints = ((await page.locator('body').innerText().catch(() => '')) || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /видимост|отклик|вопрос/i.test(l))
      .slice(0, 8);
    const submitDisabled = await page
      .locator('[data-qa="vacancy-response-submit-popup"]')
      .isDisabled()
      .catch(() => true);
    console.log(JSON.stringify({ verifyOnZtk: { hints, submitDisabled } }, null, 2));
  } finally {
    await closeContextSafe(ctx, 'resume-vis-fix');
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
