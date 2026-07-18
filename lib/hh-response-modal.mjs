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
  titleMatchesPreferred,
} from './hh-resume-upload.mjs';
import { waitForActivePage } from './chromium-session.mjs';
import { assertHhLoggedIn, looksLikeLoginUrl } from './hh-session-check.mjs';
import { vacancyIdFromUrl } from './vacancy-parse.mjs';
import {
  clickEmployerQuestionnaireNext,
  detectEmployerQuestionnaire,
  getQuestionnaireSubmitBlockState,
  hasUnfilledEmployerQuestionnaireRadios,
  isEmployerQuestionnaireWizardStep,
  questionnaireBlocksSubmit,
  scrollQuestionnaireFields,
  waitAndDetectQuestionnaireAfterAction,
} from './hh-employer-questionnaire.mjs';
import { detectEmployerQuestionnaireWithHintRetry } from './questionnaire-hint-reprobe.mjs';
import {
  tryAutoFillEmployerQuestionnaireWithWizard,
  recordHasDashboardQuestionnaireAnswers,
  recordHasAuthoritativeQuestionnaireAnswers,
  getDashboardQuestionnaireAnswers,
} from './hh-questionnaire-auto.mjs';
import { questionnaireLeadGateBlocks } from './questionnaire-lead-gate.mjs';
import { evaluatePresubmitGuard } from './apply-presubmit-guard.mjs';
import { detectResumeVisibilityBlockOnResponseForm } from './hh-resume-visibility.mjs';
import {
  detectHhVacancySiteState,
  HH_SITE_STATES,
  hhSiteStateBlocksApply,
} from './hh-vacancy-response-state.mjs';

function vacancyRecordHasEmployerQuestionnaire(record) {
  const q = record?.hhApply?.questionnaire;
  return Boolean(q?.savedAnswers?.length || q?.suggestedAnswers?.length || q?.questions?.length);
}

