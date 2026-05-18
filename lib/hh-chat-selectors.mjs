/**
 * Селекторы после отклика: отправка формы, чат с работодателем, текст письма.
 * Вёрстка hh.ru меняется — при поломке правьте здесь (Playwright Codegen / DevTools).
 */

import { typeInField } from './hh-human-delay.mjs';
import { fieldContainsExpectedText } from './field-text-verify.mjs';
import { safePageWait, waitForActivePage } from './chromium-session.mjs';
import {
  vacancyResponseRoot,
  findEnabledSubmitButton,
  advanceResponseWizardOneStep,
  ensureVacancyResponseFormOpen,
} from './hh-response-modal.mjs';

const CHAT_IFRAME_SEL = '.chatik-integration-iframe';

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ключевые слова из названия вакансии / компании для поиска диалога в списке чатов. */
function titleSearchTokens(vacancyTitle, company) {
  const title = String(vacancyTitle || '').trim();
  const words = title
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const tokens = words.slice(0, 6);
  if (tokens.length < 2 && title.length > 3) tokens.push(title.slice(0, 48));
  const co = String(company || '').trim();
  if (co.length >= 2) {
    const cw = co.split(/\s+/).filter((w) => w.length > 2);
    if (cw[0]) tokens.push(cw[0]);
  }
  return [...new Set(tokens)];
}

/**
 * На /applicant/negotiations в списке слева — открыть переписку по вакансии (не только URL).
 * @param {import('playwright').Page} page
 * @param {{ vacancyId?: string, vacancyTitle?: string, company?: string, log?: (m: string) => void }} ctx
 */
export async function selectNegotiationThread(page, ctx = {}) {
  const log = typeof ctx.log === 'function' ? ctx.log : () => {};
  const tokens = titleSearchTokens(ctx.vacancyTitle, ctx.company);
  const vacancyId = String(ctx.vacancyId || '').trim();

  await page.waitForTimeout(600);

  if (vacancyId) {
    const byVacancy = page
      .locator(`a[href*="${vacancyId}"], [href*="vacancyId=${vacancyId}"], [href*="/vacancy/${vacancyId}"]`)
      .first();
    if (await byVacancy.isVisible({ timeout: 2200 }).catch(() => false)) {
      await byVacancy.scrollIntoViewIfNeeded().catch(() => {});
      await byVacancy.click();
      await page.waitForTimeout(1400);
      log(`[hh-chat] Диалог по vacancyId=${vacancyId}`);
      return 'thread-vacancy-id';
    }
  }

  for (const token of tokens) {
    if (token.length < 3) continue;
    const re = new RegExp(escapeRegExp(token), 'i');
    const rows = page
      .locator(
        '[data-qa*="negotiations" i] a, [data-qa*="chat-list" i] a, [class*="chat-list" i] a, aside a[href*="negotiation"]'
      )
      .filter({ hasText: re });
    const n = await rows.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 4); i++) {
      const row = rows.nth(i);
      if (!(await row.isVisible({ timeout: 1200 }).catch(() => false))) continue;
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.click();
      await page.waitForTimeout(1400);
      log(`[hh-chat] Диалог в списке по «${token}»`);
      return `thread:${token}`;
    }
    const link = page.getByRole('link', { name: re }).first();
    if (await link.isVisible({ timeout: 1500 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(1400);
      return `thread-link:${token}`;
    }
  }

  const firstThread = page
    .locator(
      '[data-qa="negotiations-list"] a, [data-qa*="negotiations-item" i] a, [class*="ChatList"] a, aside a[href*="negotiation"]'
    )
    .first();
  if (await firstThread.isVisible({ timeout: 1800 }).catch(() => false)) {
    await firstThread.scrollIntoViewIfNeeded().catch(() => {});
    await firstThread.click();
    await page.waitForTimeout(1400);
    log('[hh-chat] Открыт первый диалог в списке (последний отклик)');
    return 'thread:first';
  }

  return null;
}

async function isChatInputReady(page) {
  if (await chatIframeVisible(page)) return true;
  const pageInput = page
    .getByPlaceholder(/сообщение|напишите|ваше сообщение/i)
    .or(page.locator('.ProseMirror[contenteditable="true"]'))
    .or(page.locator('textarea'))
    .last();
  if (await pageInput.isVisible({ timeout: 1200 }).catch(() => false)) return true;
  try {
    const fl = page.frameLocator(CHAT_IFRAME_SEL);
    return fl
      .locator('.ProseMirror, [contenteditable="true"], textarea')
      .last()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
  } catch {
    return false;
  }
}

