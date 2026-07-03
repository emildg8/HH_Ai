/**
 * Apply Truth: доставка сопроводительного на hh (канон кейс Индид 02.07).
 * letterDelivered — только после live verify (форма или chatik).
 */

import {
  verifyCoverLetterDelivered,
  ensureVacancyResponseChatOpen,
  chatHasOutgoingExcerptWithoutApproved,
} from './hh-chat-selectors.mjs';
import { verifyCoverLetterInForm } from './hh-response-selectors.mjs';

/**
 * Перед letter-repair: открыть chatik на вакансии и снять снимок.
 * @param {import('playwright').Page} page
 * @param {{ vacancyId?: string, letter?: string, log?: (m: string) => void }} opts
 */
export async function probeChatikBeforeLetterRepair(page, opts = {}) {
  const vacancyId = String(opts.vacancyId || '').trim();
  const letter = String(opts.letter || '').trim();
  const log = typeof opts.log === 'function' ? opts.log : (m) => console.log(m);

  if (!vacancyId) {
    return { probed: false, reason: 'no-vacancy-id', approvedInChatik: false, needsRepair: false };
  }

  log(`[letter-repair-probe] vacancy/${vacancyId} → chatik`);
  await page.goto(`https://hh.ru/vacancy/${vacancyId}?hhtmFrom=negotiation_list`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);
  await ensureVacancyResponseChatOpen(page, { log, expectedText: letter });
  await page.waitForTimeout(1500);

  const approvedInChatik = letter ? await verifyCoverLetterDelivered(page, letter) : false;
  const hasResumeExcerpt =
    letter && !approvedInChatik ? await chatHasOutgoingExcerptWithoutApproved(page, letter) : false;

  log(
    `[letter-repair-probe] approvedInChatik=${approvedInChatik} resumeExcerptWithoutApproved=${hasResumeExcerpt}`
  );

  return {
    probed: true,
    vacancyId,
    approvedInChatik,
    hasResumeExcerptWithoutApproved: Boolean(hasResumeExcerpt),
    needsRepair: Boolean(letter && !approvedInChatik),
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} letter
 */
export async function resolveLetterDeliveredTruth(page, letter) {
  const text = String(letter || '').trim();
  if (!text) {
    return { letterDelivered: false, letterInForm: false, chatSent: false, verifySource: 'no-letter' };
  }

  const inForm = await verifyCoverLetterInForm(page, text).catch(() => false);
  if (inForm) {
    return { letterDelivered: true, letterInForm: true, chatSent: false, verifySource: 'form' };
  }

  const inChatik = await verifyCoverLetterDelivered(page, text);
  if (inChatik) {
    return { letterDelivered: true, letterInForm: false, chatSent: true, verifySource: 'chatik' };
  }

  return { letterDelivered: false, letterInForm: false, chatSent: false, verifySource: 'none' };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} letter
 */
export async function assertLetterDeliveredOnHh(page, letter) {
  const truth = await resolveLetterDeliveredTruth(page, letter);
  if (!truth.letterDelivered) {
    const err = new Error(
      `letterDelivered запрещён без live verify (источник: ${truth.verifySource || 'none'})`
    );
    err.code = 'LETTER_NOT_VERIFIED';
    throw err;
  }
  return truth;
}
