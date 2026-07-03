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
const COVER_LETTER_ACTION_RE = /(?:добавить|приложить)\s+сопроводительн/i;

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
 * @param {import('playwright').Page} page
 */
export async function dismissNegotiationTooltips(page) {
  const closers = [
    page.getByRole('button', { name: /понятно|закрыть|ок|хорошо/i }),
    page.locator('[data-qa="drop-base"] button'),
    page.locator('[role="alertdialog"] button'),
  ];
  for (const c of closers) {
    if (await c.first().isVisible({ timeout: 600 }).catch(() => false)) {
      await c.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(350);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
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
  await dismissNegotiationTooltips(page);

  if (vacancyId && /vacancyId=/i.test(page.url())) {
    await page.waitForTimeout(1200);
    if (await isChatInputReady(page)) {
      log(`[hh-chat] Диалог уже открыт (vacancyId в URL)`);
      return 'thread-url-param';
    }
    const addCoverHint = page.getByText(COVER_LETTER_ACTION_RE).first();
    if (await addCoverHint.isVisible({ timeout: 2500 }).catch(() => false)) {
      log(`[hh-chat] Переписка открыта (vacancyId в URL)`);
      return 'thread-url-param';
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

  if (vacancyId) {
    const byVacancy = page
      .locator(`a[href*="${vacancyId}"], [href*="vacancyId=${vacancyId}"], [href*="/vacancy/${vacancyId}"]`)
      .first();
    if (await byVacancy.isVisible({ timeout: 2200 }).catch(() => false)) {
      await byVacancy.scrollIntoViewIfNeeded().catch(() => {});
      await dismissNegotiationTooltips(page);
      await byVacancy.click({ force: true });
      await page.waitForTimeout(1400);
      log(`[hh-chat] Диалог по vacancyId=${vacancyId} (fallback vacancy link)`);
      return 'thread-vacancy-id';
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

function chatEditableLocators(root) {
  return root
    .locator('[data-qa="chatik-new-message-text"]')
    .or(root.getByPlaceholder(/сообщение|напишите|ваше сообщение|напишите сообщение/i))
    .or(root.getByRole('textbox', { name: /сообщение|напишите|чат/i }))
    .or(
      root.locator(
        '[data-qa*="chatik" i][data-qa*="input" i], [data-qa*="message-input" i], [data-qa*="chat-input" i], [data-qa="chat-input"], [data-qa*="chatik-message" i]'
      )
    )
    .or(root.locator('.ProseMirror[contenteditable="true"]'))
    .or(root.locator('[contenteditable="true"][role="textbox"]'))
    .or(root.locator('div[role="textbox"][contenteditable="true"]'))
    .or(root.locator('[contenteditable="true"]'))
    .or(root.locator('textarea'));
}

/**
 * @param {import('playwright').Page | import('playwright').FrameLocator} root
 */
async function firstVisibleChatInput(root, timeoutMs = 1200) {
  const groups = [
    () => root.locator('[data-qa="chatik-new-message-text"]'),
    () => root.getByPlaceholder(/сообщение|напишите|ваше сообщение|напишите сообщение/i),
    () => root.getByRole('textbox', { name: /сообщение|напишите|чат/i }),
    () =>
      root.locator(
        '[data-qa*="chatik" i][data-qa*="input" i], [data-qa*="message-input" i], [data-qa*="chat-input" i], [data-qa="chat-input"]'
      ),
    () => root.locator('.ProseMirror[contenteditable="true"]'),
    () => root.locator('[contenteditable="true"][role="textbox"]'),
    () => root.locator('div[role="textbox"][contenteditable="true"]'),
    () => root.locator('[contenteditable="true"]'),
    () => root.locator('textarea'),
  ];
  for (const run of groups) {
    const loc = run().last();
    if (await loc.isVisible({ timeout: timeoutMs }).catch(() => false)) return loc;
  }
  return null;
}

async function isChatInputReady(page) {
  if (await firstVisibleChatInput(page, 1200)) return true;
  if (await chatIframeVisible(page)) {
    try {
      const fl = page.frameLocator(CHAT_IFRAME_SEL);
      if (await firstVisibleChatInput(fl, 1800)) return true;
    } catch {
      /* ignore */
    }
  }
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const loc = frame.locator(
        '.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea'
      );
      if (await loc.last().isVisible({ timeout: 600 }).catch(() => false)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Ждём появления поля ввода чата (iframe chatik грузится с задержкой).
 * @param {import('playwright').Page} page
 * @param {{ maxMs?: number, expectedText?: string, log?: (m: string) => void }} [opts]
 */
async function waitForChatInputReady(page, opts = {}) {
  const maxMs = opts.maxMs ?? 22_000;
  const expectedText = String(opts.expectedText || '').trim();
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const deadline = Date.now() + maxMs;
  let lastIframe = false;
  while (Date.now() < deadline) {
    if (expectedText && (await verifyLetterVisibleInChat(page, expectedText))) return 'letter-visible';
    if (await isChatInputReady(page)) return 'input-ready';
    const iframeNow = await chatIframeVisible(page);
    if (iframeNow && !lastIframe) {
      log('[hh-chat] iframe чата появился — жду поле ввода…');
      lastIframe = true;
    }
    await page.waitForTimeout(450);
  }
  return null;
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
/**
 * Вкладка «Переписка по вакансии» на карточке вакансии после отклика (Росгосстрах и др.).
 * @param {import('playwright').Page} page
 * @param {{ text: string, tempFilePath?: string, humanTyping?: boolean, log?: (m: string) => void }} opts
 */
export async function sendLetterOnVacancyCorrespondence(page, opts) {
  const log = typeof opts.log === 'function' ? opts.log : (msg) => console.log(msg);
  if (!/\/vacancy\/\d+/i.test(page.url())) return null;

  const text = String(opts.text || '').trim();
  await ensureVacancyResponseChatOpen(page, { log, expectedText: text });

  const tab = page
    .getByRole('tab', { name: /переписк/i })
    .or(page.getByRole('link', { name: /переписк/i }))
    .or(page.locator('[data-qa*="negotiation" i], [data-qa*="chat" i]').filter({ hasText: /переписк/i }));
  if (await tab.first().isVisible({ timeout: 2500 }).catch(() => false)) {
    await tab.first().click();
    await page.waitForTimeout(900);
    log('[hh-chat] Вкладка «Переписка по вакансии»');
  }

  const delivered = page.locator('text=/резюме\\s+доставлено/i').first();
  if (await delivered.isVisible({ timeout: 2000 }).catch(() => false)) {
    await delivered.scrollIntoViewIfNeeded().catch(() => {});
  }

  const waitState = await waitForChatInputReady(page, {
    maxMs: 28_000,
    expectedText: text,
    log,
  });
  if (waitState === 'letter-visible') {
    log('[hh-chat] Письмо уже в переписке на странице вакансии');
    return 'verified-visible';
  }

  if (await chatIframeVisible(page)) {
    return sendLetterInChat(page, opts);
  }

  const correspondenceRoot = page
    .locator('section, [class*="vacancy"], main')
    .filter({ hasText: /переписк|резюме\s+доставлено|напишите/i })
    .last();

  try {
    return await sendLetterInRoot(correspondenceRoot, page, opts, 22_000, true);
  } catch (e) {
    log(`[hh-chat] Переписка на странице вакансии: ${e.message}`);
    return null;
  }
}

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
  if (
    await page
      .locator('.chatik-integration-iframe_loaded')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false)
  ) {
    return true;
  }
  return page.locator(CHAT_IFRAME_SEL).first().isVisible({ timeout: 2000 }).catch(() => false);
}

/**
 * На странице вакансии после отклика — открыть встроенный чат (chatik iframe).
 * Без клика «Чат» iframe не монтируется и письмо не видно для verify/send.
 * @param {import('playwright').Page} page
 * @param {{ log?: (m: string) => void, expectedText?: string }} [opts]
 */
export async function ensureVacancyResponseChatOpen(page, opts = {}) {
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  if (!/\/vacancy\/\d+/i.test(page.url())) return false;

  if (await chatIframeVisible(page)) {
    const waitState = await waitForChatInputReady(page, {
      maxMs: 8000,
      expectedText: opts.expectedText,
      log,
    });
    if (waitState) return true;
  }

  const chatBtn = page.locator('[data-qa="vacancy-response-link-view-topic"]').first();
  if (await chatBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await chatBtn.scrollIntoViewIfNeeded().catch(() => {});
    await chatBtn.click({ force: true });
    log('[hh-chat] Открыт чат на странице вакансии (vacancy-response-link-view-topic)');
    await page.waitForTimeout(1500);
    await page
      .locator('.chatik-integration-iframe_loaded')
      .first()
      .waitFor({ state: 'visible', timeout: 18_000 })
      .catch(() => {});
    const waitState = await waitForChatInputReady(page, {
      maxMs: 20_000,
      expectedText: opts.expectedText,
      log,
    });
    return Boolean(waitState);
  }

  const tab = page
    .getByRole('tab', { name: /переписк|чат/i })
    .or(page.getByRole('button', { name: /^чат$/i }))
    .first();
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(1200);
    return await chatIframeVisible(page);
  }
  return false;
}


/**
 * Вкладка «Чат» на странице вакансии после отклика (кнопка «Приложить сопроводительное»).
 * @param {import('playwright').Page} page
 * @param {string} vacancyId
 */
export async function openVacancyEmployerChat(page, vacancyId) {
  const id = String(vacancyId || '').trim();
  if (!id) return false;
  await page.goto(`https://hh.ru/vacancy/${id}?hhtmFrom=negotiation_list`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
  const chatTab = page
    .getByRole('tab', { name: /^чат$/i })
    .or(page.getByRole('link', { name: /^чат$/i }))
    .or(page.locator('a, button').filter({ hasText: /^чат$/i }))
    .first();
  if (await chatTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await chatTab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  return true;
}

export async function scrollNegotiationChatBottom(page) {
  await page.evaluate(() => {
    const selectors = [
      '[class*="Chat"]',
      '[class*="chat"]',
      '[data-qa*="chat"]',
      '[class*="message"]',
      '[role="log"]',
      'main',
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.scrollHeight > el.clientHeight + 24) {
          el.scrollTop = el.scrollHeight;
        }
      }
    }
  });
  await page.waitForTimeout(350);
}

async function findAddCoverLetterControl(page) {
  const builders = [
    () => page.getByRole('button', { name: COVER_LETTER_ACTION_RE }),
    () => page.getByRole('link', { name: COVER_LETTER_ACTION_RE }),
    () => page.getByText(COVER_LETTER_ACTION_RE),
    () => page.locator('a, button, [role="button"], span').filter({ hasText: COVER_LETTER_ACTION_RE }),
  ];
  for (const build of builders) {
    const loc = build().first();
    if (await loc.isVisible({ timeout: 400 }).catch(() => false)) return loc;
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ text: string, humanTyping?: boolean }} opts
 * @param {(msg: string) => void} log
 */
async function tryDeliverCoverLetterInChat(page, opts, log) {
  const text = String(opts.text || '').trim();
  if (!text) return null;

  await page.waitForTimeout(1200);
  await scrollNegotiationChatBottom(page);

  const noLetterBubble = page.getByText(/без сопроводительного письма/i).first();
  if (await noLetterBubble.isVisible({ timeout: 2000 }).catch(() => false)) {
    await noLetterBubble.scrollIntoViewIfNeeded().catch(() => {});
    await noLetterBubble.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }

  for (let attempt = 0; attempt < 32; attempt++) {
    await scrollNegotiationChatBottom(page);
    const addCover = await findAddCoverLetterControl(page);
    if (addCover) {
      await addCover.scrollIntoViewIfNeeded().catch(() => {});
      await addCover.click({ force: true });
      await page.waitForTimeout(1200);
      log('[hh-chat] Сопроводительное — вставка текста');
      try {
        const { fillCoverLetterField } = await import('./hh-response-selectors.mjs');
        const { typeInField } = await import('./hh-human-delay.mjs');
        const { fieldContainsExpectedText } = await import('./field-text-verify.mjs');
        let filled = false;
        try {
          await fillCoverLetterField(page, text, 22_000, { humanTyping: opts.humanTyping === true });
          filled = true;
        } catch {
          const inlineField = page
            .locator('textarea, [contenteditable="true"]')
            .filter({ hasNot: page.getByPlaceholder(/сообщение/i) })
            .last();
          if (await inlineField.isVisible({ timeout: 4000 }).catch(() => false)) {
            await typeInField(page, inlineField, text, { humanTyping: opts.humanTyping === true });
            filled = await fieldContainsExpectedText(inlineField, text);
          }
        }
        if (!filled) throw new Error('поле сопроводительного не заполнено');
        const submit = page
          .getByRole('button', { name: /отправить|сохранить|добавить|приложить/i })
          .or(page.locator('button[type="submit"]'))
          .first();
        if (await submit.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submit.click({ force: true });
          await page.waitForTimeout(2500);
        }
        if (await verifyLetterVisibleInChat(page, text)) {
          log('[hh-chat] Сопроводительное в переписке подтверждено');
          return 'add-cover-letter';
        }
      } catch (e) {
        log(`[hh-chat] Добавить сопроводительное: ${String(e?.message || e).slice(0, 180)}`);
      }
      break;
    }
    await page.waitForTimeout(450);
  }

  const msgField = page
    .getByPlaceholder(/сообщение/i)
    .or(page.getByRole('textbox', { name: /сообщение/i }))
    .or(page.locator('.ProseMirror[contenteditable="true"]').last());
  if (await msgField.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    log('[hh-chat] Fallback: письмо как сообщение в чат');
    await typeInField(page, msgField, text, { humanTyping: opts.humanTyping === true });
    const sendBtn = page
      .getByRole('button', { name: /^отправить$/i })
      .or(page.locator('[data-qa*="send" i]'))
      .first();
    if (await sendBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await sendBtn.click({ force: true });
      await page.waitForTimeout(2000);
      if (await verifyLetterVisibleInChat(page, text)) return 'chat-message';
    }
  }

  return null;
}

/**
 * Переписка всё ещё без сопроводительного (системное сообщение hh).
 * @param {import('playwright').Page} page
 */
export async function chatShowsNoCoverLetter(page) {
  const scan = async (frame) => {
    try {
      return await frame.evaluate(() => {
        const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
        return COVER_LETTER_ACTION_RE.test(text);
      });
    } catch {
      return false;
    }
  };
  if (await scan(page)) return true;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    if (await scan(frame)) return true;
  }
  return false;
}

function getChatikFrame(page) {
  return page.frames().find((f) => /chatik\.hh\.ru\/chat\//i.test(f.url() || '')) || null;
}

/** @param {string} expectedText */
export function buildCoverLetterVerifyProbe(expectedText) {
  const raw = String(expectedText || '').replace(/\s+/g, ' ').trim();
  return raw.slice(0, Math.min(72, raw.length)).trim();
}

/**
 * В chatik уже есть длинное исходящее (резюме/hh), но не approved-письмо — не слать второе сообщение.
 * @param {import('playwright').Page} page
 * @param {string} approvedText
 */
export async function chatHasOutgoingExcerptWithoutApproved(page, approvedText) {
  if (await verifyInChatikFrame(page, approvedText)) return false;
  const frame = getChatikFrame(page);
  if (!frame) return false;
  const probe = buildCoverLetterVerifyProbe(approvedText);
  try {
    return await frame.evaluate((p) => {
      const clone = document.body.cloneNode(true);
      clone
        .querySelectorAll('textarea, input, select, [contenteditable="true"], [contenteditable=""]')
        .forEach((node) => node.remove());
      let text = (clone.innerText || '').replace(/\s+/g, ' ').trim();
      text = text.replace(/Отклик на\s*вакансию/gi, '').replace(/Без сопроводительного письма/gi, '');
      if (p && text.includes(p)) return false;
      if (text.length < 180) return false;
      return /Здравствуйте[!,.]?\s+\S.{80,}/i.test(text) || /в тестировании работаю|банковск(ом|ий) проект/i.test(text);
    }, probe);
  } catch {
    return false;
  }
}

async function verifyInChatikFrame(page, expectedText) {
  const frame = getChatikFrame(page);
  if (!frame) return false;
  const probe = buildCoverLetterVerifyProbe(expectedText);
  if (probe.length < 28) return false;
  try {
    return await frame.evaluate((p) => {
      const clone = document.body.cloneNode(true);
      clone
        .querySelectorAll('textarea, input, select, [contenteditable="true"], [contenteditable=""]')
        .forEach((node) => node.remove());
      return (clone.innerText || '').replace(/\s+/g, ' ').includes(p);
    }, probe);
  } catch {
    return false;
  }
}

async function sendCoverLetterInChatikFrame(page, text, { humanTyping = false, log = () => {} } = {}) {
  const frame = getChatikFrame(page);
  if (!frame) throw new Error('iframe chatik не найден — откройте вкладку «Чат» на вакансии');

  const field = frame.locator('[data-qa="chatik-new-message-text"], textarea').first();
  await field.waitFor({ state: 'visible', timeout: 20_000 });
  await fillChatField(page, field, text, { humanTyping });
  log('[hh-chat] Текст в поле chatik');

  const senders = [
    () => frame.getByRole('button', { name: /^отправить$/i }),
    () => frame.locator('[data-qa*="send" i]'),
    () => frame.locator('button[type="submit"]'),
  ];
  for (const build of senders) {
    const btn = build().first();
    if (!(await btn.isVisible({ timeout: 1500 }).catch(() => false))) continue;
    if (await btn.isDisabled().catch(() => false)) continue;
    await btn.click({ force: true });
    log('[hh-chat] Отправлено сообщение в chatik');
    await page.waitForTimeout(3500);
    return;
  }
  await frame.page().keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2500);
}

export async function verifyCoverLetterDelivered(page, expectedText) {
  if (await verifyInChatikFrame(page, expectedText)) return true;
  if (await chatShowsNoCoverLetter(page)) return false;

  const probe = buildCoverLetterVerifyProbe(expectedText);
  if (probe.length < 28) return false;

  const visibleOutsideInputs = async (frame) => {
    try {
      return await frame.evaluate((p) => {
        const clone = document.body.cloneNode(true);
        clone
          .querySelectorAll('textarea, input, select, [contenteditable="true"], [contenteditable=""]')
          .forEach((node) => node.remove());
        const text = (clone.innerText || '').replace(/\s+/g, ' ');
        return text.includes(p);
      }, probe);
    } catch {
      return false;
    }
  };

  if (await visibleOutsideInputs(page)) return true;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    if (await visibleOutsideInputs(frame)) return true;
  }
  return false;
}

/**
 * Доставить сопроводительное после отклика без письма («+ Добавить» / «Приложить»).
 * @param {import('playwright').Page} page
 * @param {{ text: string, vacancyId?: string, vacancyTitle?: string, company?: string, humanTyping?: boolean, log?: (m: string) => void }} opts
 */
export async function deliverCoverLetterPostApply(page, opts) {
  const text = String(opts.text || '').trim();
  if (!text) throw new Error('Пустой текст письма');
  const log = typeof opts.log === 'function' ? opts.log : (m) => console.log(m);
  const vacancyId = String(opts.vacancyId || '').trim();
  const humanTyping = opts.humanTyping === true;

  if (!vacancyId) throw new Error('Нужен vacancyId для доставки письма в chatik');

  await page.goto(`https://hh.ru/vacancy/${vacancyId}?hhtmFrom=negotiation_list`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
  await ensureVacancyResponseChatOpen(page, { log, expectedText: text });
  await page.waitForTimeout(2000);

  if (await verifyCoverLetterDelivered(page, text)) {
    log('[hh-chat] Approved-письмо уже в chatik');
    return 'already-delivered';
  }

  const clicked = await (async () => {
    await scrollNegotiationChatBottom(page);
    const onPage = await findAddCoverLetterControl(page);
    if (onPage) {
      await onPage.click({ force: true });
      log('[hh-chat] Клик «приложить сопроводительное»');
      await page.waitForTimeout(1500);
      return true;
    }
    for (const sel of ['.chatik-integration-iframe_loaded', '.chatik-integration-iframe', CHAT_IFRAME_SEL]) {
      const fl = page.frameLocator(sel);
      const loc = fl.locator('a, button, span').filter({ hasText: COVER_LETTER_ACTION_RE }).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click({ force: true });
        log(`[hh-chat] Клик сопроводительное (${sel})`);
        await page.waitForTimeout(1500);
        return true;
      }
    }
    const chatFrame = getChatikFrame(page);
    if (chatFrame) {
      const loc = chatFrame.locator('a, button, span').filter({ hasText: COVER_LETTER_ACTION_RE }).first();
      if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
        await loc.click({ force: true });
        log('[hh-chat] Клик сопроводительное (chatik frame)');
        await page.waitForTimeout(1500);
        return true;
      }
    }
    return false;
  })();

  if (clicked) {
    try {
      const { fillCoverLetterField } = await import('./hh-response-selectors.mjs');
      await fillCoverLetterField(page, text, 20_000, { humanTyping });
      const submit = page.getByRole('button', { name: /отправить|сохранить|приложить/i }).first();
      if (await submit.isVisible({ timeout: 2500 }).catch(() => false)) {
        await submit.click({ force: true });
        await page.waitForTimeout(3000);
      }
      if (await verifyCoverLetterDelivered(page, text)) return 'cover-form-delivered';
    } catch (e) {
      log(`[hh-chat] Форма сопроводительного: ${String(e?.message || e).slice(0, 140)}`);
    }
  }

  if (await chatHasOutgoingExcerptWithoutApproved(page, text)) {
    const err = new Error(
      'В чате уже есть исходящий текст (резюме/hh), approved-письма нет — повторное сообщение в чат запрещено. Используйте «Приложить/Добавить сопроводительное» вручную или согласуйте с партнёром.'
    );
    err.code = 'CHAT_DUPLICATE_BLOCKED';
    throw err;
  }

  log('[hh-chat] Отправляем approved-письмо сообщением в chatik (последний резерв)');
  await sendCoverLetterInChatikFrame(page, text, { humanTyping, log });

  if (!(await verifyCoverLetterDelivered(page, text))) {
    throw new Error('Approved-письмо не появилось в chatik после отправки');
  }
  return 'chatik-message-delivered';
}

/**
 * Есть ли исходящий текст письма в переписке (страница + iframe чата).
 * @param {import('playwright').Page} page
 * @param {string} expectedText
 */
export async function verifyLetterVisibleInChat(page, expectedText) {
  return verifyCoverLetterDelivered(page, expectedText);
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

async function fillChatField(page, locator, text, { humanTyping = false } = {}) {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ force: true }).catch(() => {});
  try {
    await typeInField(page, locator, text, { humanTyping });
    if (await fieldContainsExpectedText(locator, text)) return true;
  } catch {
    /* fallback below */
  }
  try {
    await el.evaluate((node, value) => {
      node.focus?.();
      if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
        node.value = value;
      } else {
        node.textContent = value;
        node.innerHTML = value.replace(/\n/g, '<br>');
      }
      node.dispatchEvent(new InputEvent('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
    return await fieldContainsExpectedText(locator, text);
  } catch {
    return false;
  }
}

async function sendLetterInRoot(root, page, opts, timeoutMs, allowPageFallback = false) {
  const { text, tempFilePath, humanTyping = false } = opts;
  const logFn = typeof opts.log === 'function' ? opts.log : (m) => console.log(m);
  await page.waitForTimeout(800);

  if (await verifyLetterVisibleInChat(page, text)) {
    logFn('[hh-chat] Письмо уже видно в переписке (повторная вставка не нужна)');
    return 'verified-visible';
  }

  const ready = await waitForChatInputReady(page, {
    maxMs: Math.min(24_000, timeoutMs),
    expectedText: text,
    log: logFn,
  });
  if (ready === 'letter-visible') return 'verified-visible';

  const addCover = page
    .getByRole('button', { name: COVER_LETTER_ACTION_RE })
    .or(page.getByRole('link', { name: COVER_LETTER_ACTION_RE }))
    .or(page.getByText(COVER_LETTER_ACTION_RE))
    .first();
  if (await addCover.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addCover.scrollIntoViewIfNeeded().catch(() => {});
    await addCover.click();
    await page.waitForTimeout(700);
    logFn('[hh-chat] Раскрыт блок «Добавить сопроводительное»');
  }

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

  const fast = process.env.HH_FAST === '1';
  const stepMs = fast ? Math.min(6000, timeoutMs) : Math.min(14_000, timeoutMs);

  const tryFill = async (locator, label, fillTimeoutMs = stepMs) => {
    const el = locator.first();
    try {
      await el.waitFor({ state: 'visible', timeout: fillTimeoutMs });
    } catch (e) {
      await el.waitFor({ state: 'attached', timeout: Math.min(5000, fillTimeoutMs) }).catch(() => {
        throw e;
      });
      if (!(await el.isVisible().catch(() => false))) throw e;
    }
    const filled = await fillChatField(page, locator, text, { humanTyping });
    if (filled) {
      logFn(`[hh-chat] Текст в поле ввода: ${label}`);
    } else {
      logFn(`[hh-chat] Поле «${label}»: текст не подтверждён, пробуем отправить…`);
    }
    await tryClickSendInRoot(root);
    await page.waitForTimeout(fast ? 700 : 1600);
    if (await verifyLetterVisibleInChat(page, text)) {
      logFn(`[hh-chat] Письмо в переписке подтверждено (${label})`);
      return label;
    }
    if (!filled) {
      throw new Error(`Текст письма не попал в поле чата (${label})`);
    }
    return label;
  };

  const fillAttempts = [
    () => tryFill(chatEditableLocators(root), 'chat-editable', stepMs),
    () =>
      tryFill(
        root.getByPlaceholder(/сообщение|напишите|ваше сообщение|напишите сообщение/i),
        'placeholder сообщение',
        stepMs
      ),
    () =>
      tryFill(
        root.getByRole('textbox', { name: /сообщение|напишите|чат/i }),
        'textbox сообщение',
        stepMs
      ),
    () =>
      tryFill(
        root.locator('[data-qa*="message-input" i], [data-qa*="chat-input" i], [data-qa="chat-input"]').last(),
        'data-qa message/chat input',
        stepMs
      ),
    () => tryFill(root.locator('.ProseMirror[contenteditable="true"]').last(), 'ProseMirror contenteditable', stepMs),
    () => tryFill(root.locator('[contenteditable="true"]').last(), 'contenteditable chat', stepMs),
    () => tryFill(root.locator('textarea').last(), 'textarea last', timeoutMs),
  ];
  if (allowPageFallback) {
    fillAttempts.push(
      () =>
        tryFill(
          page.getByPlaceholder(/сообщение|напишите|ваше сообщение|напишите сообщение/i),
          'page placeholder сообщение',
          stepMs
        ),
      () => tryFill(page.locator('[role="dialog"] [contenteditable="true"]').last(), 'page dialog contenteditable', stepMs),
      () => tryFill(page.locator('textarea').last(), 'page textarea last', timeoutMs)
    );
  }

  let lastErr;
  for (const run of fillAttempts) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
      if (await verifyLetterVisibleInChat(page, text)) {
        logFn('[hh-chat] Письмо появилось в переписке во время вставки');
        return 'verified-visible';
      }
    }
  }

  if (await verifyLetterVisibleInChat(page, text)) {
    logFn('[hh-chat] Письмо уже видно в переписке (повторная вставка не нужна)');
    return 'verified-visible';
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

  if (/\/vacancy\/\d+/i.test(page.url())) {
    await ensureVacancyResponseChatOpen(page, {
      log,
      expectedText: String(opts.text || ''),
    });
  }

  if (/\/applicant\/negotiations/i.test(page.url())) {
    await dismissNegotiationTooltips(page);
    if (!(await isChatInputReady(page))) {
      const picked = await selectNegotiationThread(page, opts);
      if (picked) log(`[hh-chat] Перед вводом: ${picked}`);
    } else {
      log('[hh-chat] Диалог уже открыт');
    }
    const waitState = await waitForChatInputReady(page, {
      maxMs: iframeStepBudget,
      expectedText: opts.text,
      log,
    });
    if (waitState === 'letter-visible') return 'verified-visible';
    await page.waitForTimeout(fast ? 600 : 1000);
  }

  const coverDelivered = await tryDeliverCoverLetterInChat(page, inner, log);
  if (coverDelivered) return coverDelivered;

  await scrollNegotiationChatBottom(page);
  const retryCover = await tryDeliverCoverLetterInChat(page, inner, log);
  if (retryCover) return retryCover;

  if (await chatIframeVisible(page)) {
    log('[hh-chat] Найден iframe чата, жду загрузку…');
    try {
      await page.locator(CHAT_IFRAME_SEL).first().scrollIntoViewIfNeeded().catch(() => {});
      const fl = page.frameLocator(CHAT_IFRAME_SEL);
      await fl.locator('body').waitFor({ state: 'attached', timeout: 18_000 });
      await waitForChatInputReady(page, {
        maxMs: Math.min(20_000, iframeStepBudget),
        expectedText: opts.text,
        log,
      });
      await page.waitForTimeout(1200);
      log('[hh-chat] Вставка письма в iframe…');
      const iframeInput = fl.locator(
        '[data-qa="chatik-new-message-text"], .ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea'
      );
      if (await iframeInput.count().catch(() => 0)) {
        try {
          await iframeInput.last().click({ force: true, timeout: 10_000 });
          await page.waitForTimeout(300);
        } catch {
          /* focus optional */
        }
      }
      return await sendLetterInRoot(fl, page, inner, iframeStepBudget, false);
    } catch (e) {
      log(`[hh-chat] iframe: ${e.message} — пробуем без iframe`);
    }
  } else {
    log('[hh-chat] iframe не виден, вставка на странице…');
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      const url = frame.url() || '';
      if (!/chat|messenger|negotiation/i.test(url)) continue;
      try {
        if (await firstVisibleChatInput(frame, 1500)) {
          log(`[hh-chat] Поле ввода в frame: ${url.slice(0, 80)}`);
          return await sendLetterInRoot(frame, page, inner, timeoutMs, false);
        }
      } catch {
        /* next frame */
      }
    }
  }

  return await sendLetterInRoot(page, page, inner, timeoutMs, true);
}

