/**
 * Единые опции запуска Playwright: bundled Chromium (после npx playwright install chromium).
 * HH_PLAYWRIGHT_CHANNEL=chrome — только если нужен системный Chrome.
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

/**
 * @param {import('playwright').BrowserContextOptions} [base]
 * @returns {import('playwright').BrowserContextOptions}
 */
export function buildPlaywrightLaunchOpts(base = {}) {
  const opts = {
    headless: process.env.HH_HEADLESS === '1',
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
    ...base,
  };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) opts.channel = ch;
  return opts;
}

/** Проверка, что bundled Chromium установлен (ms-playwright или локальная папка). */
export function playwrightChromiumInstalled() {
  const local = path.join(ROOT, '.playwright-browsers');
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH)) {
    return true;
  }
  const ms = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
    : '';
  if (ms && fs.existsSync(ms)) {
    try {
      if (fs.readdirSync(ms).some((n) => /^chromium-\d+$/i.test(n))) return true;
    } catch {
      /* */
    }
  }
  if (fs.existsSync(local)) {
    try {
      return fs.readdirSync(local).some((n) => n.startsWith('chromium'));
    } catch {
      return false;
    }
  }
  return false;
}