/** @deprecated используйте completeVacancyResponseForm из hh-response-modal.mjs */
function vacancyResponseModal(page) {
  return vacancyResponseRoot(page);
}

/**
 * Мастер отклика: выбор резюме и кнопки «Далее» до появления кнопки отправки.
 * @param {import('playwright').Page} page
 * @param {{ maxSteps?: number }} opts
 */
export async function prepareVacancyResponseModal(page, opts = {}) {
  const maxSteps = opts.maxSteps ?? 14;
  for (let step = 0; step < maxSteps; step++) {
    if (await findEnabledSubmitButton(page)) return;
    const action = await advanceResponseWizardOneStep(page);
    if (!action) break;
    await page.waitForTimeout(280);
  }
}

/**
 * @param {import('playwright').Locator} locator
 * @param {string} label
 * @param {number} timeoutMs
 */
async function clickSubmitIfEnabled(locator, label, timeoutMs) {
  const el = locator.first();
  await el.waitFor({ state: 'visible', timeout: timeoutMs });
  if (await el.isDisabled().catch(() => false)) {
    throw new Error('submit disabled');
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click();
  return label;
}

/**
 * Нажать отправку отклика в модалке.
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 * @returns {Promise<string|null>} метка найденного элемента или null если кнопки нет
 */
export async function submitVacancyResponseIfPresent(page, timeoutMs = 28_000) {
  const deadline = Date.now() + timeoutMs;
  const perTry = 2200;
  const modal = vacancyResponseModal(page);

  const attempts = [
    async () => {
      const found = await findEnabledSubmitButton(page);
      if (!found) throw new Error('no submit');
      await found.locator.scrollIntoViewIfNeeded().catch(() => {});
      await found.locator.click();
      return found.label;
    },
    () =>
      clickSubmitIfEnabled(
        modal.getByRole('button', { name: /отправить отклик/i }),
        'modal button Отправить отклик',
        perTry
      ),
    () =>
      clickSubmitIfEnabled(
        page.getByRole('button', { name: /отправить отклик/i }),
        'page button Отправить отклик',
        perTry
      ),
    () =>
      clickSubmitIfEnabled(page.getByRole('button', { name: /^отправить$/i }), 'page button Отправить', perTry),
  ];

  while (Date.now() < deadline) {
    await ensureVacancyResponseFormOpen(page, { humanClicks: false });
    await prepareVacancyResponseModal(page, { maxSteps: 4 });

    for (const run of attempts) {
      try {
        return await run();
      } catch {
        /* next */
      }
    }
    await page.waitForTimeout(450);
  }
  return null;
}

/**
 * Перейти в чат/переписку с работодателем после отклика.
 * @param {import('playwright').Page} page
 * @param {{ vacancyId?: string, vacancyTitle?: string, company?: string, context?: import('playwright').BrowserContext, log?: (m: string) => void }} ctx
 */
export async function openEmployerChatAfterResponse(pageIn, ctx = {}, timeoutMs = 45_000) {
  const log = typeof ctx.log === 'function' ? ctx.log : (msg) => console.log(msg);
  let page = pageIn;
  const context = page.context?.() || ctx.context;
  if (page.isClosed?.() && context) {
    const revived = await waitForActivePage(context, page, 6000);
    if (revived) page = revived;
  }
  await safePageWait(page, 1200);

  const tryClick = async (locator, label) => {
    const el = locator.first();
    await el.waitFor({ state: 'visible', timeout: 12_000 });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click();
    return label;
  };

  const chatUrl = /\/applicant\/negotiations|\/negotiation\/|\/chats?\//i;
  const onChatList = () => chatUrl.test(page.url());

  const ensureThreadOpen = async (source) => {
    if (!(onChatList() || /\/messenger/i.test(page.url()))) return null;
    const picked = await selectNegotiationThread(page, ctx);
    if (picked) {
      await page.waitForTimeout(800);
      if (await isChatInputReady(page)) return picked;
    }
    return picked;
  };

  if (onChatList()) {
    const picked = await ensureThreadOpen('already-on-list');
    if (picked && (await isChatInputReady(page))) {
      log(`[hh-chat] Диалог открыт (${picked})`);
      return picked;
    }
  }

  const clickAttempts = [
    () => tryClick(page.getByRole('link', { name: /перейти в чат|в чат|написать|открыть чат|переписка/i }), 'link чат'),
    () => tryClick(page.getByRole('button', { name: /перейти в чат|в чат|написать|открыть чат/i }), 'button чат'),
    () =>
      tryClick(
        page.locator('a[href*="/negotiation/"]').filter({ hasNot: page.locator('[href*="/negotiations"]') }),
        'a href negotiation thread'
      ),
    () => tryClick(page.locator('[data-qa*="chat" i]').or(page.locator('[data-qa*="negotiation" i]')), 'data-qa chat'),
  ];

  for (const run of clickAttempts) {
    try {
      const label = await run();
      await safePageWait(page, 1500);
      log(`[hh-chat] Переход в чат: ${label}`);
      const picked = await ensureThreadOpen(label);
      return picked || label;
    } catch {
      /* next */
    }
  }

  const vacancyId = String(ctx.vacancyId || '').trim();
  const direct = vacancyId
    ? `https://hh.ru/applicant/negotiations?vacancyId=${vacancyId}`
    : 'https://hh.ru/applicant/negotiations';
  try {
    log('[hh-chat] Fallback: раздел переговоров');
    await page.goto(direct, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const picked = await ensureThreadOpen('goto-negotiations');
    return picked || 'goto-negotiations-fallback';
  } catch {
    /* ignore */
  }

  throw new Error(
    'Не удалось открыть чат с работодателем. Запишите селекторы через Playwright Codegen и обновите lib/hh-chat-selectors.mjs (openEmployerChatAfterResponse).'
  );
}

async function chatIframeVisible(page) {
  return page.locator(CHAT_IFRAME_SEL).first().isVisible({ timeout: 3500 }).catch(() => false);
}

async function tryClickSendInRoot(root) {
  const senders = [
    () => root.getByRole('button', { name: /^отправить$/i }),
    () => root.getByRole('button', { name: /отправить сообщение/i }),
    () => root.getByRole('button', { name: 'Отправить', exact: true }),
    () => root.locator('[data-qa*="send" i]'),
    () => root.locator('button[type="submit"]').filter({ hasText: /отправить/i }),
  ];
  for (const run of senders) {
    try {
      const b = run().first();
      if (await b.isVisible({ timeout: 2500 }).catch(() => false)) {
        const dis = await b.isDisabled().catch(() => false);
        if (!dis) {
          await b.scrollIntoViewIfNeeded().catch(() => {});
          await b.click();
          console.log('[hh-chat] Нажата кнопка отправки в чате');
          return;
        }
      }
    } catch {
      /* next */
    }
  }
  // В некоторых чатах отправка работает Enter в активном поле.
  try {
    await root.page().keyboard.press('Enter');
    console.log('[hh-chat] Отправка через Enter');
  } catch {
    /* ignore */
  }
}

async function sendLetterInRoot(root, page, opts, timeoutMs, allowPageFallback = false) {
  const { text, tempFilePath, humanTyping = false } = opts;
  await page.waitForTimeout(800);

  const fileInputs = root.locator('input[type=file]');
  const fileCount = await fileInputs.count().catch(() => 0);
  for (let i = 0; i < fileCount; i++) {
    try {
      const inp = fileInputs.nth(i);
      await inp.setInputFiles(tempFilePath);
      console.log('[hh-chat] Прикреплён файл (input[type=file])');
      await tryClickSendInRoot(root);
      return 'file-attach';
    } catch {
      /* next input */
    }
  }

  const uploadBtn = root.getByRole('button', { name: /uploadFileButton/i });
  try {
    const ub = uploadBtn.first();
    if (await ub.isVisible({ timeout: 2200 }).catch(() => false)) {
      await ub.setInputFiles(tempFilePath);
      console.log('[hh-chat] Файл через кнопку uploadFileButton');
      await tryClickSendInRoot(root);
      return 'upload-btn-file';
    }
  } catch {
    /* next */
  }

  const tryFill = async (locator, label, stepMs = timeoutMs) => {
    const el = locator.first();
    try {
      await el.waitFor({ state: 'visible', timeout: stepMs });
    } catch (e) {
      await el.waitFor({ state: 'attached', timeout: Math.min(4000, stepMs) }).catch(() => {
        throw e;
      });
      if (!(await el.isVisible().catch(() => false))) throw e;
    }
    await typeInField(page, locator, text, { humanTyping });
    if (!(await fieldContainsExpectedText(locator, text))) {
      throw new Error(`Текст письма не попал в поле чата (${label})`);
    }
    const logFn = typeof opts.log === 'function' ? opts.log : (m) => console.log(m);
    logFn(`[hh-chat] Текст в чате: ${label}`);
    await tryClickSendInRoot(root);
    return label;
  };

  const fast = process.env.HH_FAST === '1';
  const quick = fast ? Math.min(4500, timeoutMs) : Math.min(8000, timeoutMs);
  const fillAttempts = [
    () =>
      tryFill(
        root.getByPlaceholder(/сообщение|напишите|ваше сообщение|напишите сообщение/i),
        'placeholder сообщение',
        quick
      ),
    () =>
      tryFill(
        root.getByRole('textbox', { name: /сообщение|напишите|чат/i }),
        'textbox сообщение',
        quick
      ),
    () =>
      tryFill(
        root.locator('[data-qa*="message-input" i], [data-qa*="chat-input" i], [data-qa*="message" i][data-qa*="input" i]').last(),
        'data-qa message/chat input',
        quick
      ),
    () => tryFill(root.locator('.ProseMirror[contenteditable="true"]').last(), 'ProseMirror contenteditable', quick),
    () => tryFill(root.locator('textarea').last(), 'textarea last', quick),
    () => tryFill(root.locator('[contenteditable="true"]').last(), 'contenteditable chat', quick),
  ];
  if (allowPageFallback) {
    fillAttempts.push(
      () =>
        tryFill(
          page.getByPlaceholder(/сообщение|напишите|ваше сообщение|напишите сообщение/i),
          'page placeholder сообщение',
          quick
        ),
      () => tryFill(page.locator('[role="dialog"] [contenteditable="true"]').last(), 'page dialog contenteditable', quick),
      () => tryFill(page.locator('textarea').last(), 'page textarea last', timeoutMs)
    );
  }

  let lastErr;
  for (const run of fillAttempts) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(
    `Не удалось вставить письмо в чат. Обновите lib/hh-chat-selectors.mjs (sendLetterInChat). ${lastErr?.message || lastErr}`
  );
}

/**
 * Вставить текст в чат: iframe chatik или страница; файл или поле ввода.
 * @param {import('playwright').Page} page
 * @param {{ text: string, tempFilePath: string, humanTyping?: boolean }} opts
 */
export async function sendLetterInChat(page, opts, timeoutMs = 25_000) {
  const log = typeof opts.log === 'function' ? opts.log : (msg) => console.log(msg);
  const humanTyping = opts.humanTyping === true;
  const inner = { ...opts, humanTyping };
  const fast = process.env.HH_FAST === '1';
  const iframeStepBudget = fast ? Math.min(20_000, timeoutMs) : Math.min(28_000, Math.max(timeoutMs, 22_000));

  await page.waitForTimeout(fast ? 900 : 2000);

  if (/\/applicant\/negotiations/i.test(page.url())) {
    const picked = await selectNegotiationThread(page, opts);
    if (picked) log(`[hh-chat] Перед вводом: ${picked}`);
    await page.waitForTimeout(fast ? 600 : 1000);
  }

  if (await chatIframeVisible(page)) {
    log('[hh-chat] Найден iframe чата, жду загрузку…');
    try {
      const fl = page.frameLocator(CHAT_IFRAME_SEL);
      await fl.locator('body').waitFor({ state: 'attached', timeout: 18_000 });
      await page.waitForTimeout(1200);
      log('[hh-chat] Вставка письма в iframe…');
      return await sendLetterInRoot(fl, page, inner, iframeStepBudget, false);
    } catch (e) {
      log(`[hh-chat] iframe: ${e.message} — пробуем без iframe`);
    }
  } else {
    log('[hh-chat] iframe не виден, вставка на странице…');
  }

  return await sendLetterInRoot(page, page, inner, timeoutMs, true);
}

