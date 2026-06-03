/**
 * Режим окна Playwright для сбора (harvest) и батча откликов.
 *
 * hidden-captcha (по умолчанию): без окна / свёрнуто; при капче — на передний план.
 * visible: окно всегда видно.
 * headless: полностью без окна (капча не откроется автоматически).
 */

export const PLAYWRIGHT_DISPLAY_MODES = {
  hiddenCaptcha: 'hidden-captcha',
  visible: 'visible',
  headless: 'headless',
};

export const PLAYWRIGHT_DISPLAY_MODE_OPTIONS = [
  {
    id: PLAYWRIGHT_DISPLAY_MODES.hiddenCaptcha,
    label: 'Скрытый · капча на экране',
    hint: 'Сбор без окна; батч — свёрнуто. При капче Chromium открывается поверх.',
  },
  {
    id: PLAYWRIGHT_DISPLAY_MODES.visible,
    label: 'Всегда видимый',
    hint: 'Окно браузера на экране на всё время сбора или батча.',
  },
  {
    id: PLAYWRIGHT_DISPLAY_MODES.headless,
    label: 'Без окна',
    hint: 'Headless без автоматического открытия при капче (только для отладки).',
  },
];

/** @param {unknown} raw */
export function normalizePlaywrightDisplayMode(raw) {
  const s = String(raw || '').trim();
  if (s === PLAYWRIGHT_DISPLAY_MODES.visible) return PLAYWRIGHT_DISPLAY_MODES.visible;
  if (s === PLAYWRIGHT_DISPLAY_MODES.headless) return PLAYWRIGHT_DISPLAY_MODES.headless;
  return PLAYWRIGHT_DISPLAY_MODES.hiddenCaptcha;
}

/**
 * @param {'harvest'|'batch'} job
 * @param {Record<string, unknown> | null | undefined} [prefs]
 * @returns {{ mode: string, headless: boolean, browserBackground: boolean, captchaEscalate: boolean }}
 */
export function resolvePlaywrightDisplay(job, prefs) {
  const mode = normalizePlaywrightDisplayMode(
    process.env.HH_PLAYWRIGHT_DISPLAY_MODE || prefs?.dashboardPlaywrightDisplayMode
  );

  if (mode === PLAYWRIGHT_DISPLAY_MODES.visible) {
    return { mode, headless: false, browserBackground: false, captchaEscalate: true };
  }
  if (mode === PLAYWRIGHT_DISPLAY_MODES.headless) {
    return { mode, headless: true, browserBackground: false, captchaEscalate: false };
  }

  // hidden-captcha
  if (job === 'harvest') {
    return { mode, headless: true, browserBackground: true, captchaEscalate: true };
  }
  return { mode, headless: false, browserBackground: true, captchaEscalate: true };
}

/**
 * Переменные окружения для spawn дочернего процесса (harvest / batch).
 * @param {'harvest'|'batch'} job
 * @param {Record<string, unknown> | null | undefined} [prefs]
 */
export function playwrightDisplayEnv(job, prefs) {
  const cfg = resolvePlaywrightDisplay(job, prefs);
  return {
    HH_PLAYWRIGHT_DISPLAY_MODE: cfg.mode,
    HH_HEADLESS: cfg.headless ? '1' : '0',
    HH_BROWSER_BACKGROUND: cfg.browserBackground ? '1' : '0',
    HH_CAPTCHA_ESCALATE: cfg.captchaEscalate ? '1' : '0',
  };
}
