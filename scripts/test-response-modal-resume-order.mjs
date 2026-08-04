import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

import { completeVacancyResponseForm } from '../lib/hh-response-modal.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-response-resume-order-'));
const resumePdfPath = path.join(tmpDir, 'tailored-resume.pdf');
fs.writeFileSync(resumePdfPath, 'test resume');

const previousFast = process.env.HH_FAST;
const previousTitle = process.env.HH_PROFILE_RESUME_TITLE;
const previousHash = process.env.HH_PROFILE_RESUME_HASH;
process.env.HH_FAST = '1';
delete process.env.HH_PROFILE_RESUME_TITLE;
delete process.env.HH_PROFILE_RESUME_HASH;

const browser = await chromium.launch({ headless: true });

try {
  for (const hasFileInput of [true, false]) {
    const page = await browser.newPage();
    await page.route('https://hh.ru/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
          <main>
            <h1>Отклик на вакансию</h1>
            ${hasFileInput ? '<input type="file" aria-label="Резюме PDF">' : ''}
            <button type="submit" onclick="
              window.attachmentAtSubmit =
                document.querySelector('input[type=file]')?.files?.[0]?.name || '';
              window.submitted = true;
            ">Отправить отклик</button>
          </main>
        `,
      })
    );
    await page.goto('https://hh.ru/applicant/vacancy_response?vacancyId=123');

    const result = await completeVacancyResponseForm(page, {
      resumePdfPath,
      respectQuestionnaire: false,
      maxSteps: 3,
    });

    assert.equal(result.submitted, true);
    assert.equal(await page.evaluate(() => window.submitted), true);
    assert.equal(result.resumeAttached, hasFileInput);
    assert.equal(
      await page.evaluate(() => window.attachmentAtSubmit),
      hasFileInput ? path.basename(resumePdfPath) : '',
      hasFileInput
        ? 'tailored resume must be attached before submit'
        : 'forms without a file field must still submit with the profile resume'
    );
    await page.close();
  }

  console.log('test-response-modal-resume-order: OK');
} finally {
  await browser.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (previousFast === undefined) delete process.env.HH_FAST;
  else process.env.HH_FAST = previousFast;
  if (previousTitle === undefined) delete process.env.HH_PROFILE_RESUME_TITLE;
  else process.env.HH_PROFILE_RESUME_TITLE = previousTitle;
  if (previousHash === undefined) delete process.env.HH_PROFILE_RESUME_HASH;
  else process.env.HH_PROFILE_RESUME_HASH = previousHash;
}