/** POST/PUT отклика на hh.ru — без popup анкеты и аналитики. */
function isHhApplySubmitNetworkResponse(response) {
  const url = response.url();
  if (!['POST', 'PUT'].includes(response.request().method())) return false;
  if (/vacancy_response\/popup|tracker|analytics|metric|mail\.ru/i.test(url)) return false;
  return /vacancy_response|negotiation|\/response\/|application/i.test(url);
}

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
  let qCheck = await detectEmployerQuestionnaire(page);
  if (!qCheck.detected) return null;

    if (qCheck.hintOnly) {
      log('[hh-response-modal] Подсказка анкеты без полей — шаги «Далее» после письма…');
      const wizardOpts = opts.wizardOpts || {};
      const vacancyId = String(opts.vacancyId || opts.record?.vacancyId || '').trim();
      const resumeHash = String(
        opts.resumeHash || opts.record?.resumeRoutingOverride?.hash || ''
      ).trim();

      if (/applicant\/vacancy_response/i.test(page.url()) && opts.letterInForm) {
        const proceeded = await clickVacancyResponseProceedToQuestionnaire(page, log);
        if (proceeded === 'submitted-listing') {
          log('[hh-response-modal] Отклик зарегистрирован после «Откликнуться» (ранний proceed)');
          return 'submitted-listing';
        }
        if (proceeded) {
          await page.waitForTimeout(900);
          qCheck = await detectEmployerQuestionnaire(page);
        }
      }

      if (recordHasAuthoritativeQuestionnaireAnswers(opts.record) && vacancyId && resumeHash) {
        const urlHash = page.url().match(/[?&]resumeId=([a-f0-9]{16,})/i)?.[1] || '';
        if (urlHash !== resumeHash) {
          log('[hh-response-modal] Анкета: перезагрузка формы с resumeId для загрузки вопросов');
          await reloadVacancyResponseWithResume(page, { vacancyId, resumeHash, log });
          await page.waitForTimeout(900);
          qCheck = await detectEmployerQuestionnaire(page);
        }
      }
      for (let hi = 0; hi < 12; hi++) {
        const moved =
          (await clickEmployerQuestionnaireNext(page)) ||
          (await advanceResponseWizardOneStep(page, wizardOpts));
        if (!moved) break;
        await page.waitForTimeout(800);
        await scrollQuestionnaireFields(page);
        qCheck = await detectEmployerQuestionnaire(page);
        if (qCheck.detected && !qCheck.hintOnly && (qCheck.questions?.length || 0) > 0) {
          log(`[hh-response-modal] Вопросы анкеты после «Далее» (${qCheck.questions.length})`);
          break;
        }
      }
      if (qCheck.hintOnly) {
        if (recordHasAuthoritativeQuestionnaireAnswers(opts.record)) {
          log(
            '[hh-response-modal] Анкета probed в дашборде, поля на форме не появились — отправка отменена'
          );
          return 'stop';
        }
        const bodySnippet = await page
          .locator('main, [role="dialog"], body')
          .first()
          .innerText({ timeout: 2500 })
          .catch(() => '');
        const requiresAnswers =
          /для\s+отклика\s+необходимо\s+ответить|необходимо\s+ответить\s+на\s+несколько/i.test(
            bodySnippet
          );
        const letterReady = Boolean(opts.letterInForm);
        if (requiresAnswers && letterReady) {
          // У части вакансий «Откликнуться» после письма сразу регистрирует отклик (без DOM-полей).
          const proceeded = await clickVacancyResponseProceedToQuestionnaire(page, log);
          if (proceeded === 'submitted-listing') {
            log('[hh-response-modal] Отклик зарегистрирован после «Откликнуться» (hint без полей)');
            return 'submitted-listing';
          }
          if (proceeded === 'proceed-questionnaire') {
            qCheck = await detectEmployerQuestionnaire(page);
            if (!qCheck.hintOnly && (qCheck.questions?.length || 0) > 0) {
              return null; // дальше обычный auto-fill
            }
          }
          // Visibility / disabled submit / нет перехода — не крутить wall 300 с
          if (opts._hintProceedTried) {
            log(
              '[hh-response-modal] Анкета hint без полей после письма — отправка отменена (hint-blocked)'
            );
            opts._presubmitBlocked = 'questionnaire_hint';
            return 'stop';
          }
          opts._hintProceedTried = true;
          return 'filled-ready';
        }
        if (requiresAnswers && !letterReady) {
          // Сначала письмо, потом «Откликнуться»
          return null;
        }
        log('[hh-response-modal] Только подсказка без полей — пробуем отправить отклик');
        for (let hi = 0; hi < 12; hi++) {
          if (await findEnabledSubmitButton(page)) break;
          const moved = await advanceResponseWizardOneStep(page, wizardOpts);
          if (!moved) break;
          await page.waitForTimeout(450);
        }
        return 'filled-ready';
      }
    }

  if (!canRunQuestionnaireAuto(opts)) return 'stop';

  if (opts._questionnaireFilledThisPass && !(await questionnaireBlocksSubmit(page))) {
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
    const saved = getDashboardQuestionnaireAnswers(opts.record);
    const leadGate = questionnaireLeadGateBlocks(opts.record, auto.fill, saved);
    if (leadGate.blocks) {
      log(`[hh-response-modal] ${leadGate.reason}`);
      opts._presubmitBlocked = 'lead_questionnaire';
      opts._presubmitReason = leadGate.reason;
      return 'stop';
    }
    if (
      auto.fill?.blocksSubmit ||
      auto.fill?.unfilledRadios ||
      Number(auto.fill?.choiceFailures || 0) > 0
    ) {
      const reason =
        auto.fill?.blockReasons?.join(', ') ||
        'unfilled-radios';
      log(`[hh-response-modal] Анкета неполная (${reason}) — отправка отменена`);
      opts._presubmitBlocked = 'questionnaire_incomplete';
      opts._presubmitReason = reason;
      opts._questionnaireIncomplete = true;
      return 'stop';
    }
    opts._questionnaireFilledThisPass = true;
    log(
      `[hh-response-modal] Анкета из дашборда (${auto.fill?.filledOnPage ?? auto.fill?.filledCount ?? '?'}/${auto.fill?.visibleOnPage ?? auto.questionnaire?.questions?.length ?? qCheck.questions.length}) — «Далее» или «Отправить»`
    );
    await scrollQuestionnaireFields(page);
    await page.waitForTimeout(400);
    if (await questionnaireBlocksSubmit(page)) {
      const block = await getQuestionnaireSubmitBlockState(page);
      log(
        `[hh-response-modal] Авто-анкета: partial submit запрещён (${block.reasons.join(', ') || 'partial-fields'})`
      );
      opts._presubmitBlocked = 'questionnaire_incomplete';
      opts._questionnaireIncomplete = true;
      return 'stop';
    }
    return 'filled-ready';
  }

  if (auto.error === 'questionnaire_incomplete' || auto.fill?.unfilledRadios) {
    opts._presubmitBlocked = 'questionnaire_incomplete';
    opts._questionnaireIncomplete = true;
    opts._presubmitReason =
      auto.fill?.blockReasons?.join(', ') || 'unfilled-radios';
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

/** @param {import('playwright').Page} page */
async function questionnaireOrStillOpen(page) {
  if (await isResponseAlreadySubmitted(page)) return null;
  const q = await detectEmployerQuestionnaire(page);
  if (q.detected && (await questionnaireBlocksSubmit(page))) {
    return { questionnaire: q };
  }
  if (await isVacancyResponseFormOpen(page)) {
    const complete = await waitForVacancyApplyComplete(page, isFastMode() ? 5000 : 8000);
    if (complete.ok) return null;
    const formError = complete.formError || (await detectHhResponseFormError(page));
    return { stillOpen: true, formError };
  }
  return null;
}

/** Подтверждение отклика означает «уже откликали», а не новую отправку.
 * submit-disabled / send-disabled — wizard blocked, НЕ repeat (APPLY-CHAIN-STABLE). */
export function isRepeatApplyCompleteLabel(label) {
  return /already-applied|already-submitted|submit-gone/i.test(String(label || ''));
}

/** Закрыть «Восстановить страницы?» и похожие оверлеи Chromium. */
export async function dismissChromiumRestorePopup(page) {
  const infobar = page.getByText(/восстановить страниц/i).first();
  if (await infobar.isVisible({ timeout: 350 }).catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    const close = page
      .locator('[role="button"][aria-label*="акрыть" i], [aria-label="Close" i]')
      .first();
    if (await close.isVisible({ timeout: 350 }).catch(() => false)) {
      await close.click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(300);
    return true;
  }
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
        // Disabled submit ≠ отклик ушёл (ЗТК / wizard) — не ok
        return { ok: false, wizardBlocked: true, label: 'submit-disabled' };
      }
    }
    if (sendVisible && (await sendBtn.isDisabled().catch(() => false))) {
      return { ok: false, wizardBlocked: true, label: 'send-disabled' };
    }
    const chatLink = page.getByRole('link', { name: /перейти в переписку|отклик и переписка/i }).first();
    if (await chatLink.isVisible({ timeout: 250 }).catch(() => false)) {
      return { ok: true, label: 'chat-link' };
    }
    const formError = await detectHhResponseFormError(page);
    if (formError) {
      return { ok: false, formError };
    }
    await page.waitForTimeout(450);
  }
  const formError = await detectHhResponseFormError(page);
  return formError ? { ok: false, formError } : { ok: false };
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

