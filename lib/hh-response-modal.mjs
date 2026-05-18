/**
 * Мастер отклика hh.ru: выбор резюме, «Далее», отправка.
 * Один цикл вместо разрозненных prepare → fill → submit.
 */

import { clickVacancyResponseButton } from './hh-response-selectors.mjs';
import {
  expandCoverLetterSectionIfPresent,
  fillCoverLetterFieldIfPresent,
} from './hh-response-selectors.mjs';
import {
  attachResumePdfInResponseModal,
  ensurePreferredProfileResume,
} from './hh-resume-upload.mjs';
import { waitForActivePage } from './chromium-session.mjs';
import { assertHhLoggedIn, looksLikeLoginUrl } from './hh-session-check.mjs';
import { vacancyIdFromUrl } from './vacancy-parse.mjs';
import {
  detectEmployerQuestionnaire,
  waitAndDetectQuestionnaireAfterAction,
} from './hh-employer-questionnaire.mjs';
import { tryAutoFillEmployerQuestionnaire } from './hh-questionnaire-auto.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {object} opts
 * @param {(msg: string) => void} log
 * @param {string} label
 * @returns {Promise<'continue'|'stop'|null>}
 */
async function handleQuestionnaireOnPage(page, opts, log, label) {
  const qCheck = await detectEmployerQuestionnaire(page);
  if (!qCheck.detected) return null;

  if (opts.questionnaireAuto && opts.record && opts.cvText) {
    const auto = await tryAutoFillEmployerQuestionnaire(page, {
      record: opts.record,
      cvText: opts.cvText,
      log,
    });
    if (auto.ok) return 'continue';
    log(`[hh-response-modal] Авто-анкета (${label}): переход к ручному режиму или стоп`);
  }

  return 'stop';
}

/** @param {import('playwright').Page} page */
async function questionnaireOrStillOpen(page) {
  const q = await detectEmployerQuestionnaire(page);
  if (q.detected) return { questionnaire: q };
  if (await isVacancyResponseFormOpen(page)) {
    return { stillOpen: true };
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 */
async function dismissCookieBanner(page) {
  const names = [/понятно/i, /принять/i, /согласен/i, /ok/i];
  for (const re of names) {
    const b = page.getByRole('button', { name: re }).first();
    if (await b.isVisible({ timeout: 400 }).catch(() => false)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(300);
      return;
    }
  }
}

/**
 * Видимая ссылка «Откликнуться» (не скрытый дубликат в DOM).
 * @param {import('playwright').Page} page
 */
export async function findVisibleVacancyResponseLink(page) {
  const pageId = vacancyIdFromUrl(page.url());
  const selectors = [
    'a[data-qa="vacancy-response-link-top"]',
    'a[data-qa="vacancy-response-link"]',
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible({ timeout: 300 }).catch(() => false))) continue;
      if (pageId) {
        const h = (await el.getAttribute('href')) || '';
        const hid = h.match(/[?&]vacancyId=(\d+)/i)?.[1];
        if (hid && hid !== pageId) continue;
      }
      return el;
    }
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
export async function waitForVacancyPageReady(page, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await dismissCookieBanner(page);
    const title = page.locator('[data-qa="vacancy-title"], h1').first();
    if (await title.isVisible({ timeout: 600 }).catch(() => false)) {
      if (await isResponseAlreadySubmitted(page)) return 'already';
      if (await findVisibleVacancyResponseLink(page)) return 'ready';
    }
    await page.waitForTimeout(450);
  }
  return null;
}

/**
 * URL отклика всегда по id вакансии из адресной строки (href с карточки может быть от «похожей» вакансии).
 * @param {import('playwright').Page} page
 * @param {string} href
 */
