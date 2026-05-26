/**
 * Мастер отклика hh.ru: выбор резюме, «Далее», отправка.
 * Один цикл вместо разрозненных prepare → fill → submit.
 */

import { isFastMode } from './hh-human-delay.mjs';
import { clickVacancyResponseButton } from './hh-response-selectors.mjs';
import {
  expandCoverLetterSectionIfPresent,
  fillCoverLetterFieldIfPresent,
  verifyCoverLetterInForm,
} from './hh-response-selectors.mjs';
import {
  attachResumePdfInResponseModal,
  ensurePreferredProfileResume,
  readCurrentResponseResumeHash,
  readCurrentResponseResumeTitle,
  reloadVacancyResponseWithResume,
  listResponseFormResumes,
} from './hh-resume-upload.mjs';
import { waitForActivePage } from './chromium-session.mjs';
import { assertHhLoggedIn, looksLikeLoginUrl } from './hh-session-check.mjs';
import { vacancyIdFromUrl } from './vacancy-parse.mjs';
import {
  clickEmployerQuestionnaireNext,
  detectEmployerQuestionnaire,
  hasUnfilledEmployerQuestionnaireRadios,
  isEmployerQuestionnaireWizardStep,
  scrollQuestionnaireFields,
  waitAndDetectQuestionnaireAfterAction,
} from './hh-employer-questionnaire.mjs';
import {
  tryAutoFillEmployerQuestionnaireWithWizard,
  recordHasDashboardQuestionnaireAnswers,
} from './hh-questionnaire-auto.mjs';
import {
  detectHhVacancySiteState,
  HH_SITE_STATES,
  hhSiteStateBlocksApply,
} from './hh-vacancy-response-state.mjs';

/**
 * @param {object} opts
 */
function canRunQuestionnaireAuto(opts) {
  if (!opts.questionnaireAuto || !opts.record) return false;
  return recordHasDashboardQuestionnaireAnswers(opts.record) || Boolean(String(opts.cvText || '').trim());
}

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

  if (!canRunQuestionnaireAuto(opts)) return 'stop';

  if (opts._questionnaireFilledThisPass && !(await hasUnfilledEmployerQuestionnaireRadios(page))) {
    return null;
  }

  const auto = await tryAutoFillEmployerQuestionnaireWithWizard(page, {
    record: opts.record,
    cvText: opts.cvText || '',
    log,
    quiet: Boolean(opts._questionnaireFillAttempted),
  });
  opts._questionnaireFillAttempted = true;

  if (auto.ok) {
    opts._questionnaireFilledThisPass = true;
    log(
      `[hh-response-modal] Анкета из дашборда (${auto.fill?.filledCount ?? '?'}/${auto.questionnaire?.questions?.length ?? qCheck.questions.length}) — «Далее» или «Отправить»`
    );
    await scrollQuestionnaireFields(page);
    await page.waitForTimeout(400);
    return 'filled-ready';
  }

  log(`[hh-response-modal] Авто-анкета (${label}): не удалось заполнить — нужен ручной ввод`);
  return 'stop';
}

/**
 * Есть ли пустые textarea анкеты (не сопроводительное).
 * @param {import('playwright').Page} page
 */
async function hasEmptyVisibleQuestionnaireTextareas(page) {
  const loc = page.locator('textarea:visible');
  const n = await loc.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const ta = loc.nth(i);
    const qa = `${(await ta.getAttribute('data-qa')) || ''} ${(await ta.getAttribute('name')) || ''}`;
    if (/resume|резюме|letter|письм|cover/i.test(qa)) continue;
    const val = await ta.inputValue().catch(() => '');
    if (!String(val || '').trim()) return true;
  }
  return false;
}

/** Анкета на экране, но без пустых полей — можно жать финальный «Откликнуться». */
export async function questionnaireBlocksSubmit(page) {
  const q = await detectEmployerQuestionnaire(page);
  if (!q.detected) return false;
  if (await hasEmptyVisibleQuestionnaireTextareas(page)) return true;
  if (await hasUnfilledEmployerQuestionnaireRadios(page)) return true;
  return false;
}

/** @param {import('playwright').Page} page */
async function questionnaireOrStillOpen(page) {
  const q = await detectEmployerQuestionnaire(page);
  if (q.detected && (await questionnaireBlocksSubmit(page))) {
    return { questionnaire: q };
  }
  if (await isVacancyResponseFormOpen(page)) {
    return { stillOpen: true };
  }
  return null;
}

