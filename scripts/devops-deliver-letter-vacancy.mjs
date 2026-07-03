#!/usr/bin/env node
/**
 * Доставить approved-письмо в переписку после отклика без сопроводительного.
 *   node scripts/devops-deliver-letter-vacancy.mjs --id=<uuid>
 *
 * Канон (Индид 02.07): probe chatik → repair → assertLetterDeliveredOnHh → letterDelivered на карточке.
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { sessionProfilePath } from '../lib/paths.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { deliverCoverLetterPostApply } from '../lib/hh-chat-selectors.mjs';
import { buildHhApplyAfterSuccess } from '../lib/vacancy-hh-apply.mjs';
import {
  probeChatikBeforeLetterRepair,
  assertLetterDeliveredOnHh,
  resolveLetterDeliveredTruth,
} from '../lib/cover-letter-deliver-truth.mjs';

function resolveLetter(rec) {
  const approved = String(rec.coverLetter?.approvedText || '').trim();
  if (approved) return approved;
  const variants = rec.coverLetter?.variants;
  if (Array.isArray(variants) && variants[0]?.text) return String(variants[0].text).trim();
  return '';
}

const id = process.argv.find((a) => a.startsWith('--id='))?.slice(5)?.trim() || '';
if (!id) {
  console.error('Укажите --id=<uuid>');
  process.exit(1);
}

const rec = getVacancyRecord(id);
if (!rec) {
  console.error('Запись не найдена:', id);
  process.exit(1);
}

const letter = resolveLetter(rec);
if (!letter?.trim()) {
  console.error('Нет approved-письма на карточке');
  process.exit(1);
}

const vacancyId = String(rec.vacancyId || '').trim();
const log = (msg) => console.log(msg);

const ctx = await launchPersistentContextSafe(
  sessionProfilePath(),
  { headless: false, viewport: { width: 1400, height: 900 }, locale: 'ru-RU' },
  { owner: 'deliver-letter', skipMinimize: true }
);
const page = ctx.pages()[0] || (await ctx.newPage());

try {
  await page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await assertHhLoggedIn(page, { log, captchaContext: 'deliver-letter' });

  log(`[deliver-letter] ${rec.company} — ${rec.title}`);

  const probe = await probeChatikBeforeLetterRepair(page, { vacancyId, letter, log });
  if (probe.approvedInChatik) {
    log('[deliver-letter] Probe: approved-письмо уже в chatik — repair не нужен');
    const truth = await assertLetterDeliveredOnHh(page, letter);
    updateVacancyRecord(id, {
      status: 'responded',
      queuePruneReason: null,
      hhApply: buildHhApplyAfterSuccess(rec.hhApply || {}, {
        lastAt: new Date().toISOString(),
        responseSubmitted: true,
        hhDetectedOnly: false,
        letterDelivered: truth.letterDelivered,
        letterInForm: truth.letterInForm,
        chatSent: truth.chatSent,
        letterPreview: letter.replace(/\s+/g, ' ').trim().slice(0, 120),
        hhSiteState: 'already_applied',
        hhSiteStateLabel: 'Отклик с сопроводительным',
      }),
    });
    log('[deliver-letter] OK — карточка синхронизирована с chatik');
    return;
  }

  if (probe.hasResumeExcerptWithoutApproved) {
    log('[deliver-letter] Probe: в chatik excerpt резюме без approved — только форма «Приложить», не дубль в чат');
  }

  const method = await deliverCoverLetterPostApply(page, {
    text: letter,
    vacancyId,
    vacancyTitle: rec.title,
    company: rec.company,
    humanTyping: process.env.HH_FAST !== '1',
    log,
  });
  log(`[deliver-letter] Метод: ${method}`);

  const truth = await assertLetterDeliveredOnHh(page, letter);
  updateVacancyRecord(id, {
    status: 'responded',
    queuePruneReason: null,
    hhApply: buildHhApplyAfterSuccess(rec.hhApply || {}, {
      lastAt: new Date().toISOString(),
      responseSubmitted: true,
      hhDetectedOnly: false,
      letterDelivered: truth.letterDelivered,
      letterInForm: truth.letterInForm,
      chatSent: truth.chatSent,
      letterPreview: letter.replace(/\s+/g, ' ').trim().slice(0, 120),
      hhSiteState: 'already_applied',
      hhSiteStateLabel: 'Отклик с сопроводительным',
    }),
  });
  log('[deliver-letter] OK — карточка обновлена');
} catch (error) {
  const truth = await resolveLetterDeliveredTruth(page, letter).catch(() => ({
    letterDelivered: false,
    letterInForm: false,
    chatSent: false,
  }));
  updateVacancyRecord(id, {
    hhApply: buildHhApplyAfterSuccess(rec.hhApply || {}, {
      lastAt: new Date().toISOString(),
      letterDelivered: truth.letterDelivered,
      letterInForm: truth.letterInForm,
      chatSent: truth.chatSent,
    }),
  });
  throw error;
} finally {
  await closeContextSafe(ctx, 'deliver-letter');
}