/** Ошибка hh.ru на форме отклика (не «резюме не выбрано»). */
async function detectHhResponseFormError(page) {
  const bodyScan = await page
    .evaluate(() => {
      const root =
        document.querySelector('[data-qa="vacancy-response-popup-form"]') ||
        document.querySelector('main') ||
        document.body;
      const t = root?.innerText || '';
      const m = t.match(/произошла ошибка[^\n.]{0,120}/i);
      return m ? m[0].replace(/\s+/g, ' ').trim() : '';
    })
    .catch(() => '');
  if (bodyScan) return bodyScan;

  const inline = page.getByText(/произошла ошибка/i).first();
  if (await inline.isVisible({ timeout: 500 }).catch(() => false)) {
    const text = String(await inline.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  const errs = await readVisibleFormErrors(page);
  return (
    errs.find((e) =>
      /произошла ошибка|попробуйте ещё раз|слишком много откликов|отклик не отправлен|не удалось отправить/i.test(
        e
      )
    ) || null
  );
}

function isTransientHhFormError(message) {
  return /произошла ошибка|попробуйте ещё раз/i.test(String(message || ''));
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
  if (opts._questionnaireIncomplete || opts._presubmitBlocked === 'questionnaire_incomplete') {
    const guard = evaluatePresubmitGuard({
      questionnaireIncomplete: true,
      questionnaireIncompleteReason: opts._presubmitReason,
    });
    log(`[hh-response-modal] ${guard.reason}`);
    return {
      submitted: false,
      label: guard.code,
      presubmitBlocked: guard.code,
      letterInForm: state.letterInForm,
      resumeAttached: state.resumeAttached,
      profileResume: state.profileResume,
      page,
    };
  }

  const block = await getQuestionnaireSubmitBlockState(page);
  if (block.blocks) {
    const reason = block.reasons.join(', ') || 'partial-fields';
    log(`[hh-response-modal] Анкета: отправка заблокирована (${reason})`);
    if (block.reasons.includes('external-test-required')) {
      log('[hh-response-modal] Пустое поле со ссылкой на внешний тест — нужен ручной ответ');
    } else if (block.audit && block.audit.visibleInputs > block.audit.filledInputs) {
      log(
        `[hh-response-modal] Заполнено ${block.audit.filledInputs}/${block.audit.visibleInputs} текстовых полей — partial submit запрещён`
      );
    } else if (block.reasons.includes('unfilled-radios')) {
      log('[hh-response-modal] Анкета: не выбраны варианты ответа — отправка отменена');
    }
    // null — цикл мастера может нажать «Далее»; финальный клик ниже тоже проверяет radio
    return null;
  }

  if (await hasUnfilledEmployerQuestionnaireRadios(page)) {
    log('[hh-response-modal] Анкета: не выбраны варианты ответа — отправка отменена');
    return null;
  }

  if (opts.letter?.trim()) {
    await expandCoverLetterSectionIfPresent(page);
    const letterOk =
      state.letterInForm === true || (await verifyCoverLetterInForm(page, opts.letter).catch(() => false));
    if (!letterOk) {
      const guard = evaluatePresubmitGuard({ letterRequired: true, letterInForm: false });
      log(`[hh-response-modal] ${guard.reason}`);
      return {
        submitted: false,
        label: guard.code,
        presubmitBlocked: guard.code,
        letterInForm: false,
        resumeAttached: state.resumeAttached,
        profileResume: state.profileResume,
        page,
      };
    }
    state.letterInForm = true;
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
      (r) => isHhApplySubmitNetworkResponse(r),
      { timeout: 25_000 }
    )
    .catch(() => null);

  const waitQuestionnairePopup = page
    .waitForResponse(
      (r) => /vacancy_response\/popup/i.test(r.url()) && r.request().method() === 'POST',
      { timeout: 25_000 }
    )
    .catch(() => null);

  if (!(await clickFinalVacancyResponseSubmit(page, log))) {
    log('[hh-response-modal] Не удалось нажать «Отправить отклик» / «Откликнуться»');
    const qa = page.locator('[data-qa="vacancy-response-submit-button"]').last();
    const disabled = await qa.isVisible({ timeout: 200 }).catch(() => false)
      ? await qa.isDisabled().catch(() => false)
      : false;
    const guard = evaluatePresubmitGuard({ submitDisabled: disabled, submitVisible: disabled });
    if (!guard.allow) {
      return {
        submitted: false,
        label: guard.code,
        wizardBlocked: true,
        presubmitBlocked: guard.code,
        letterInForm: state.letterInForm,
        resumeAttached: state.resumeAttached,
        profileResume: state.profileResume,
        page,
      };
    }
    return null;
  }
  opts._finalApplyClicks = (opts._finalApplyClicks || 0) + 1;

  const popupResp = await waitQuestionnairePopup;
  if (popupResp && popupResp.status() >= 400) {
    const body = (await popupResp.text().catch(() => '')).slice(0, 120);
    log(`[hh-response-modal] Анкета hh.ru: popup HTTP ${popupResp.status()} (${body || 'error'})`);
    return {
      submitted: false,
      label: 'questionnaire-popup-failed',
      questionnairePopupFailed: true,
      letterInForm: state.letterInForm,
      resumeAttached: state.resumeAttached,
      profileResume: state.profileResume,
      page,
    };
  }

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
    if (await isResponseAlreadySubmitted(page)) return false;
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
  const wantHash = String(opts.resumeHash || '').trim();
  const responseUrl = buildVacancyResponseUrl(page, '', {
    vacancyId: opts.vacancyId,
    vacancyUrl: opts.vacancyUrl || '',
    resumeHash: wantHash,
  });
  if (!responseUrl) return null;

  log('[hh-response-modal] Прямой переход на форму отклика (vacancy_response)');
  await page.goto(responseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(isFastMode() ? 400 : 1000);
  if (looksLikeLoginUrl(page.url())) await assertHhLoggedIn(page);
  const { ensureApplicantOnboardingDismissed } = await import('./hh-applicant-onboarding.mjs');
  await ensureApplicantOnboardingDismissed(page, { log });

  const knownVacancyId = String(opts.vacancyId || '').trim();
  if (wantHash && knownVacancyId) {
    const urlHash = page.url().match(/[?&]resumeId=([a-f0-9]{16,})/i)?.[1] || '';
    if (urlHash !== wantHash) {
      log('[hh-response-modal] Форма без нужного resumeId — перезагрузка');
      await reloadVacancyResponseWithResume(page, {
        vacancyId: knownVacancyId,
        resumeHash: wantHash,
        log,
      });
    }
  }

  if (await waitForVacancyResponseForm(page, 10_000)) return 'goto-vacancy_response-direct';
  if (await isEmployerQuestionnaireWizardStep(page)) return 'goto-vacancy_response-questionnaire';
  const postGoto = await detectHhVacancySiteState(page);
  if (hhSiteStateBlocksApply(postGoto.state)) return 'already-submitted';
  if (await isResponseAlreadySubmitted(page)) return 'already-submitted';
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
        resumeHash:
          opts.resumeHash ||
          opts.record?.resumeRoutingOverride?.hash ||
          '',
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
    resumeHash: String(opts.resumeHash || '').trim(),
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
  const { ensureApplicantOnboardingDismissed } = await import('./hh-applicant-onboarding.mjs');
  await ensureApplicantOnboardingDismissed(page, { log });

  if (await waitForVacancyResponseForm(page, isFastMode() ? 8_000 : 10_000)) {
    return 'goto-vacancy_response';
  }

  const postGoto = await detectHhVacancySiteState(page);
  if (hhSiteStateBlocksApply(postGoto.state)) {
    return 'already-submitted';
  }

  const wantHash = String(opts.resumeHash || '').trim();
  const preferredTitle = String(opts.preferredResumeTitle || '').trim();
  if (wantHash && knownVacancyId && !(await isEmployerQuestionnaireWizardStep(page))) {
    const urlHash = page.url().match(/[?&]resumeId=([a-f0-9]{16,})/i)?.[1] || '';
    if (urlHash !== wantHash) {
      log('[hh-response-modal] URL отклика без нужного resumeId — перезагрузка');
      await reloadVacancyResponseWithResume(page, {
        vacancyId: knownVacancyId,
        resumeHash: wantHash,
        log,
      });
    } else {
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
  }

  if (await isResponseAlreadySubmitted(page)) return 'already-submitted';

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
  if (await questionnaireBlocksSubmit(page)) {
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
 * На /vacancy_response «Откликнуться» часто открывает анкету (не финальный submit).
 * @param {import('playwright').Page} page
 * @param {(msg: string) => void} [log]
 * @returns {Promise<'proceed-questionnaire'|null>}
 */
export async function clickVacancyResponseProceedToQuestionnaire(page, log = () => {}) {
  if (!/applicant\/vacancy_response/i.test(page.url())) return null;
  const q = await detectEmployerQuestionnaire(page);
  if (!q.hintOnly) return null;

  const hasFinalSubmit = await page
    .getByRole('button', { name: /отправить отклик/i })
    .first()
    .isVisible({ timeout: 300 })
    .catch(() => false);
  if (hasFinalSubmit) return null;

  const proceedNames = [/^откликнуться повторно$/i, /^откликнуться$/i];
  let proceedBtn = null;
  for (const nameRe of proceedNames) {
    const btn = page.getByRole('button', { name: nameRe }).last();
    if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
      if (!(await btn.isDisabled().catch(() => true))) {
        proceedBtn = btn;
        break;
      }
    }
  }
  if (!proceedBtn) return null;

  // Анти-naked: без текста в письме не жать «Откликнуться» (даже если не помечено «обязательное»).
  const letterToggle = page.locator('[data-qa="vacancy-response-letter-toggle"]').first();
  const letterTa = page.locator('textarea[data-qa*="letter" i], textarea[name*="letter" i]').first();
  let letterValue = '';
  if (await letterTa.isVisible({ timeout: 400 }).catch(() => false)) {
    letterValue = (await letterTa.inputValue().catch(() => '')) || '';
  }
  const hasLetterUi =
    (await letterToggle.isVisible({ timeout: 300 }).catch(() => false)) ||
    (await letterTa.isVisible({ timeout: 300 }).catch(() => false)) ||
    /сопроводительн/i.test(
      ((await page.locator('main').innerText().catch(() => '')) || '').slice(0, 1200),
    );
  if (hasLetterUi && !String(letterValue).trim()) {
    log('[hh-response-modal] «Откликнуться» отложено: письмо ещё не в поле');
    return null;
  }

  await proceedBtn.scrollIntoViewIfNeeded().catch(() => {});
  const popupWait = page
    .waitForResponse(
      (r) => /vacancy_response\/popup/i.test(r.url()) && r.request().method() === 'POST',
      { timeout: 12_000 }
    )
    .catch(() => null);
  await proceedBtn.click({ timeout: 8000 }).catch(() => {});
  const popupResp = await popupWait;
  if (popupResp) {
    const st = popupResp.status();
    const body = (await popupResp.text().catch(() => '')).slice(0, 80);
    log(`[hh-response-modal] popup анкеты HTTP ${st}${body ? `: ${body}` : ''}`);
    if (st >= 400) {
      return 'popup-failed';
    }
  }
  log('[hh-response-modal] «Откликнуться» → переход к анкете работодателя');
  await page.waitForTimeout(isFastMode() ? 700 : 1500);

  // Иногда «Откликнуться» сразу регистрирует отклик (hint без DOM-полей) — не путать с анкетой.
  const url = page.url();
  const blob = ((await page.locator('main, body').first().innerText().catch(() => '')) || '').replace(
    /\s+/g,
    ' ',
  );
  if (
    /\/vacancy\/\d/i.test(url) &&
    /вы\s+откликнулись|отклик\s+другим\s+резюме/i.test(blob)
  ) {
    log('[hh-response-modal] После «Откликнуться»: отклик уже на hh (listing) — не анкета');
    return 'submitted-listing';
  }

  const dialog = page.locator('[role="dialog"], [data-qa="vacancy-response-popup-form"]').first();
  if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    log('[hh-response-modal] Открылась модалка анкеты');
  }
  return 'proceed-questionnaire';
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

  const log = opts.log || (() => {});

  if (onResponsePage && !opts._proceedAttempted) {
    // Не жать «Откликнуться» из advance — только после letterInForm в handleQuestionnaire.
    // Иначе hint-only путь даёт already_applied без сопроводительного.
    opts._proceedAttempted = true;
  }

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
 * @returns {Promise<{ submitted: boolean, label?: string, letterInForm?: boolean, resumeAttached?: boolean, resumeAttachReason?: string, profileResume?: string, profileResumeHash?: string, questionnaire?: object }>}
 */
export async function completeVacancyResponseForm(page, opts = {}) {
  const log = opts.log || (() => {});
  const maxSteps = opts.maxSteps ?? 24;
  let letterInForm = false;
  let resumeAttached = false;
  /** @type {string | undefined} */
  let resumeAttachReason;
  let profileResume = null;
  let profileResumeHash = null;

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
  const maxResumeSelectAttempts = 4;
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
    if (r.hash) profileResumeHash = r.hash;
    profileResumeOk = r.ok;
    if (r.emptyResumeList || r.reason === 'empty-list') {
      opts._presubmitBlocked = 'empty_resume_list';
      opts._presubmitReason = 'список резюме на форме отклика пуст — отправка запрещена';
      resumeNotInEmployerList = true;
      return false;
    }
    if (r.wrongResume || r.reason === 'wrong-resume-only' || r.reason === 'wrong-resume-fallback') {
      opts._presubmitBlocked = 'wrong_resume';
      opts._presubmitReason =
        r.reason === 'wrong-resume-only'
          ? `hh предлагает только чужое резюме «${r.title || '—'}» — отправка запрещена (иначе дубль с неверным CV)`
          : `cross-track резюме «${r.title || '—'}» вместо «${preferredTitle || opts.resumeTarget?.role || '—'}» — отправка запрещена`;
      resumeNotInEmployerList = true;
      profileResumeOk = false;
      return false;
    }
    if (r.fallbackUsed) {
      const { resumeRolesCompatible, isCrossTrackResumeTitle } = await import('./hh-resume-picker.mjs');
      const ideal = String(opts.resumeTarget?.role || '').trim();
      const picked = String(r.pickedRole || '').trim();
      const cross =
        isCrossTrackResumeTitle(r.title || '', ideal || 'devops') ||
        (ideal && picked && !resumeRolesCompatible(ideal, picked) && picked !== 'compact-preselected');
      if (cross) {
        opts._presubmitBlocked = 'wrong_resume';
        opts._presubmitReason = `fallback резюме «${r.title || '—'}» несовместимо с ${ideal || 'ideal'} — стоп`;
        resumeNotInEmployerList = true;
        profileResumeOk = false;
        return false;
      }
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
      // Анкета уже после sticky резюме — сверка двусторонняя (Альтуэра + Биржа 18.07).
      const curTitle = await readCurrentResponseResumeTitle(page).catch(() => '');
      const { questionnaireStepResumeBlocksSubmit } = await import('./hh-resume-picker.mjs');
      const ideal = opts.resumeTarget?.role || '';
      const gate = questionnaireStepResumeBlocksSubmit({
        curTitle,
        preferredTitle,
        idealRole: ideal,
      });
      if (gate.block) {
        log(
          `[hh-response-modal] STOP на шаге анкеты: в форме «${curTitle || '—'}», нужно «${preferredTitle || ideal}» (${gate.reason})`
        );
        return {
          submitted: false,
          letterInForm: false,
          resumeAttached: false,
          profileResume: curTitle,
          resumeMismatch: true,
          resumeNotInEmployerList: true,
          presubmitBlocked: 'wrong_resume',
          label: 'wrong_resume',
          page,
        };
      }
      profileResumeOk = true;
      profileResume = curTitle || profileResume;
      log('[hh-response-modal] Шаг анкеты работодателя — резюме уже выбрано на предыдущем шаге');
    } else {
      await syncPreferredResume();
    }
  }

  {
    const visBlock = await detectResumeVisibilityBlockOnResponseForm(page);
    if (visBlock?.blocked) {
      log(`[hh-response-modal] ${visBlock.message}`);
      return {
        submitted: false,
        letterInForm: false,
        resumeAttached: false,
        profileResume,
        emptyResumeList: false,
        presubmitBlocked: 'resume_visibility',
        label: 'resume_visibility',
        page,
      };
    }
  }

  let idleSteps = 0;
  let formRecoveries = 0;
  const maxFormRecoveries = 2;
  opts._finalApplyClicks = 0;
  const defaultWall =
    opts.respectQuestionnaire !== false && opts.record?.hhApply?.questionnaire ? 180_000 : 180_000;
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
          if (opts._presubmitBlocked === 'empty_resume_list') {
            log(`[hh-response-modal] ${opts._presubmitReason}`);
            return {
              submitted: false,
              letterInForm,
              resumeAttached,
              profileResume,
              emptyResumeList: true,
              presubmitBlocked: 'empty_resume_list',
              label: 'empty_resume_list',
              page,
            };
          }
          if (opts._presubmitBlocked === 'wrong_resume') {
            log(`[hh-response-modal] ${opts._presubmitReason}`);
            return {
              submitted: false,
              letterInForm,
              resumeAttached,
              profileResume,
              resumeMismatch: true,
              resumeNotInEmployerList: true,
              wrongResume: true,
              presubmitBlocked: 'wrong_resume',
              label: 'wrong_resume',
              page,
            };
          }
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

    const qHint = await detectEmployerQuestionnaire(page);
    if (qHint.hintOnly && !opts._hintWizardAdvanced) {
      // Magritte: текст «необходимо ответить» часто висит до письма + «Откликнуться».
      // Сначала письмо — иначе hintOnly_timeout убивает отклик без fill.
      if (opts.letter && !letterInForm) {
        log(
          '[hh-response-modal] Подсказка про вопросы без полей — сначала сопроводительное, потом анкета'
        );
      } else {
        opts._hintWizardAdvanced = true;
        log('[hh-response-modal] Подсказка про вопросы без полей — пробуем шаги «Далее» + re-probe');
        for (let hi = 0; hi < 5; hi++) {
          const moved = await advanceResponseWizardOneStep(page, wizardOpts);
          if (!moved) break;
          await page.waitForTimeout(500);
          const qAfter = await detectEmployerQuestionnaire(page);
          if ((qAfter.questions?.length || 0) > 0) {
            log(`[hh-response-modal] Вопросы появились после «Далее» (${qAfter.questions.length})`);
            break;
          }
        }
        const reprobe = await detectEmployerQuestionnaireWithHintRetry(
          page,
          detectEmployerQuestionnaire,
          {
            maxAttempts: 3,
            waitMs: isFastMode() ? 150 : 700,
            log,
          }
        );
        if (reprobe.questionnaireFail === 'hintOnly_timeout') {
          // После письма Magritte часто отдаёт поля только по клику «Откликнуться».
          if (letterInForm) {
            log(
              '[hh-response-modal] hintOnly после письма — жмём «Откликнуться», ждём поля анкеты'
            );
            const proceeded = await clickVacancyResponseProceedToQuestionnaire(page, log);
            if (proceeded === 'submitted-listing') {
              return {
                submitted: true,
                label: 'submitted-listing-after-hint',
                letterInForm: true,
                resumeAttached,
                profileResume,
                page,
              };
            }
            await page.waitForTimeout(900);
            const qAfterClick = await detectEmployerQuestionnaire(page);
            if ((qAfterClick.questions?.length || 0) > 0) {
              log(`[hh-response-modal] Вопросы после «Откликнуться»: ${qAfterClick.questions.length}`);
              progressed = true;
              continue;
            }
            // Полей всё ещё нет — не голый submit: стоп
          }
          log('[hh-response-modal] hintOnly_timeout — отправка отменена (поля анкеты не появились)');
          return {
            submitted: false,
            letterInForm,
            resumeAttached,
            profileResume,
            questionnaireFail: 'hintOnly_timeout',
            label: 'hintOnly_timeout',
            page,
          };
        }
        progressed = true;
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
          // Не ставить letterInForm на partial — иначе submit → голый отклик (APPLY-CHAIN-STABLE)
          log(
            `[hh-response-modal] Текст в поле, но verifyCoverLetterInForm=false (${filled}) — ещё попытки fill`
          );
        }
        progressed = true;
        continue;
      }
    }

    if (opts.letter?.trim() && !letterInForm && letterFillAttempts >= maxLetterFillAttempts) {
      log(
        `[hh-response-modal] Письмо не в форме после ${maxLetterFillAttempts} попыток — отправка отменена (анти-naked)`
      );
      return {
        submitted: false,
        letterInForm: false,
        resumeAttached,
        profileResume,
        presubmitBlocked: 'letter_missing',
        label: 'letter_missing',
        page,
      };
    }

    const pendingLetter = Boolean(opts.letter?.trim()) && !letterInForm;
    const pendingResume = needResume && !profileResumeOk;
    const respectQuestionnaire = opts.respectQuestionnaire !== false;
    if (respectQuestionnaire && !pendingLetter && !pendingResume) {
      const qAction = await handleQuestionnaireOnPage(
        page,
        { ...opts, letterInForm, vacancyId, resumeHash, wizardOpts },
        log,
        'questionnaire-before-submit'
      );
      if (qAction === 'submitted-listing') {
        return {
          submitted: true,
          letterInForm,
          resumeAttached,
          profileResume,
          profileResumeHash: profileResumeHash || undefined,
          label: 'submitted-via-otkliknutsya',
          page,
        };
      }
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
        const leadBlocked = opts._presubmitBlocked === 'lead_questionnaire';
        const hintBlocked = opts._presubmitBlocked === 'questionnaire_hint';
        const qIncomplete = opts._presubmitBlocked === 'questionnaire_incomplete';
        log(
          leadBlocked
            ? `[hh-response-modal] ${opts._presubmitReason || 'lead-анкета — отправка отменена'}`
            : hintBlocked
              ? `[hh-response-modal] ${opts._presubmitReason || 'анкета hint — отправка отменена'}`
              : qIncomplete
                ? `[hh-response-modal] ${opts._presubmitReason || 'анкета: radio/поля неполны — отправка отменена'}`
            : `[hh-response-modal] Анкета работодателя (${qCheck.questions?.length || 0} вопр.) — отправка отменена`
        );
        return {
          submitted: false,
          questionnaire: qCheck,
          letterInForm,
          resumeAttached,
          profileResume,
          label: leadBlocked
            ? 'lead_questionnaire'
            : hintBlocked
              ? 'questionnaire_hint'
              : qIncomplete
                ? 'questionnaire_incomplete'
              : 'questionnaire-before-submit',
          presubmitBlocked: leadBlocked
            ? 'lead_questionnaire'
            : hintBlocked
              ? 'questionnaire_hint'
              : qIncomplete
                ? 'questionnaire_incomplete'
                : 'questionnaire',
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
      const blocksSubmit = await questionnaireBlocksSubmit(page);
      if (blocksSubmit) {
        if (
          canRunQuestionnaireAuto(opts) &&
          !opts._questionnaireRefillAttempted
        ) {
          opts._questionnaireRefillAttempted = true;
          const refill = await tryAutoFillEmployerQuestionnaireWithWizard(page, {
            record: opts.record,
            cvText: opts.cvText || '',
            log,
            quiet: true,
          });
          if (
            refill.ok &&
            !refill.fill?.blocksSubmit &&
            !refill.fill?.unfilledRadios &&
            !(Number(refill.fill?.choiceFailures || 0) > 0)
          ) {
            opts._questionnaireFilledThisPass = true;
            log('[hh-response-modal] Анкета: повторное заполнение пустых полей');
            progressed = true;
            continue;
          }
          if (refill.fill?.unfilledRadios || Number(refill.fill?.choiceFailures || 0) > 0) {
            opts._questionnaireIncomplete = true;
            opts._presubmitBlocked = 'questionnaire_incomplete';
          }
        }
        idleSteps = progressed ? 0 : idleSteps + 1;
        if (idleSteps >= 3) {
          const block = await getQuestionnaireSubmitBlockState(page);
          log(
            block.reasons.includes('unfilled-radios')
              ? '[hh-response-modal] Анкета: не выбраны варианты ответа — отправка отменена'
              : block.reasons.includes('external-test-required')
                ? '[hh-response-modal] Анкета: пустое поле внешнего теста — отправка отменена'
                : `[hh-response-modal] Анкета: partial submit запрещён (${block.reasons.join(', ') || 'partial-fields'})`
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
        const block = await getQuestionnaireSubmitBlockState(page);
        const audit = block.audit;
        log(
          `[hh-response-modal] Отправка ждёт полей: ${block.reasons.join(', ') || 'partial-fields'}` +
            (audit && audit.visibleInputs
              ? ` (текст ${audit.filledInputs}/${audit.visibleInputs}, radio=${audit.unfilledRadios ? 'пусто' : 'ok'})`
              : '')
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
      if (respectQuestionnaire) {
        const qBlocked =
          opts._questionnaireIncomplete ||
          opts._presubmitBlocked === 'questionnaire_incomplete' ||
          (await questionnaireBlocksSubmit(page)) ||
          (await hasUnfilledEmployerQuestionnaireRadios(page));
        if (qBlocked) {
          const block = await getQuestionnaireSubmitBlockState(page);
          const reason =
            opts._presubmitReason ||
            block.reasons?.join(', ') ||
            'unfilled-radios';
          const guard = evaluatePresubmitGuard({
            questionnaireIncomplete: true,
            questionnaireIncompleteReason: reason,
          });
          log(`[hh-response-modal] ${guard.reason} — финальный клик отменён`);
          return {
            submitted: false,
            label: guard.code,
            presubmitBlocked: guard.code,
            letterInForm,
            resumeAttached,
            resumeAttachReason,
            profileResume,
            page,
          };
        }
      }
      await submit.locator.scrollIntoViewIfNeeded().catch(() => {});
      await submit.locator.click();
      progressed = true;
      await page.waitForTimeout(isFastMode() ? 1200 : 1800);

      const applyComplete = await waitForVacancyApplyComplete(
        page,
        isFastMode() ? 10_000 : 14_000
      );
      if (applyComplete.ok) {
        const repeatApply = isRepeatApplyCompleteLabel(applyComplete.label);
        log(`[hh-response-modal] Отклик подтверждён (${applyComplete.label})`);
        return {
          submitted: true,
          repeatApply,
          label: repeatApply ? 'already-submitted' : submit.label,
          letterInForm,
          resumeAttached,
          resumeAttachReason,
          profileResume,
          page,
        };
      }

      const postClickError = applyComplete.formError || (await detectHhResponseFormError(page));
      if (postClickError && isTransientHhFormError(postClickError) && (opts._hhSubmitRetries || 0) < 1) {
        opts._hhSubmitRetries = (opts._hhSubmitRetries || 0) + 1;
        log(`[hh-response-modal] hh.ru: ${postClickError} — повтор отправки через 2 с`);
        await page.waitForTimeout(2000);
        progressed = true;
        continue;
      }

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
          const formError = amb.formError || (await detectHhResponseFormError(page));
          if (formError) {
            log(`[hh-response-modal] hh.ru на форме: ${formError}`);
          } else {
            log('[hh-response-modal] После клика форма отклика ещё открыта — не считаем отклик отправленным');
          }
          return {
            submitted: false,
            letterInForm,
            resumeAttached,
            profileResume,
            label: formError ? 'hh-form-error' : 'form-still-open-after-submit',
            formError: formError || undefined,
            page,
          };
        }
      }

      if (await isResponseAlreadySubmitted(page)) {
        log('[hh-response-modal] Отправка: уже отклик (already-submitted)');
        return {
          submitted: true,
          repeatApply: true,
          label: 'already-submitted',
          letterInForm,
          resumeAttached,
          resumeAttachReason,
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
          resumeAttachReason,
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
        resumeAttachReason,
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
      const attachResult = await attachResumePdfInResponseModal(page, opts.resumePdfPath);
      if (attachResult.attached) {
        resumeAttached = true;
        resumeAttachReason = undefined;
        log('[hh-response-modal] PDF резюме прикреплено');
        progressed = true;
        continue;
      }
      if (attachResult.reason) resumeAttachReason = attachResult.reason;
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
        page = await focusVacancyResponsePage(opts.context, page, {
          log,
          closeOtherTabs: false,
        });
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
  if (pendingLetter) {
    log('[hh-response-modal] Финал: письмо ещё не в форме — submit пропущен (анти-naked)');
    return {
      submitted: false,
      letterInForm: false,
      resumeAttached,
      resumeAttachReason,
      profileResume,
      profileResumeHash: profileResumeHash || undefined,
      presubmitBlocked: 'letter_missing',
      label: 'letter_missing',
      page,
    };
  }
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
        const formError = amb.formError || (await detectHhResponseFormError(page));
        if (formError) {
          log(`[hh-response-modal] hh.ru на форме: ${formError}`);
        }
        return {
          submitted: false,
          letterInForm,
          resumeAttached,
          profileResume,
          label: formError ? 'hh-form-error' : 'form-still-open-final',
          formError: formError || undefined,
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
        resumeAttachReason,
        profileResume,
        page,
      };
    }
    if (!profileResumeHash) {
      profileResumeHash = (await readCurrentResponseResumeHash(page).catch(() => null)) || profileResumeHash;
    }
    return {
      submitted: true,
      label: submit.label,
      letterInForm,
      resumeAttached,
      resumeAttachReason,
      profileResume,
      profileResumeHash: profileResumeHash || undefined,
      page,
    };
  }

  if (needResume && !profileResumeOk) {
    log(
      `[hh-response-modal] Отправка отменена: не выбрано резюме «${preferredTitle || process.env.HH_PROFILE_RESUME_HASH}»`
    );
  }

  return {
    submitted: false,
    letterInForm,
    resumeAttached,
    resumeAttachReason,
    profileResume,
    profileResumeHash: profileResumeHash || undefined,
    page,
  };
}
