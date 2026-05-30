/**
 * Детект капчи/anti-bot на hh.ru и пауза до ручного решения пользователем в том же окне Chromium.
 * Не обход капчи — только ожидание исчезновения блока/страницы проверки.
 */

import { bringBrowserToFront } from './chromium-session.mjs';
import { pauseBatchForCaptcha, resumeBatchAfterCaptcha } from './hh-captcha-batch-pause.mjs';

const CAPTCHA_URL_RE =
  /captcha|showcaptcha|smartcaptcha|challenge|cf-challenge|__cf_bm|turnstile|recaptcha/i;

const CAPTCHA_TEXT_SNIPPETS = [
  /капч/i,
  /подтвердите,?\s*что\s*вы\s*(не\s*)?робот/i,
  /подтвердите\s*,?\s*что\s*вы\s*человек/i,
  /докажите,?\s*что\s*вы\s*не\s*робот/i,
  /проверка\s*безопасности/i,
  /доступ\s*ограничен/i,
  /слишком\s*много\s*запросов/i,
  /verify\s*you\s*are\s*human/i,
  /are\s*you\s*a\s*robot/i,
];

/** @type {((page: import('playwright').Page) => Promise<import('playwright').Page>) | null} */
let visibleEscalationHandler = null;

/**
 * Регистрация «экстренного» открытия окна (батч headless → видимый Chromium на время капчи).
 * @param {(page: import('playwright').Page) => Promise<import('playwright').Page>} fn
 */
export function registerCaptchaVisibleEscalation(fn) {
  visibleEscalationHandler = fn;
}

export function unregisterCaptchaVisibleEscalation() {
  visibleEscalationHandler = null;
}

function isHeadlessMode() {
  return (
    String(process.env.HH_HEADLESS || '').trim() === '1' ||
    String(process.env.PLAYWRIGHT_HEADLESS || '').trim() === '1'
  );
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<{ active: boolean, hints: string[] }>}
 */
export async function detectHhCaptcha(page) {
  const hintSet = new Set();
  try {
    const url = String(page.url() || '');
    if (CAPTCHA_URL_RE.test(url)) hintSet.add('url');

    const body = await page
      .evaluate(() => (document.body?.innerText || '').slice(0, 12_000))
      .catch(() => '');
    const bodyLow = body.toLowerCase();
    for (const re of CAPTCHA_TEXT_SNIPPETS) {
      if (re.test(bodyLow) || re.test(body)) hintSet.add('text');
    }

    const iframeCaptcha = await page
      .locator(
        'iframe[src*="captcha" i], iframe[src*="smartcaptcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i], iframe[src*="challenges.cloudflare.com" i]'
      )
      .count()
      .catch(() => 0);
    if (iframeCaptcha > 0) hintSet.add(`iframe×${iframeCaptcha}`);

    const widget = await page
      .locator(
        '[class*="Captcha" i], [data-qa*="captcha" i], [class*="SmartCaptcha" i], [id*="capch" i], [id*="captcha" i]'
      )
      .first()
      .isVisible({ timeout: 350 })
      .catch(() => false);
    if (widget) hintSet.add('widget');

    const title = await page.title().catch(() => '');
    if (/captcha|проверк|доступ ограничен|robot/i.test(title)) hintSet.add('title');

    const vacancyLike = await page
      .locator('[data-qa="vacancy-title"]')
      .first()
      .isVisible({ timeout: 450 })
      .catch(() => false);
    if (
      vacancyLike &&
      !CAPTCHA_URL_RE.test(url) &&
      iframeCaptcha === 0 &&
      !widget &&
      hintSet.has('text')
    ) {
      hintSet.delete('text');
    }
  } catch {
    /* ignore */
  }

  const hints = [...hintSet];
  return { active: hints.length > 0, hints };
}

function defaultMaxWaitMs() {
  const raw = String(process.env.HH_CAPTCHA_WAIT_MS || '').trim();
  if (raw && Number.isFinite(Number(raw)) && Number(raw) >= 5000) return Number(raw);
  return 600_000;
}

function pollIntervalMs() {
  const raw = String(process.env.HH_CAPTCHA_POLL_MS || '').trim();
  if (raw && Number.isFinite(Number(raw)) && Number(raw) >= 400) return Number(raw);
  return 2000;
}

/**
 * Если на странице видна капча — ждём, пока пользователь решит её в браузере.
 * В headless без обработчика — ошибка. С registerCaptchaVisibleEscalation — открывается окно.
 *
 * @param {import('playwright').Page} page
 * @param {{ log?: (s: string) => void, maxWaitMs?: number, context?: string } | undefined} opts
 * @returns {Promise<{ ok: boolean, page: import('playwright').Page }>}
 */
export async function ensureNoCaptchaBlocking(page, opts = {}) {
  const log = opts.log || ((s) => console.log(s));
  const maxWaitMs = opts.maxWaitMs ?? defaultMaxWaitMs();
  const pollMs = pollIntervalMs();
  const ctxLabel = opts.context ? ` (${opts.context})` : '';

  let activePage = page;
  let { active, hints } = await detectHhCaptcha(activePage);
  if (!active) return { ok: true, page: activePage };

  const headless = isHeadlessMode();
  if (headless) {
    if (visibleEscalationHandler) {
      activePage = await visibleEscalationHandler(activePage);
      await bringBrowserToFront(activePage.context());
      ({ active, hints } = await detectHhCaptcha(activePage));
      if (!active) return { ok: true, page: activePage };
    } else {
      throw new Error(
        `[hh-captcha${ctxLabel}] Страница с проверкой/капчей (${hints.join(', ')}). ` +
          'Режим без окна (HH_HEADLESS=1) и нет обработчика экстренного открытия браузера.'
      );
    }
  }

  if (pauseBatchForCaptcha(hints)) {
    log(
      `[hh-captcha${ctxLabel}] Батч на паузе — пройдите проверку в Chromium. ` +
        `Ожидание до ${Math.ceil(maxWaitMs / 60_000)} мин…`
    );
  } else {
    log(
      `[hh-captcha${ctxLabel}] Обнаружена защита hh.ru: ${hints.join('; ')}. ` +
        `Пройдите проверку в окне Chromium. Ожидание до ${Math.ceil(maxWaitMs / 60_000)} мин…`
    );
  }

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await activePage.waitForTimeout(pollMs).catch(() => {});
    const next = await detectHhCaptcha(activePage);
    if (!next.active) {
      if (resumeBatchAfterCaptcha()) {
        log(
          `[hh-captcha${ctxLabel}] Проверка снята за ${Math.round((Date.now() - start) / 1000)} с. Батч продолжается.`
        );
      } else {
        log(`[hh-captcha${ctxLabel}] Проверка снята за ${Math.round((Date.now() - start) / 1000)} с. Продолжаю.`);
      }
      return { ok: true, page: activePage };
    }
  }

  throw new Error(
    `[hh-captcha${ctxLabel}] Таймаут ожидания капчи (${maxWaitMs} мс). Решите проверку и повторите шаг (или увеличьте HH_CAPTCHA_WAIT_MS).`
  );
}