function buildVacancyResponseUrl(page, href = '') {
  const pageVacancyId = vacancyIdFromUrl(page.url());
  if (!pageVacancyId) {
    if (href && /vacancy_response/i.test(href)) {
      return href.startsWith('http') ? href : `https://hh.ru${href}`;
    }
    return null;
  }

  let employerId = '';
  const m = String(href).match(/[?&]employerId=(\d+)/i);
  if (m) employerId = m[1];
  if (!employerId) {
    const m2 = String(href).match(/[?&]employerId=(\d+)/i);
    if (m2) employerId = m2[1];
  }
  const hrefVacancyId = String(href).match(/[?&]vacancyId=(\d+)/i)?.[1];
  if (hrefVacancyId && hrefVacancyId !== pageVacancyId) {
    employerId = '';
  }

  const q = new URLSearchParams({
    vacancyId: pageVacancyId,
    hhtmFrom: 'vacancy',
  });
  if (employerId) q.set('employerId', employerId);
  const resumeId = String(process.env.HH_PROFILE_RESUME_HASH || '').trim();
  if (resumeId) q.set('resumeId', resumeId);
  return `https://hh.ru/applicant/vacancy_response?${q.toString()}`;
}

/**
 * @param {import('playwright').Page} page
 */
export function vacancyResponseRoot(page) {
  return page
    .locator('[data-qa="vacancy-response-popup-form"]')
    .or(page.locator('[data-qa="vacancy-response-popup"]'))
    .or(page.locator('[role="dialog"]'))
    .or(page.locator('[class*="vacancy-response" i][class*="popup" i]'))
    .first();
}

/**
 * @param {import('playwright').Page} page
 */
export async function isVacancyResponseFormOpen(page) {
  if (/applicant\/vacancy_response/i.test(page.url())) {
    const onResponsePage = [
      page.getByText(/отклик на вакансию|резюме для отклика/i),
      page.locator('[data-qa="resume-select-item"]'),
      page.locator('[data-qa="vacancy-response-popup-form"]'),
      page.getByText(/выберите резюме|каким резюме/i),
      page.getByRole('button', { name: /отправить отклик|откликнуться|далее|продолжить/i }),
    ];
    for (const m of onResponsePage) {
      if (await m.first().isVisible({ timeout: 600 }).catch(() => false)) return true;
    }
    return true;
  }

  const root = vacancyResponseRoot(page);
  if (await root.isVisible({ timeout: 500 }).catch(() => false)) return true;

  const markers = [
    page.locator('[data-qa="resume-select-item"]'),
    page.locator('[data-qa*="vacancy-response" i][data-qa*="resume" i]'),
    page.locator('[data-qa="vacancy-response-popup"]'),
    page.getByText(/выберите резюме|каким резюме|отклик на вакансию/i),
    page
      .locator('[data-qa*="vacancy-response" i]')
      .filter({ has: page.locator('button, input[type="radio"]') })
      .first(),
    page
      .locator('[role="dialog"], [class*="modal" i]')
      .filter({ has: page.locator('[data-qa*="resume" i], input[type="radio"]') })
      .first(),
  ];
  for (const m of markers) {
    if (await m.isVisible({ timeout: 350 }).catch(() => false)) return true;
  }
  return false;
}

/**
 * Ждать появления мастера отклика (после клика «Откликнуться»).
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
export async function waitForVacancyResponseForm(page, timeoutMs = 18_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isVacancyResponseFormOpen(page)) return true;
    await page.waitForTimeout(450);
  }
  return false;
}

/**
 * После клика «Откликнуться» форма может быть в модалке, на новой вкладке или по URL отклика.
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 */
export async function resolvePageAfterResponseClick(context, page) {
  const urlHints = /vacancy_response|vacancy-response|\/response\//i;
  const deadline = Date.now() + 12_000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());
    for (const p of pages) {
      if (looksLikeLoginUrl(p.url())) {
        await assertHhLoggedIn(p);
      }
      if (urlHints.test(p.url()) && (await isVacancyResponseFormOpen(p))) return p;
    }
    if (looksLikeLoginUrl(page.url())) await assertHhLoggedIn(page);
    if (await isVacancyResponseFormOpen(page)) return page;
    for (const p of pages) {
      if (await isVacancyResponseFormOpen(p)) return p;
    }
    const revived = await waitForActivePage(context, page, 1500);
    if (revived && revived !== page && (await isVacancyResponseFormOpen(revived))) return revived;
    await page.waitForTimeout(400);
  }
  return (await waitForActivePage(context, page, 2000)) || page;
}

