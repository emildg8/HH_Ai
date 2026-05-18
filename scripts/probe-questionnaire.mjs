/**
 * Считать вопросы анкеты работодателя с hh.ru (без отправки отклика).
 *   node scripts/probe-questionnaire.mjs --id=<recordId>
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import {
  openVacancyResponseFlow,
  waitForVacancyResponseForm,
  resolvePageAfterResponseClick,
  advanceResponseWizardOneStep,
} from '../lib/hh-response-modal.mjs';
import { detectEmployerQuestionnaire } from '../lib/hh-employer-questionnaire.mjs';
import { meaningfulQuestions } from '../lib/questionnaire-labels.mjs';
import { assertHhLoggedIn, isLoggedInOnHh } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';

const idArg = process.argv.find((a) => a.startsWith('--id='));
const recordId = idArg ? idArg.slice(5).trim() : '';

async function collectBestQuestionnaire(page) {
  let best = { questions: [], reasons: [] };

  for (let step = 0; step < 14; step++) {
    const q = await detectEmployerQuestionnaire(page);
    const meaningful = meaningfulQuestions(q.questions);
    if (meaningful.length > best.questions.length) {
      best = { questions: meaningful, reasons: q.reasons || [] };
    }
    if (meaningful.length > 0) {
      const hasSubmit = await page
        .getByRole('button', { name: /отправить|откликнуться/i })
        .first()
        .isVisible({ timeout: 300 })
        .catch(() => false);
      if (hasSubmit && meaningful.length >= 1) break;
    }
    const moved = await advanceResponseWizardOneStep(page);
    if (!moved) break;
    await page.waitForTimeout(450);
  }

  return {
    detected: best.questions.length > 0,
    questions: best.questions,
    reasons: best.reasons,
  };
}

async function main() {
  if (!recordId) {
    console.error('Укажите --id=<recordId>');
    process.exit(1);
  }
  const rec = getVacancyRecord(recordId);
  if (!rec?.url) {
    console.error('Запись не найдена или нет url');
    process.exit(1);
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля. npm run login');
    process.exit(1);
  }

  const headless = process.env.HH_HEADLESS !== '0';
  const launchOpts = {
    headless,
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
  };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'probe-questionnaire' });
  let page = ctx.pages()[0] || (await ctx.newPage());

  try {
    console.log('[probe-questionnaire]', rec.title || rec.url);
    await page.goto(rec.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1200);

    if (!(await isLoggedInOnHh(page))) {
      console.error('Не залогинены. npm run login');
      process.exit(1);
    }
    await assertHhLoggedIn(page);

    await openVacancyResponseFlow(page, { humanClicks: false });
    page = (await resolvePageAfterResponseClick(ctx, page)) || page;

    const open = await waitForVacancyResponseForm(page, 22_000);
    if (!open) {
      console.error('Форма отклика не открылась');
      process.exit(1);
    }

    const q = await collectBestQuestionnaire(page);
    if (!q.detected || !q.questions?.length) {
      console.error(
        'Не удалось прочитать текст вопросов. Пройдите шаги «Далее» на hh.ru вручную или откройте анкету после отклика.'
      );
      process.exit(2);
    }

    const now = new Date().toISOString();
    const prev = rec.hhApply || {};
    updateVacancyRecord(recordId, {
      hhApply: {
        ...prev,
        lastAt: now,
        responseSubmitted: prev.responseSubmitted ?? false,
        questionnaire: {
          status: 'pending_manual',
          questions: q.questions,
          reasons: q.reasons,
          detectedAt: now,
          label: 'probe-questionnaire',
          probedAt: now,
          autoAttempted: false,
          suggestedAnswers: prev.questionnaire?.suggestedAnswers,
          savedAnswers: prev.questionnaire?.savedAnswers,
        },
      },
    });

    for (const item of q.questions) {
      console.log(`  ${item.index}. [${item.type}] ${item.label.slice(0, 160)}`);
    }
    console.log(`[probe-questionnaire] OK: ${q.questions.length} вопр. с текстом`);
  } finally {
    await closeContextSafe(ctx, 'probe-questionnaire');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
