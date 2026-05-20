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
  resolvePageAfterResponseClick,
} from '../lib/hh-response-modal.mjs';
import {
  collectBestQuestionnaire,
  prepareResponseWizardForQuestionnaire,
} from '../lib/hh-questionnaire-probe.mjs';
import { meaningfulQuestions } from '../lib/questionnaire-labels.mjs';
import { mergeQuestionnaire, prepareStoredQuestions } from '../lib/questionnaire-merge.mjs';
import { assertHhLoggedIn, isLoggedInOnHh } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';

const idArg = process.argv.find((a) => a.startsWith('--id='));
const recordId = idArg ? idArg.slice(5).trim() : '';

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
  const log = (msg) => console.log(msg);

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

    await prepareResponseWizardForQuestionnaire(page, log);
    const q = await collectBestQuestionnaire(page, { log });

    if (!q.detected || !q.questions?.length) {
      console.error(
        'Не удалось прочитать текст вопросов. На hh.ru пройдите шаги «Далее» до экрана с формулировками или откройте анкету вручную.'
      );
      process.exit(2);
    }

    const now = new Date().toISOString();
    const prev = rec.hhApply || {};
    const storedQuestions = prepareStoredQuestions(meaningfulQuestions(q.questions));
    const questionnaire = mergeQuestionnaire(prev.questionnaire || {}, {
      status: 'pending_manual',
      questions: storedQuestions,
      reasons: q.reasons,
      detectedAt: now,
      label: 'probe-questionnaire',
      probedAt: now,
      autoAttempted: false,
      needsProbe: false,
    });
    updateVacancyRecord(recordId, {
      hhApply: {
        ...prev,
        lastAt: now,
        responseSubmitted: prev.responseSubmitted ?? false,
        questionnaire,
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