/**
 * @param {import('playwright').Page} page
 */
export async function isResponseAlreadySubmitted(page) {
  if (/applicant\/vacancy_response/i.test(page.url())) {
    return false;
  }
  const hints = [
    page.getByText(/вы уже откликнулись|отклик отправлен|откликнулись на вакансию/i),
    page.locator('[data-qa="vacancy-response-link-top"][disabled], [data-qa="vacancy-response-link"][disabled]'),
    page.getByRole('button', { name: /отклик отправлен/i }),
  ];
  for (const h of hints) {
    if (await h.first().isVisible({ timeout: 350 }).catch(() => false)) return true;
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 */
export async function ensureVacancyResponseFormOpen(page, opts = {}) {
  const waitMs = opts.waitMs ?? 18_000;

  if (await isResponseAlreadySubmitted(page)) return 'already';
  if (await isVacancyResponseFormOpen(page)) return 'open';
  if (/applicant\/vacancy_response/i.test(page.url()) && !looksLikeLoginUrl(page.url())) {
    return 'on-response-url';
  }

  // Уже кликнули снаружи — только ждём, повторный клик закрывает модалку.
  if (opts.alreadyClicked) {
    if (await waitForVacancyResponseForm(page, waitMs)) return 'open-after-wait';
    return null;
  }

  try {
    await clickVacancyResponseButton(page, opts.timeoutMs ?? 10_000, {
      humanClicks: opts.humanClicks !== false,
    });
  } catch {
    /* ignore */
  }
  if (await waitForVacancyResponseForm(page, waitMs)) return 'reopened';
  return null;
}

/**
 * Открыть форму отклика: для многих вакансий hh.ru это отдельная страница /applicant/vacancy_response, не модалка.
 * @param {import('playwright').Page} page
 * @param {{ humanClicks?: boolean, timeoutMs?: number }} opts
 */
export async function openVacancyResponseFlow(page, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const ready = await waitForVacancyPageReady(page, timeoutMs);
  if (ready === 'already') return 'already-submitted';

  const link = await findVisibleVacancyResponseLink(page);
  const href = link ? (await link.getAttribute('href')) || '' : '';
  const responseUrl = buildVacancyResponseUrl(page, href);

  if (!responseUrl) {
    throw new Error(
      'Кнопка «Откликнуться» не появилась на странице вакансии. Проверьте url вакансии или откликнитесь вручную.'
    );
  }

  await page.goto(responseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  if (looksLikeLoginUrl(page.url())) await assertHhLoggedIn(page);

  if (await waitForVacancyResponseForm(page, 20_000)) return 'goto-vacancy_response';
  if (/applicant\/vacancy_response/i.test(page.url()) && !looksLikeLoginUrl(page.url())) {
    return 'goto-vacancy_response-url';
  }

  const { clickVacancyResponseButton } = await import('./hh-response-selectors.mjs');
  return clickVacancyResponseButton(page, timeoutMs, { humanClicks: opts.humanClicks });
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<{ locator: import('playwright').Locator, label: string } | null>}
 */
export async function findEnabledSubmitButton(page) {
  const scopes = [vacancyResponseRoot(page), page.locator('body')];
  const candidates = [
    { label: 'Отправить отклик', re: /отправить отклик/i },
    { label: 'Отправить', re: /^отправить$/i },
    { label: 'Откликнуться повторно', re: /откликнуться повторно/i },
    { label: 'Откликнуться (финал)', re: /^откликнуться$/i },
    { label: 'Готово', re: /^готово$/i },
  ];
  const dataQa = page.locator(
    '[data-qa="vacancy-response-submit-button"], [data-qa*="submit" i][data-qa*="response" i]'
  );

  for (const scope of scopes) {
    for (const { label, re } of candidates) {
      const btn = scope.getByRole('button', { name: re }).first();
      if (!(await btn.isVisible({ timeout: 280 }).catch(() => false))) continue;
      if (await btn.isDisabled().catch(() => true)) continue;
      return { locator: btn, label: `button ${label}` };
    }
    const submitType = scope.locator('button[type="submit"]').filter({ hasText: /отправить/i }).first();
    if (await submitType.isVisible({ timeout: 280 }).catch(() => false)) {
      if (!(await submitType.isDisabled().catch(() => true))) {
        return { locator: submitType, label: 'button[type=submit]' };
      }
    }
  }

  const qaBtn = dataQa.first();
  if (await qaBtn.isVisible({ timeout: 280 }).catch(() => false)) {
    if (!(await qaBtn.isDisabled().catch(() => true))) {
      return { locator: qaBtn, label: 'data-qa submit' };
    }
  }
  return null;
}

/**
 * Один шаг мастера: резюме, «Далее», раскрытие письма.
 * @param {import('playwright').Page} page
 */
export async function advanceResponseWizardOneStep(page) {
  const modal = /applicant\/vacancy_response/i.test(page.url())
    ? page.locator('main, body').first()
    : vacancyResponseRoot(page);
  let acted = false;

  const preferredTitle = String(process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  if (!preferredTitle) {
    const radios = modal.locator('input[type="radio"]');
    const radioCount = await radios.count().catch(() => 0);
    for (let ri = 0; ri < radioCount; ri++) {
      const r = radios.nth(ri);
      if (!(await r.isVisible({ timeout: 200 }).catch(() => false))) continue;
      if (await r.isChecked().catch(() => false)) continue;
      await r.scrollIntoViewIfNeeded().catch(() => {});
      await r.click({ force: true }).catch(() => {});
      acted = true;
      await page.waitForTimeout(350);
      break;
    }
    if (acted) return 'radio';
  }

  const nextNames = [/^далее$/i, /продолжить/i, /сохранить и продолжить/i, /перейти к отклику/i];
  for (const nameRe of nextNames) {
    const btn = modal.getByRole('button', { name: nameRe }).first();
    if (!(await btn.isVisible({ timeout: 400 }).catch(() => false))) continue;
    if (await btn.isDisabled().catch(() => true)) continue;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click();
    await page.waitForTimeout(450);
    return 'next';
  }

  if (await expandCoverLetterSectionIfPresent(page)) return 'expand-letter';

  return null;
}

/**
 * Пройти мастер отклика: резюме (PDF или профиль), письмо, отправка.
 * @param {import('playwright').Page} page
 * @param {{
 *   resumePdfPath?: string,
 *   letter?: string,
 *   humanTyping?: boolean,
 *   humanClicks?: boolean,
 *   maxSteps?: number,
 *   log?: (msg: string) => void,
 * }} opts
 * @returns {Promise<{ submitted: boolean, label?: string, letterInForm?: boolean, resumeAttached?: boolean, profileResume?: string, questionnaire?: object }>}
 */
export async function completeVacancyResponseForm(page, opts = {}) {
  const log = opts.log || (() => {});
  const maxSteps = opts.maxSteps ?? 24;
  let letterInForm = false;
  let resumeAttached = false;
  let profileResume = null;

  if (await isResponseAlreadySubmitted(page)) {
    log('[hh-response-modal] Уже откликнулись на вакансию');
    return { submitted: true, label: 'already-submitted' };
  }

  let opened = await ensureVacancyResponseFormOpen(page, {
    humanClicks: opts.humanClicks,
    alreadyClicked: opts.alreadyClicked === true,
    waitMs: opts.waitMs ?? 18_000,
  });
  if (opened === 'already') return { submitted: true, label: 'already-submitted' };
  if (!opened && opts.alreadyClicked) {
    opened = await ensureVacancyResponseFormOpen(page, {
      humanClicks: opts.humanClicks,
      alreadyClicked: false,
      waitMs: opts.waitMs ?? 12_000,
    });
  }
  if (!opened) {
    try {
      await assertHhLoggedIn(page);
    } catch (e) {
      throw e;
    }
    const url = page.url();
    throw new Error(
      `Форма отклика не открылась после клика «Откликнуться» (url=${url}). ` +
        'Запустите: npm run login. Диагностика: node scripts/probe-vacancy-response.mjs --stay-open'
    );
  }

  let letterFillAttempts = 0;
  const maxLetterFillAttempts = 6;
  const preferredTitle = String(process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  const needResume = Boolean(preferredTitle || process.env.HH_PROFILE_RESUME_HASH?.trim());
  let profileResumeOk = !needResume;
  let resumeSelectAttempts = 0;
  const maxResumeSelectAttempts = 4;

  const syncPreferredResume = async () => {
    if (!needResume || profileResumeOk) return true;
    if (resumeSelectAttempts >= maxResumeSelectAttempts) return false;
    resumeSelectAttempts++;
    const r = await ensurePreferredProfileResume(page, { preferredTitle, log });
    profileResume = r.title;
    profileResumeOk = r.ok;
    if (!r.ok && resumeSelectAttempts >= maxResumeSelectAttempts) {
      log(
        `[hh-response-modal] Резюме не переключилось на «${preferredTitle || 'профиль'}» (сейчас: ${r.title || '—'}). ` +
          'Проверьте HH_PROFILE_RESUME_HASH в config/devops.env или выберите DevOps вручную.'
      );
    }
    return r.ok;
  };

  if (needResume) {
    await syncPreferredResume();
  }

  for (let step = 0; step < maxSteps; step++) {
    await page.waitForTimeout(280);

    if (await isResponseAlreadySubmitted(page)) {
      return { submitted: true, label: 'already-submitted', letterInForm, resumeAttached };
    }

    if (needResume && !profileResumeOk) {
      await syncPreferredResume();
      if (!profileResumeOk) {
        if (resumeSelectAttempts >= maxResumeSelectAttempts) break;
        continue;
      }
    }

    if (opts.letter && !letterInForm && letterFillAttempts < maxLetterFillAttempts) {
      letterFillAttempts++;
      await expandCoverLetterSectionIfPresent(page);
      const filled = await fillCoverLetterFieldIfPresent(page, opts.letter, 8000, {
        humanTyping: opts.humanTyping === true,
      });
      if (filled) {
        letterInForm = true;
        log(`[hh-response-modal] Письмо в форме: ${filled}`);
        continue;
      }
    }

    const pendingLetter = Boolean(opts.letter?.trim()) && !letterInForm;
    const pendingResume = needResume && !profileResumeOk;
    const respectQuestionnaire = opts.respectQuestionnaire !== false;
    if (respectQuestionnaire && !pendingLetter && !pendingResume) {
      const qAction = await handleQuestionnaireOnPage(
        page,
        opts,
        log,
        'questionnaire-before-submit'
      );
      if (qAction === 'continue') continue;
      if (qAction === 'stop') {
        const qCheck = await detectEmployerQuestionnaire(page);
        log(
          `[hh-response-modal] Анкета работодателя (${qCheck.questions.length} вопр.) — отправка отменена`
        );
        return {
          submitted: false,
          questionnaire: qCheck,
          letterInForm,
          resumeAttached,
          profileResume,
          label: 'questionnaire-before-submit',
        };
      }
    }

    const submit = await findEnabledSubmitButton(page);
    if (submit && !pendingLetter && !pendingResume) {
      await submit.locator.scrollIntoViewIfNeeded().catch(() => {});
      await submit.locator.click();
      await page.waitForTimeout(900);

      if (respectQuestionnaire) {
        const postQ = await waitAndDetectQuestionnaireAfterAction(page, 3500);
        if (postQ.detected) {
          if (opts.questionnaireAuto && opts.record && opts.cvText) {
            const auto = await tryAutoFillEmployerQuestionnaire(page, {
              record: opts.record,
              cvText: opts.cvText,
              log,
            });
            if (auto.ok) {
              log('[hh-response-modal] Анкета заполнена — повторная отправка');
              continue;
            }
          }
          log(
            `[hh-response-modal] После клика осталась анкета (${postQ.questions.length} вопр.) — нужен ручной ответ`
          );
          return {
            submitted: false,
            questionnaire: postQ,
            letterInForm,
            resumeAttached,
            profileResume,
            label: 'questionnaire-after-click',
          };
        }
        const amb = await questionnaireOrStillOpen(page);
        if (amb?.questionnaire) {
          log(
            `[hh-response-modal] Форма отклика открыта, анкета (${amb.questionnaire.questions.length} вопр.)`
          );
          return {
            submitted: false,
            questionnaire: amb.questionnaire,
            letterInForm,
            resumeAttached,
            profileResume,
            label: 'questionnaire-form-still-open',
          };
        }
        if (amb?.stillOpen) {
          log('[hh-response-modal] После клика форма отклика ещё открыта — не считаем отклик отправленным');
          return {
            submitted: false,
            letterInForm,
            resumeAttached,
            profileResume,
            label: 'form-still-open-after-submit',
          };
        }
      }

      if (await isResponseAlreadySubmitted(page)) {
        log(`[hh-response-modal] Отправка: ${submit.label}`);
        return {
          submitted: true,
          label: submit.label,
          letterInForm,
          resumeAttached,
          profileResume,
        };
      }

      if (!respectQuestionnaire) {
        log(`[hh-response-modal] Отправка: ${submit.label}`);
        return {
          submitted: true,
          label: submit.label,
          letterInForm,
          resumeAttached,
          profileResume,
        };
      }

      log(`[hh-response-modal] Клик «${submit.label}», ушли с формы отклика`);
      return {
        submitted: true,
        label: submit.label,
        letterInForm,
        resumeAttached,
        profileResume,
      };
    }
    if (submit && pendingResume) {
      await syncPreferredResume();
      continue;
    }
    if (submit && pendingLetter) {
      const action = await advanceResponseWizardOneStep(page);
      if (action) continue;
    }

    if (opts.resumePdfPath && !resumeAttached) {
      const attached = await attachResumePdfInResponseModal(page, opts.resumePdfPath);
      if (attached) {
        resumeAttached = true;
        log('[hh-response-modal] PDF резюме прикреплено');
        continue;
      }
    }

    const action = await advanceResponseWizardOneStep(page);
    if (action) continue;

    await ensureVacancyResponseFormOpen(page, { humanClicks: opts.humanClicks });
  }

  const submit = await findEnabledSubmitButton(page);
  const pendingLetter = Boolean(opts.letter?.trim()) && !letterInForm;
  if (submit && !pendingLetter && profileResumeOk) {
    await submit.locator.click();
    if (opts.respectQuestionnaire !== false) {
      const postQ = await waitAndDetectQuestionnaireAfterAction(page, 3500);
      if (postQ.detected) {
        return {
          submitted: false,
          questionnaire: postQ,
          letterInForm,
          resumeAttached,
          profileResume,
          label: 'questionnaire-final',
        };
      }
      const amb = await questionnaireOrStillOpen(page);
      if (amb?.questionnaire) {
        return {
          submitted: false,
          questionnaire: amb.questionnaire,
          letterInForm,
          resumeAttached,
          profileResume,
          label: 'questionnaire-final-still-open',
        };
      }
      if (amb?.stillOpen) {
        return {
          submitted: false,
          letterInForm,
          resumeAttached,
          profileResume,
          label: 'form-still-open-final',
        };
      }
    }
    if (await isResponseAlreadySubmitted(page)) {
      return {
        submitted: true,
        label: submit.label,
        letterInForm,
        resumeAttached,
        profileResume,
      };
    }
    return {
      submitted: true,
      label: submit.label,
      letterInForm,
      resumeAttached,
      profileResume,
    };
  }

  if (needResume && !profileResumeOk) {
    log(
      `[hh-response-modal] Отправка отменена: не выбрано резюме «${preferredTitle || process.env.HH_PROFILE_RESUME_HASH}»`
    );
  }

  return { submitted: false, letterInForm, resumeAttached, profileResume };
}
