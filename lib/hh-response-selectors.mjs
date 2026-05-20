/**
 * Селекторы формы отклика на hh.ru — при смене вёрстки сайта правьте здесь.
 * Проверяйте в DevTools на странице вакансии (залогинены).
 */

import { clickHuman, typeInField } from './hh-human-delay.mjs';
import { fieldContainsExpectedText } from './field-text-verify.mjs';

/**
 * @param {import('playwright').Page} page
 */
function responseLetterRoot(page) {
  if (/applicant\/vacancy_response/i.test(page.url())) {
    return page.locator('main, [data-qa="vacancy-response"], body').first();
  }
  return page
    .locator('[data-qa="vacancy-response-popup-form"]')
    .or(page.locator('[role="dialog"]'))
    .first();
}

const COVER_LETTER_FIELD_HINT =
  /сопроводительн|cover\s*letter|письмо\s+к\s+вакансии|motivation|letter/i;
const QUESTIONNAIRE_FIELD_HINT =
  /вопрос|анкет|работодател|employer-question|additional-question|vacancy-question|зарплат|уровень|укажите|опыт|локаци/i;

/**
 * @param {string} blob
 */
export function isLikelyQuestionnaireFieldBlob(blob) {
  const b = String(blob || '');
  if (QUESTIONNAIRE_FIELD_HINT.test(b) && (/\?/.test(b) || /укажите|опишите|расскажите/i.test(b))) {
    return true;
  }
  if (/data-qa="[^"]*question/i.test(b)) return true;
  return false;
}

/**
 * @param {string} blob
 */
export function isLikelyCoverLetterFieldBlob(blob) {
  return COVER_LETTER_FIELD_HINT.test(String(blob || ''));
}

/**
 * Локаторы только поля сопроводительного (без textarea анкеты работодателя).
 * @param {import('playwright').Page} page
 */
export function coverLetterFieldLocators(page) {
  const modal = responseLetterRoot(page);
  return modal
    .getByRole('textbox', { name: /сопроводительное письмо/i })
    .or(modal.getByPlaceholder(/сопроводительн|сопроводительное|письмо к отклику/i))
    .or(modal.locator('textarea[data-qa*="letter" i], textarea[data-qa*="Letter"]'))
    .or(
      modal.locator('[data-qa*="cover-letter" i], [data-qa*="response-letter" i], [name*="letter" i]')
    );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 */
export async function verifyCoverLetterInForm(page, text) {
  const expected = String(text || '').trim();
  if (!expected) return false;

  const scoped = coverLetterFieldLocators(page);
  const n = await scoped.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    if (await fieldContainsExpectedText(scoped.nth(i), expected)) return true;
  }

  const modal = responseLetterRoot(page);
  const generic = modal.locator('textarea, [contenteditable="true"]');
  const gn = await generic.count().catch(() => 0);
  for (let i = 0; i < gn; i++) {
    const el = generic.nth(i);
    const blob = await el
      .evaluate((node) => {
        const parts = [
          node.getAttribute('aria-label') || '',
          node.getAttribute('placeholder') || '',
          node.getAttribute('data-qa') || '',
          node.getAttribute('name') || '',
        ];
        let p = node.parentElement;
        for (let d = 0; d < 8 && p; d++) {
          parts.push((p.innerText || '').slice(0, 220));
          p = p.parentElement;
        }
        return parts.join(' ');
      })
      .catch(() => '');
    if (isLikelyQuestionnaireFieldBlob(blob)) continue;
    if (!isLikelyCoverLetterFieldBlob(blob)) continue;
    if (await fieldContainsExpectedText(el, expected)) return true;
  }
  return false;
}

/**
 * @param {import('playwright').Locator} el
 * @param {import('playwright').Page | null} pageForHuman
 */
