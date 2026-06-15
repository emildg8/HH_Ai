/**
 * Проверка: в простом режиме нет англ. жаргона в видимых подписях.
 *   node scripts/test-dashboard-copy.mjs
 */
import { chromium } from 'playwright';
import { gotoDashboardReady } from './lib/dashboard-test-helpers.mjs';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

const JARGON = [
  /\bbatch\b/i,
  /\bharvest\b/i,
  /\bProbe\b/,
  /\bPrune\b/,
  /\bL2\/L3\b/,
  /\bPlaywright\b/,
  /\bLLM\b/,
  /\brouting\b/i,
  /\bHH_PROFILE\b/,
  /\bhash\b/i,
  /Из routing/i,
  /Ручн\./,
  /Без анк\./,
  /Отлож\./,
  /\bTier\b/,
  /\bATS\b/,
  /Habr \//,
  /spoken English/i,
  /\bingest\b/i,
  /Класс\s*[АБВГ]/,
  /класс\s*[а-яё]/i,
];

function collectVisibleText() {
  const parts = [];
  const walk = (el) => {
    if (!el || el.nodeType !== 1) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return;
    if (el.classList?.contains('ui-expert-only')) return;
    if (el.closest?.('[hidden]')) return;
    if (el.id === 'list' || el.closest?.('#list')) return;
    if (el.closest?.('#vacancy-detail-body')) return;
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        const t = child.textContent?.trim();
        if (t) parts.push(t);
      } else walk(child);
    }
  };
  walk(document.body);
  return parts.join(' ');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await gotoDashboardReady(page, BASE);

  await page.evaluate(() => {
    document.documentElement.dataset.uiMode = 'simple';
    document.getElementById('app-shell')?.setAttribute('data-ui-mode', 'simple');
  });
  await page.waitForFunction(
    () => document.documentElement.dataset.uiMode === 'simple',
    null,
    { timeout: 5000 }
  );

  const shellText = await page.evaluate(collectVisibleText);
  const hits = [];
  for (const re of JARGON) {
    const m = shellText.match(re);
    if (m) hits.push(`${re}: «${m[0]}»`);
  }

  await page.locator('#btn-open-settings').click();
  await page.waitForSelector('#settings-modal.modal--open', { timeout: 5000 });
  const settingsText = await page.evaluate(() => {
    const modal = document.getElementById('settings-modal');
    const parts = [];
    const walk = (el) => {
      if (!el || el.nodeType !== 1) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (el.hidden) return;
      if (el.classList?.contains('ui-expert-only')) return;
      for (const child of el.childNodes) {
        if (child.nodeType === 3) {
          const t = child.textContent?.trim();
          if (t) parts.push(t);
        } else walk(child);
      }
    };
    walk(modal);
    return parts.join(' ');
  });
  if (/HH_PROFILE/i.test(settingsText)) hits.push('HH_PROFILE в настройках (simple)');
  if (/config\/profiles/i.test(settingsText)) hits.push('config/profiles в настройках (simple)');

  await browser.close();

  if (hits.length) throw new Error(hits.join('\n'));
  console.log('test-dashboard-copy: OK (simple mode, без жаргона)');
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