/** Закрыть «Восстановить страницы?» и похожие оверлеи Chromium. */
async function dismissChromiumRestorePopup(page) {
  for (const re of [/не восстанавливать/i, /don't restore/i, /not now/i, /^закрыть$/i]) {
    const b = page.getByRole('button', { name: re }).first();
    if (await b.isVisible({ timeout: 350 }).catch(() => false)) {
      await b.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
      return true;
    }
  }
  return false;
}

/**
 * Ждём подтверждение отклика на hh.ru (не только исчезновение анкеты).
 * @param {import('playwright').Page} page
 * @param {number} [timeoutMs]
 */
async function waitForVacancyApplyComplete(page, timeoutMs = 14_000) {
  const deadline = Date.now() + timeoutMs;
  const hadResponseUrl = /applicant\/vacancy_response/i.test(page.url());
  while (Date.now() < deadline) {
    if (await isResponseAlreadySubmitted(page)) {
      return { ok: true, label: 'already-applied' };
    }
    const det = await detectHhVacancySiteState(page);
    if (!det.canApply && det.state === HH_SITE_STATES.ALREADY_APPLIED) {
      return { ok: true, label: det.source || 'already-applied' };
    }
    if (
      await page
        .getByText(/ваш отклик отправлен|отклик отправлен|отклик доставлен|вы откликнулись/i)
        .first()
        .isVisible({ timeout: 250 })
        .catch(() => false)
    ) {
      return { ok: true, label: 'success-banner' };
    }
    if (!/applicant\/vacancy_response/i.test(page.url())) {
      return { ok: true, label: 'url-changed' };
    }
    const sendBtn = page.getByRole('button', { name: /отправить отклик/i }).first();
    const otclick = page.getByRole('button', { name: /^откликнуться$/i }).first();
    const submitQa = page.locator('[data-qa="vacancy-response-submit-button"]').last();
    const sendVisible = await sendBtn.isVisible({ timeout: 200 }).catch(() => false);
    const otclickVisible = await otclick.isVisible({ timeout: 200 }).catch(() => false);
    const qaVisible = await submitQa.isVisible({ timeout: 200 }).catch(() => false);
    if (hadResponseUrl && !sendVisible && !otclickVisible && !qaVisible) {
      return { ok: true, label: 'submit-gone' };
    }
    if (await submitQa.isVisible({ timeout: 200 }).catch(() => false)) {
      if (await submitQa.isDisabled().catch(() => false)) {
        return { ok: true, label: 'submit-disabled' };
      }
    }
    if (sendVisible && (await sendBtn.isDisabled().catch(() => false))) {
      return { ok: true, label: 'send-disabled' };
    }
    const chatLink = page.getByRole('link', { name: /перейти в переписку|отклик и переписка/i }).first();
    if (await chatLink.isVisible({ timeout: 250 }).catch(() => false)) {
      return { ok: true, label: 'chat-link' };
    }
    await page.waitForTimeout(450);
  }
  return { ok: false };
}

/** @param {import('playwright').Page} page */
async function readVisibleFormErrors(page) {
  const blob = await page
    .locator('[class*="error" i], [role="alert"], [data-qa*="error" i]')
    .allInnerTexts()
    .catch(() => []);
  return [...new Set(blob.map((t) => String(t).replace(/\s+/g, ' ').trim()).filter((t) => t.length > 4 && t.length < 200))]
    .slice(0, 3);
}

/**
 * Финальная отправка на странице vacancy_response (кнопка внизу формы).
 * @param {import('playwright').Page} page
 * @param {(msg: string) => void} [log]
 */
async function clickFinalVacancyResponseSubmit(page, log = () => {}) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(500);

  const tryClick = async (btn, label) => {
    if (!(await btn.isVisible({ timeout: 400 }).catch(() => false))) return false;
    if (await btn.isDisabled().catch(() => true)) return false;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    await btn.click({ timeout: 8000, force: true }).catch(() => {});
    log(`[hh-response-modal] Финальный клик: ${label}`);
    return true;
  };

  const sendBtn = page.getByRole('button', { name: /отправить отклик/i }).last();
  if (await tryClick(sendBtn, '«Отправить отклик»')) return true;

  const qaSubmit = page.locator('[data-qa="vacancy-response-submit-button"]').last();
  if (await tryClick(qaSubmit, 'data-qa submit')) return true;

  const typeSubmit = page
    .locator('button[type="submit"]')
    .filter({ hasText: /отправить отклик/i })
    .last();
  if (await tryClick(typeSubmit, 'button[type=submit] «Отправить отклик»')) return true;

  const buttons = page.getByRole('button', { name: /^откликнуться$/i });
  const n = await buttons.count().catch(() => 0);
  let bestIdx = -1;
  let bestY = -1;
  for (let i = 0; i < n; i++) {
    const btn = buttons.nth(i);
    if (!(await btn.isVisible({ timeout: 200 }).catch(() => false))) continue;
    const box = await btn.boundingBox().catch(() => null);
    const y = box?.y ?? 0;
    if (y >= bestY) {
      bestY = y;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) {
    return tryClick(buttons.nth(bestIdx), '«Откликнуться» (низ формы)');
  }

  const anySend = page.locator('button, [role="button"]').filter({ hasText: /отправить отклик/i }).last();
  if (await tryClick(anySend, 'button «Отправить отклик» (hasText)')) return true;

  const viaDom = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        '[data-qa="vacancy-response-submit-button"], button[type="submit"], button, a[role="button"]'
      ),
    ];
    const textOf = (el) =>
      (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    const docY = (el) => el.getBoundingClientRect().top + window.scrollY;
    let hits = nodes.filter((el) => /отправить отклик/i.test(textOf(el)));
    if (!hits.length) {
      hits = nodes.filter((el) => /откликнуться/i.test(textOf(el)));
    }
    hits.sort((a, b) => docY(b) - docY(a));
    const btn = hits[0];
    if (!btn) {
      const enabled = hits.filter((el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
      if (enabled[0]) {
        enabled.sort((a, b) => docY(b) - docY(a));
        enabled[0].scrollIntoView({ block: 'center', behavior: 'instant' });
        enabled[0].click();
        return (enabled[0].innerText || enabled[0].value || '').slice(0, 40);
      }
      return '';
    }
    btn.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return '';
    btn.click();
    return (btn.innerText || btn.value || '').slice(0, 40);
  });
  if (viaDom) {
    log(`[hh-response-modal] Финальный клик (DOM): ${viaDom}`);
    return true;
  }

  log('[hh-response-modal] Кнопка финальной отправки не найдена на странице');
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {object} opts
 * @param {(msg: string) => void} log
 * @param {{ letterInForm?: boolean, resumeAttached?: boolean, profileResume?: string }} state
 */
async function tryFinishQuestionnaireApply(page, opts, log, state) {
  if (opts.letter?.trim()) {
    await expandCoverLetterSectionIfPresent(page);
  }
  for (let i = 0; i < 4; i++) {
    if (!(await clickEmployerQuestionnaireNext(page))) break;
    await page.waitForTimeout(500);
  }
  await scrollQuestionnaireFields(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(600);

  const waitApplyNetwork = page
    .waitForResponse(
      (r) =>
        /vacancy|response|negotiation|application/i.test(r.url()) &&
        ['POST', 'PUT'].includes(r.request().method()) &&
        r.status() < 500,
      { timeout: 25_000 }
    )
    .catch(() => null);

  if (!(await clickFinalVacancyResponseSubmit(page, log))) {
    log('[hh-response-modal] Не удалось нажать «Отправить отклик» / «Откликнуться»');
    return null;
  }
  opts._finalApplyClicks = (opts._finalApplyClicks || 0) + 1;

  const net = await waitApplyNetwork;
  if (net && net.status() < 400) {
    log(`[hh-response-modal] Отклик отправлен (HTTP ${net.status()})`);
    await page.waitForTimeout(1500);
    return {
      submitted: true,
      label: `http-${net.status()}`,
      letterInForm: state.letterInForm,
      resumeAttached: state.resumeAttached,
      profileResume: state.profileResume,
      page,
    };
  }

  const waited = await waitForVacancyApplyComplete(page, 22_000);
  if (waited.ok) {
    log(`[hh-response-modal] Отклик отправлен (${waited.label})`);
    return {
      submitted: true,
      label: waited.label,
      letterInForm: state.letterInForm,
      resumeAttached: state.resumeAttached,
      profileResume: state.profileResume,
      page,
    };
  }

  const vacancyUrl = String(opts.record?.url || '').trim();
  if (vacancyUrl && /hh\.ru\/vacancy\//i.test(vacancyUrl)) {
    await page.goto(vacancyUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    if (await isResponseAlreadySubmitted(page)) {
      log('[hh-response-modal] Отклик отправлен (страница вакансии: уже откликнулись)');
      return {
        submitted: true,
        label: 'vacancy-page-applied',
        letterInForm: state.letterInForm,
        resumeAttached: state.resumeAttached,
        profileResume: state.profileResume,
        page,
      };
    }
  }

  const errs = await readVisibleFormErrors(page);
  if (errs.length) {
    log(`[hh-response-modal] hh.ru: ${errs.join(' · ')}`);
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
    'button[data-qa="vacancy-response-link-top"]',
    'button[data-qa="vacancy-response-link"]',
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
  const vacancyIdOnPage = vacancyIdFromUrl(page.url());
  while (Date.now() < deadline) {
    await dismissCookieBanner(page);
    const title = page.locator('[data-qa="vacancy-title"], h1').first();
    if (await title.isVisible({ timeout: 600 }).catch(() => false)) {
      if (await isResponseAlreadySubmitted(page)) return 'already';
      if (await findVisibleVacancyResponseLink(page)) return 'ready';
      if (vacancyIdOnPage) return 'ready';
      const btn = page.getByRole('button', { name: /откликнуться/i }).first();
      if (await btn.isVisible({ timeout: 400 }).catch(() => false)) return 'ready';
    }
    await page.waitForTimeout(450);
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 */
async function detectVacancyUnavailable(page) {
  const hints = page.getByText(
    /вакансия в архиве|вакансия снята|снята с публикации|больше не актуальн|вакансия не найдена|страница не найдена/i
  );
  return hints.first().isVisible({ timeout: 500 }).catch(() => false);
}

/**
 * URL отклика всегда по id вакансии из адресной строки (href с карточки может быть от «похожей» вакансии).
 * @param {import('playwright').Page} page
 * @param {string} href
 * @param {{ vacancyId?: string, vacancyUrl?: string, resumeHash?: string }} opts
 */
function buildVacancyResponseUrl(page, href = '', opts = {}) {
  const pageVacancyId =
    String(opts.vacancyId || '').trim() ||
    vacancyIdFromUrl(page.url()) ||
    vacancyIdFromUrl(opts.vacancyUrl || '');
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
  const resumeId = String(opts.resumeHash || process.env.HH_PROFILE_RESUME_HASH || '').trim();
  /** resumeId в URL — нужное резюме сразу (DevOps / Data / поддержка). На форме дублируем выбор по TITLE. */
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
    if (await isResponseAlreadySubmitted(page)) return false;

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
    const q = await detectEmployerQuestionnaire(page);
    if (q.detected && !q.captchaBlocking) return true;
    return false;
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
 * Активная вкладка с формой отклика (после «Откликнуться» часто открывается вторая вкладка).
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 * @param {{ log?: (msg: string) => void, closeOtherTabs?: boolean, vacancyId?: string }} [opts]
 */
export async function focusVacancyResponsePage(context, page, opts = {}) {
  const log = opts.log || (() => {});
  let active = (await resolvePageAfterResponseClick(context, page)) || page;

  const urlHints = /vacancy_response|vacancy-response|\/response\//i;
  const pages = context.pages().filter((p) => !p.isClosed());
  for (const p of pages) {
    if (p === active || p.isClosed()) continue;
    if (urlHints.test(p.url()) && (await isVacancyResponseFormOpen(p))) {
      active = p;
      break;
    }
  }

  if (active !== page) {
    log('[hh-response-modal] Переключение на вкладку формы отклика');
  }

  if (opts.closeOtherTabs !== false) {
    for (const p of context.pages()) {
      if (p === active || p.isClosed()) continue;
      const u = p.url();
      if (/hh\.ru\/vacancy\/\d+/i.test(u) && !urlHints.test(u)) {
        await p.close().catch(() => {});
      }
    }
  }

  try {
    await active.bringToFront();
  } catch {
    /* ignore */
  }
  return active;
}

/**
 * @param {import('playwright').Page} page
 */
export async function isResponseAlreadySubmitted(page) {
  const det = await detectHhVacancySiteState(page);
  return !det.canApply && det.state !== HH_SITE_STATES.NONE;
}

/**
 * @param {import('playwright').Page} page
 */
export async function ensureVacancyResponseFormOpen(page, opts = {}) {
  const waitMs = opts.waitMs ?? 18_000;

  if (await isResponseAlreadySubmitted(page)) return 'already';
  if (await isVacancyResponseFormOpen(page)) return 'open';
  if (/applicant\/vacancy_response/i.test(page.url()) && !looksLikeLoginUrl(page.url())) {
    if (await waitForVacancyResponseForm(page, Math.min(waitMs, 10_000))) return 'open-after-url';
    return null;
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
/**
 * Прямой переход на /applicant/vacancy_response (без resumeId в URL — резюме на форме).
 * @param {import('playwright').Page} page
 * @param {{ vacancyId: string, vacancyUrl?: string, log?: (msg: string) => void }} opts
 * @returns {Promise<string|null>}
 */
async function gotoVacancyResponseDirect(page, opts) {
  const log = opts.log || (() => {});
  const responseUrl = buildVacancyResponseUrl(page, '', {
    vacancyId: opts.vacancyId,
    vacancyUrl: opts.vacancyUrl || '',
    resumeHash: '',
  });
  if (!responseUrl) return null;

  log('[hh-response-modal] Прямой переход на форму отклика (vacancy_response)');
  await page.goto(responseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(isFastMode() ? 400 : 1000);
  if (looksLikeLoginUrl(page.url())) await assertHhLoggedIn(page);

  const postGoto = await detectHhVacancySiteState(page);
  if (hhSiteStateBlocksApply(postGoto.state)) return 'already-submitted';
  if (await isResponseAlreadySubmitted(page)) return 'already-submitted';
  if (await waitForVacancyResponseForm(page, 10_000)) return 'goto-vacancy_response-direct';
  if (await isEmployerQuestionnaireWizardStep(page)) return 'goto-vacancy_response-questionnaire';
  if (/applicant\/vacancy_response/i.test(page.url()) && !looksLikeLoginUrl(page.url())) {
    return 'goto-vacancy_response-url';
  }
  return null;
}

export async function openVacancyResponseFlow(page, opts = {}) {
  const log = opts.log || (() => {});
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const vacancyUrl = String(opts.vacancyUrl || '').trim();
  const knownVacancyId =
    String(opts.vacancyId || '').trim() || vacancyIdFromUrl(vacancyUrl) || vacancyIdFromUrl(page.url());

  if (await detectVacancyUnavailable(page)) {
    throw new Error('Вакансия снята с публикации или в архиве — отклик недоступен');
  }

  const curVacId = vacancyIdFromUrl(page.url());
  if (/applicant\/vacancy_response/i.test(page.url()) && !looksLikeLoginUrl(page.url())) {
    if (!knownVacancyId || curVacId === knownVacancyId) {
      if (await waitForVacancyResponseForm(page, 4000)) return 'already-on-response-form';
      if (await isEmployerQuestionnaireWizardStep(page)) return 'already-on-questionnaire';
      return 'already-on-response-url';
    }
  }

  if (knownVacancyId && !/applicant\/vacancy_response/i.test(page.url())) {
    try {
      const direct = await gotoVacancyResponseDirect(page, {
        vacancyId: knownVacancyId,
        vacancyUrl,
        log,
      });
      if (direct) return direct;
    } catch (e) {
      log(`[hh-response-modal] Прямой URL не удался: ${e.message}`);
    }
  }

  const ready = await waitForVacancyPageReady(page, Math.min(timeoutMs, 12_000));
  if (ready === 'already') return 'already-submitted';

  await page
    .evaluate(() => window.scrollTo(0, Math.min(900, document.body.scrollHeight * 0.4)))
    .catch(() => {});
  await page.waitForTimeout(isFastMode() ? 200 : 450);

  const link = await findVisibleVacancyResponseLink(page);
  const href = link ? (await link.getAttribute('href')) || '' : '';
  const urlOpts = {
    vacancyId: knownVacancyId,
    vacancyUrl,
    resumeHash: '',
  };
  let responseUrl = buildVacancyResponseUrl(page, href, urlOpts);

  if (!responseUrl && knownVacancyId) {
    responseUrl = buildVacancyResponseUrl(page, '', urlOpts);
  }

  if (!responseUrl) {
    try {
      return await clickVacancyResponseButton(page, Math.min(timeoutMs, 12_000), {
        humanClicks: opts.humanClicks,
      });
    } catch {
      if (await detectVacancyUnavailable(page)) {
        throw new Error('Вакансия снята с публикации или в архиве — отклик недоступен');
      }
      throw new Error(
        `Не удалось открыть форму отклика (vacancyId=${knownVacancyId || '—'}, url=${page.url().slice(0, 72)}). ` +
          'Проверьте вакансию вручную или обновите селекторы.'
      );
    }
  }

  log('[hh-response-modal] Переход по ссылке отклика');
  await page.goto(responseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(isFastMode() ? 500 : 1200);
  if (looksLikeLoginUrl(page.url())) await assertHhLoggedIn(page);

  const postGoto = await detectHhVacancySiteState(page);
  if (hhSiteStateBlocksApply(postGoto.state)) {
    return 'already-submitted';
  }

  const wantHash = String(opts.resumeHash || '').trim();
  const preferredTitle = String(opts.preferredResumeTitle || '').trim();
  if (wantHash && knownVacancyId && !(await isEmployerQuestionnaireWizardStep(page))) {
    const listed = await listResponseFormResumes(page).catch(() => []);
    const hashAllowed = listed.some((a) => a.hash === wantHash);
    const curHash = await readCurrentResponseResumeHash(page).catch(() => '');
    if (hashAllowed && curHash && curHash !== wantHash) {
      log('[hh-response-modal] URL отклика с другим resumeId — перезагрузка');
      await reloadVacancyResponseWithResume(page, {
        vacancyId: knownVacancyId,
        resumeHash: wantHash,
        log,
      });
    } else if (!hashAllowed && listed.length) {
      log(
        `[hh-response-modal] resumeId из routing не в списке для этой вакансии — на форме выберется «${preferredTitle || 'подходящее'}» из доступных`
      );
    }
  }

  if (await isResponseAlreadySubmitted(page)) return 'already-submitted';

  if (await waitForVacancyResponseForm(page, isFastMode() ? 8_000 : 10_000)) return 'goto-vacancy_response';
  if (/applicant\/vacancy_response/i.test(page.url()) && !looksLikeLoginUrl(page.url())) {
    return 'goto-vacancy_response-url';
  }

  return clickVacancyResponseButton(page, Math.min(timeoutMs, 12_000), { humanClicks: opts.humanClicks });
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<{ locator: import('playwright').Locator, label: string } | null>}
 */
export async function findEnabledSubmitButton(page) {
  if (await hasEmptyVisibleQuestionnaireTextareas(page)) {
    return null;
  }
  if (await hasUnfilledEmployerQuestionnaireRadios(page)) {
    return null;
  }
  const scopes = [vacancyResponseRoot(page), page.locator('body')];
  const onResponsePage = /applicant\/vacancy_response/i.test(page.url());
  const qOnPage = onResponsePage ? await detectEmployerQuestionnaire(page) : { detected: false };
  const longForm = qOnPage.detected && (qOnPage.questions?.length || 0) >= 8;
  const candidates = onResponsePage
    ? longForm
      ? [
          { label: 'Отправить отклик', re: /отправить отклик/i },
          { label: 'Отправить', re: /^отправить$/i },
          { label: 'Откликнуться повторно', re: /откликнуться повторно/i },
          { label: 'Откликнуться (финал)', re: /^откликнуться$/i },
          { label: 'Готово', re: /^готово$/i },
        ]
      : [
          { label: 'Откликнуться (финал)', re: /^откликнуться$/i },
          { label: 'Откликнуться повторно', re: /откликнуться повторно/i },
          { label: 'Отправить отклик', re: /отправить отклик/i },
          { label: 'Отправить', re: /^отправить$/i },
          { label: 'Готово', re: /^готово$/i },
        ]
    : [
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
      const btn = scope.getByRole('button', { name: re }).last();
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
 * @param {{ preferredResumeTitle?: string, skipResumeRadio?: boolean }} [opts]
 */
export async function advanceResponseWizardOneStep(page, opts = {}) {
  const onResponsePage = /applicant\/vacancy_response/i.test(page.url());
  const formOpen = await isVacancyResponseFormOpen(page);
  if (!onResponsePage && !formOpen) return null;

  const modal = onResponsePage
    ? page.locator('main, body').first()
    : vacancyResponseRoot(page);
  let acted = false;

  const preferredTitle = String(
    opts.preferredResumeTitle || process.env.HH_PROFILE_RESUME_TITLE || ''
  ).trim();
  const hasResumeList =
    (await modal.locator('[data-qa="resume-select-item"]').first().isVisible({ timeout: 300 }).catch(() => false)) ||
    (await modal.getByText(/резюме для отклика|выберите резюме/i).first().isVisible({ timeout: 300 }).catch(() => false));

  if (!preferredTitle && !opts.skipResumeRadio && !onResponsePage && !hasResumeList) {
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

  if (opts.context) {
    page = await focusVacancyResponsePage(opts.context, page, {
      log,
      closeOtherTabs: opts.closeOtherTabs !== false,
      vacancyId: opts.vacancyId,
    });
  }

  if (await isResponseAlreadySubmitted(page)) {
    log('[hh-response-modal] Уже откликнулись на вакансию');
    return { submitted: true, label: 'already-submitted', page };
  }

  let opened = await ensureVacancyResponseFormOpen(page, {
    humanClicks: opts.humanClicks,
    alreadyClicked: opts.alreadyClicked === true,
    waitMs: opts.waitMs ?? 18_000,
  });
  if (opened === 'already') return { submitted: true, label: 'already-submitted', page };
  if (!opened && opts.alreadyClicked) {
    opened = await ensureVacancyResponseFormOpen(page, {
      humanClicks: opts.humanClicks,
      alreadyClicked: false,
      waitMs: opts.waitMs ?? 12_000,
    });
  }
  if (!opened) {
    if (await isResponseAlreadySubmitted(page)) {
      log('[hh-response-modal] Форма отклика не активна — отклик уже был на hh.ru');
      return { submitted: true, label: 'already-submitted', page };
    }
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
  const preferredTitle = String(
    opts.preferredResumeTitle || opts.resumeTarget?.title || process.env.HH_PROFILE_RESUME_TITLE || ''
  ).trim();
  const resumeHash = String(
    opts.resumeHash || opts.resumeTarget?.hash || process.env.HH_PROFILE_RESUME_HASH || ''
  ).trim();
  const vacancyId =
    String(opts.vacancyId || '').trim() ||
    vacancyIdFromUrl(page.url()) ||
    vacancyIdFromUrl(opts.record?.url || '');
  const needResume = Boolean(preferredTitle || resumeHash);
  let profileResumeOk = !needResume;
  let resumeSelectAttempts = 0;
  const maxResumeSelectAttempts = 2;
  let resumeNotInEmployerList = false;
  const wizardOpts = { preferredResumeTitle: preferredTitle, skipResumeRadio: needResume };

  const syncPreferredResume = async () => {
    if (!needResume || profileResumeOk) return true;
    if (resumeNotInEmployerList) return false;
    if (resumeSelectAttempts >= maxResumeSelectAttempts) return false;
    resumeSelectAttempts++;
    const r = await ensurePreferredProfileResume(page, {
      preferredTitle,
      resumeHash,
      vacancyId,
      idealRole: opts.resumeTarget?.role,
      log,
    });
    profileResume = r.title;
    profileResumeOk = r.ok;
    if (r.fallbackUsed) {
      log(
        `[hh-response-modal] Использовано резюме из списка hh.ru (${r.pickedRole || '—'}), не идеал routing (${opts.resumeTarget?.role || '—'})`
      );
    }
    if (r.notInEmployerList) {
      resumeNotInEmployerList = true;
      return false;
    }
    if (!r.ok && resumeSelectAttempts >= maxResumeSelectAttempts) {
      log(
        `[hh-response-modal] Резюме не переключилось на «${preferredTitle || 'профиль'}» (сейчас: ${r.title || '—'}). ` +
          'Проверьте config/resume-routing.json (npm run devops:preview-resume-routing).'
      );
    }
    return r.ok;
  };

  if (needResume) {
    if (await isEmployerQuestionnaireWizardStep(page)) {
      profileResumeOk = true;
      log('[hh-response-modal] Шаг анкеты работодателя — резюме уже выбрано на предыдущем шаге');
    } else {
      await syncPreferredResume();
    }
  }

  let idleSteps = 0;
  let formRecoveries = 0;
  const maxFormRecoveries = 2;
  opts._finalApplyClicks = 0;
  const defaultWall =
    opts.respectQuestionnaire !== false && opts.record?.hhApply?.questionnaire ? 180_000 : 120_000;
  const wallDeadline = Date.now() + (opts.maxWallMs ?? defaultWall);

  for (let step = 0; step < maxSteps; step++) {
    if (Date.now() > wallDeadline) {
      log(
        `[hh-response-modal] Таймаут мастера отклика (${Math.round((opts.maxWallMs ?? defaultWall) / 1000)} с) — остановка`
      );
      break;
    }
    await dismissChromiumRestorePopup(page);
    await page.waitForTimeout(isFastMode() ? 90 : 280);
    let progressed = false;

    if (await isResponseAlreadySubmitted(page)) {
      return { submitted: true, label: 'already-submitted', letterInForm, resumeAttached, page };
    }

    if (needResume && !profileResumeOk) {
      if (await isEmployerQuestionnaireWizardStep(page)) {
        profileResumeOk = true;
      } else {
        await syncPreferredResume();
      }
      if (!profileResumeOk) {
        if (resumeNotInEmployerList || resumeSelectAttempts >= maxResumeSelectAttempts) {
          log(
            resumeNotInEmployerList
              ? `[hh-response-modal] Отправка отменена: «${preferredTitle}» недоступно для этой вакансии на hh.ru`
              : `[hh-response-modal] Отправка отменена: не выбрано резюме «${preferredTitle || resumeHash.slice(0, 8) + '…'}»`
          );
          return {
            submitted: false,
            letterInForm,
            resumeAttached,
            profileResume,
            resumeMismatch: true,
            resumeNotInEmployerList,
            page,
          };
        }
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
        if (await verifyCoverLetterInForm(page, opts.letter)) {
          letterInForm = true;
          log(`[hh-response-modal] Письмо в форме: ${filled}`);
        } else {
          log(
            `[hh-response-modal] Текст попал не в сопроводительное (${filled}) — письмо уйдёт в переписку после отклика`
          );
        }
        progressed = true;
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
      if (qAction === 'continue') {
        progressed = true;
        continue;
      }
      if (qAction === 'filled-ready') {
        const finished = await tryFinishQuestionnaireApply(page, opts, log, {
          letterInForm,
          resumeAttached,
          profileResume,
        });
        if (finished) return finished;
        progressed = true;
        continue;
      }
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
          page,
        };
      }
    }

    if (await isEmployerQuestionnaireWizardStep(page)) {
      const nextOnly = await clickEmployerQuestionnaireNext(page);
      if (nextOnly) {
        log('[hh-response-modal] Анкета: «Далее» перед отправкой');
        progressed = true;
        continue;
      }
      const emptyTextareas = await hasEmptyVisibleQuestionnaireTextareas(page);
      const unfilledRadios = await hasUnfilledEmployerQuestionnaireRadios(page);
      if (emptyTextareas || unfilledRadios) {
        if (
          canRunQuestionnaireAuto(opts) &&
          !opts._questionnaireRefillAttempted &&
          (emptyTextareas || unfilledRadios)
        ) {
          opts._questionnaireRefillAttempted = true;
          const refill = await tryAutoFillEmployerQuestionnaireWithWizard(page, {
            record: opts.record,
            cvText: opts.cvText || '',
            log,
            quiet: true,
          });
          if (refill.ok) {
            opts._questionnaireFilledThisPass = true;
            log('[hh-response-modal] Анкета: повторное заполнение пустых полей');
            progressed = true;
            continue;
          }
        }
        idleSteps = progressed ? 0 : idleSteps + 1;
        if (idleSteps >= 3) {
          log(
            unfilledRadios
              ? '[hh-response-modal] Анкета: не выбраны варианты ответа — отправка отменена'
              : '[hh-response-modal] Анкета: пустые поля — отправка отменена'
          );
          const qCheck = await detectEmployerQuestionnaire(page);
          return {
            submitted: false,
            questionnaire: qCheck,
            letterInForm,
            resumeAttached,
            profileResume,
            label: 'questionnaire-empty-fields',
            page,
          };
        }
        continue;
      }
    }

    if (opts._questionnaireFilledThisPass && !pendingLetter && !pendingResume) {
      await scrollQuestionnaireFields(page);
      const blocks = await questionnaireBlocksSubmit(page);
      if (!blocks) {
        const finished = await tryFinishQuestionnaireApply(page, opts, log, {
          letterInForm,
          resumeAttached,
          profileResume,
        });
        if (finished) return finished;
      } else if (!opts._submitBlockLogged) {
        opts._submitBlockLogged = true;
        const emptyTa = await hasEmptyVisibleQuestionnaireTextareas(page);
        const unfilled = await hasUnfilledEmployerQuestionnaireRadios(page);
        log(
          `[hh-response-modal] Отправка ждёт полей: пустые textarea=${emptyTa}, пустые radio=${unfilled}`
        );
      }
    }

    let submit = await findEnabledSubmitButton(page);
    if (!submit && opts._questionnaireFilledThisPass && !pendingLetter && !pendingResume) {
      const step = await advanceResponseWizardOneStep(page);
      if (step === 'next') {
        log('[hh-response-modal] Анкета: «Далее» после заполнения');
        await page.waitForTimeout(500);
        submit = await findEnabledSubmitButton(page);
        progressed = true;
      }
    }
    if (submit && !pendingLetter && !pendingResume) {
      await submit.locator.scrollIntoViewIfNeeded().catch(() => {});
      await submit.locator.click();
      progressed = true;
      await page.waitForTimeout(900);

      if (respectQuestionnaire) {
        const postQ = await waitAndDetectQuestionnaireAfterAction(page, 3500);
        const needsMoreAnswers = await questionnaireBlocksSubmit(page);

        if (postQ.detected && needsMoreAnswers && canRunQuestionnaireAuto(opts)) {
          const auto = await tryAutoFillEmployerQuestionnaireWithWizard(page, {
            record: opts.record,
            cvText: opts.cvText || '',
            log,
            quiet: Boolean(opts._questionnaireFillAttempted),
          });
          opts._questionnaireFillAttempted = true;
          if (auto.ok) {
            opts._questionnaireFilledThisPass = true;
            log('[hh-response-modal] Анкета: дозаполнение — повторная отправка');
            await page.waitForTimeout(400);
            progressed = true;
            continue;
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
            page,
          };
        }

        if (postQ.detected && !needsMoreAnswers) {
          opts._questionnaireFilledThisPass = true;
          const finished = await tryFinishQuestionnaireApply(page, opts, log, {
            letterInForm,
            resumeAttached,
            profileResume,
          });
          if (finished) return finished;
          if ((opts._finalApplyClicks || 0) >= 4) {
            log('[hh-response-modal] Отклик не подтверждён на hh.ru после нескольких попыток');
            return {
              submitted: false,
              questionnaire: postQ,
              letterInForm,
              resumeAttached,
              profileResume,
              label: 'apply-not-confirmed',
              page,
            };
          }
          progressed = true;
          continue;
        }

        const amb = await questionnaireOrStillOpen(page);
        if (amb?.questionnaire) {
          if (opts._questionnaireFilledThisPass && !(await questionnaireBlocksSubmit(page))) {
            const finished = await tryFinishQuestionnaireApply(page, opts, log, {
              letterInForm,
              resumeAttached,
              profileResume,
            });
            if (finished) return finished;
            if ((opts._finalApplyClicks || 0) >= 4) {
              log('[hh-response-modal] Отклик не подтверждён на hh.ru после нескольких попыток');
              return {
                submitted: false,
                questionnaire: amb.questionnaire,
                letterInForm,
                resumeAttached,
                profileResume,
                label: 'apply-not-confirmed',
                page,
              };
            }
            progressed = true;
            continue;
          }
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
            page,
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
            page,
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
          page,
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
          page,
        };
      }

      log(`[hh-response-modal] Клик «${submit.label}», ушли с формы отклика`);
      return {
        submitted: true,
        label: submit.label,
        letterInForm,
        resumeAttached,
        profileResume,
        page,
      };
    }
    if (submit && pendingResume) {
      await syncPreferredResume();
      progressed = true;
      continue;
    }
    if (submit && pendingLetter) {
      const action = await advanceResponseWizardOneStep(page, wizardOpts);
      if (action) {
        log(`[hh-response-modal] Мастер: ${action} (шаг ${step + 1}/${maxSteps})`);
        progressed = true;
        continue;
      }
    }

    if (opts.resumePdfPath && !resumeAttached) {
      const attached = await attachResumePdfInResponseModal(page, opts.resumePdfPath);
      if (attached) {
        resumeAttached = true;
        log('[hh-response-modal] PDF резюме прикреплено');
        progressed = true;
        continue;
      }
    }

    if (!needResume || profileResumeOk) {
      const action = await advanceResponseWizardOneStep(page, wizardOpts);
      if (action) {
        log(`[hh-response-modal] Мастер: ${action} (шаг ${step + 1}/${maxSteps})`);
        progressed = true;
        continue;
      }
    }

    if (
      !(await isVacancyResponseFormOpen(page)) &&
      formRecoveries < maxFormRecoveries &&
      !opts._questionnaireFilledThisPass
    ) {
      formRecoveries++;
      log(
        `[hh-response-modal] Форма не видна (url=${page.url().slice(0, 72)}) — повторное открытие ${formRecoveries}/${maxFormRecoveries}`
      );
      const reopen = await openVacancyResponseFlow(page, {
        humanClicks: opts.humanClicks,
        timeoutMs: 20_000,
        vacancyUrl: opts.record?.url || '',
        vacancyId,
        resumeHash,
        preferredResumeTitle: preferredTitle,
        log,
      });
      if (opts.context) {
        page = await focusVacancyResponsePage(opts.context, page, { log, closeOtherTabs: true });
      }
      if (reopen && reopen !== 'already-submitted') {
        progressed = true;
        continue;
      }
    }

    idleSteps = progressed ? 0 : idleSteps + 1;
    if (idleSteps >= 4) {
      log(
        `[hh-response-modal] Мастер без прогресса ${idleSteps} итераций (url=${page.url().slice(0, 80)}) — остановка`
      );
      break;
    }
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
          page,
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
          page,
        };
      }
      if (amb?.stillOpen) {
        return {
          submitted: false,
          letterInForm,
          resumeAttached,
          profileResume,
          label: 'form-still-open-final',
          page,
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
        page,
      };
    }
    return {
      submitted: true,
      label: submit.label,
      letterInForm,
      resumeAttached,
      profileResume,
      page,
    };
  }

  if (needResume && !profileResumeOk) {
    log(
      `[hh-response-modal] Отправка отменена: не выбрано резюме «${preferredTitle || process.env.HH_PROFILE_RESUME_HASH}»`
    );
  }

  return { submitted: false, letterInForm, resumeAttached, profileResume, page };
}