async function clickVisibleFirst(el, stepTimeoutMs, pageForHuman) {
  const first = el.first();
  await first.waitFor({ state: 'visible', timeout: stepTimeoutMs });
  await first.scrollIntoViewIfNeeded().catch(() => {});
  if (pageForHuman) {
    await clickHuman(pageForHuman, first);
  } else {
    await first.click();
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {number} stepTimeoutMs
 * @param {{ humanClicks?: boolean }} opts
 */
export async function clickVacancyResponseButton(page, stepTimeoutMs = 12_000, opts = {}) {
  const human = opts.humanClicks !== false;
  const pageForHuman = human ? page : null;

  const tryClick = async (locator, label) => {
    await clickVisibleFirst(locator, stepTimeoutMs, pageForHuman);
    return label;
  };

  const attempts = [
    () =>
      tryClick(
        page.locator('[data-qa="vacancy-response-link-top"]').or(page.locator('[data-qa="vacancy-response-link"]')),
        'data-qa vacancy-response-link'
      ),
    () => tryClick(page.locator('[data-qa*="vacancy-response"][data-qa*="link" i]'), 'data-qa vacancy-response*link'),
    () => tryClick(page.getByRole('button', { name: /откликнуться/i }), 'button[name~/Откликнуться/]'),
    () => tryClick(page.getByRole('link', { name: /откликнуться/i }), 'link[name~/Откликнуться/]'),
    () => tryClick(page.getByRole('button', { name: /^откликнуться$/i }), 'button exact Откликнуться'),
    () =>
      tryClick(
        page.locator('a[href*="vacancy_response"], a[href*="responseLetter"], a[href*="/response/"]'),
        'a href response'
      ),
    () =>
      tryClick(
        page.locator('button, a').filter({ hasText: /^Откликнуться$/i }),
        'button or link exact Откликнуться'
      ),
    () =>
      tryClick(
        page.getByRole('button', { name: /отклик(нуться)?/i }),
        'button[name~/отклик/i]'
      ),
  ];

  let lastErr;
  for (const run of attempts) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Не найдена кнопка «Откликнуться». Обновите селекторы в lib/hh-response-selectors.mjs. Причина: ${lastErr?.message || lastErr}`
  );
}

/**
 * Раскрыть блок сопроводительного, если есть кнопка «Добавить».
 * @param {import('playwright').Page} page
 */
export async function expandCoverLetterSectionIfPresent(page) {
  const btn = page.getByRole('button', { name: /сопроводительн(ое)?\s+письмо.*добавить/i }).first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click();
    await page.waitForTimeout(450);
    return true;
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 * @param {number} timeoutMs
 * @param {{ humanTyping?: boolean }} opts
 */
export async function fillCoverLetterField(page, text, timeoutMs = 20_000, opts = {}) {
  const humanTyping = opts.humanTyping === true;
  await page.waitForTimeout(400);
  await expandCoverLetterSectionIfPresent(page);

  const modal = responseLetterRoot(page);

  const tryFill = async (locator, label, stepTimeoutMs) => {
    const el = locator.first();
    await el.waitFor({ state: 'visible', timeout: stepTimeoutMs });
    await typeInField(page, locator, text, { humanTyping });
    if (!(await fieldContainsExpectedText(locator, text))) {
      throw new Error(`Текст письма не попал в поле (${label})`);
    }
    return label;
  };

  /** Короткие таймауты на шаг, чтобы при «уже откликнулись» / другом UI не висеть по 20 с × N попыток. */
  const attempts = [
    () => tryFill(modal.getByRole('textbox', { name: /сопроводительное письмо/i }), 'textbox Сопроводительное письмо', 4500),
    () =>
      tryFill(
        page.getByRole('textbox', { name: /сопроводительное письмо/i }),
        'page textbox Сопроводительное письмо',
        4500
      ),
    () =>
      tryFill(
        modal.getByPlaceholder(/сопроводительн|сопроводительное|письмо к отклику|сопроводительное письмо/i),
        'modal placeholder ~ сопроводительн',
        4500
      ),
    () =>
      tryFill(
        page.getByPlaceholder(/сопроводительн|сопроводительное|письмо к отклику|сопроводительное письмо/i),
        'placeholder ~ сопроводительн',
        4500
      ),
    () => tryFill(modal.locator('textarea[data-qa*="letter" i]'), 'modal textarea[data-qa*=letter]', 5000),
    () => tryFill(page.locator('textarea[data-qa*="letter" i]'), 'textarea[data-qa*=letter]', 5000),
    () => tryFill(modal.locator('textarea[data-qa*="Letter"]'), 'modal textarea[data-qa*=Letter]', 5000),
    () => tryFill(coverLetterFieldLocators(page).first(), 'cover-letter scoped', 6000),
    () =>
      tryFill(
        modal.locator('[data-qa*="cover-letter" i] [contenteditable="true"], [data-qa*="response-letter" i] textarea'),
        'cover-letter block',
        6000
      ),
  ];

  let lastErr;
  for (const run of attempts) {
    try {
      const label = await run();
      return label;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Не найдено поле сопроводительного письма. Обновите lib/hh-response-selectors.mjs. Причина: ${lastErr?.message || lastErr}`
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 * @param {number} timeoutMs
 * @param {{ humanTyping?: boolean }} opts
 * @returns {Promise<string|null>}
 */
export async function fillCoverLetterFieldIfPresent(page, text, timeoutMs = 12_000, opts = {}) {
  try {
    return await fillCoverLetterField(page, text, timeoutMs, opts);
  } catch {
    return null;
  }
}
