/**
 * Smoke: модалка настроек — пресеты, сохранение, deep link, раскладка окна.
 *   node scripts/test-dashboard-settings.mjs
 * Требуется дашборд на DASHBOARD_URL (по умолчанию :3849).
 */
import { chromium } from 'playwright';
import {
  attachPageErrorCollector,
  getDashboardAppScriptPath,
  gotoDashboardReady,
  openSettingsModal,
  waitSettingsModalHidden,
  waitSettingsModalOpen,
} from './lib/dashboard-test-helpers.mjs';
import { SETTINGS_TAB_IDS } from '../lib/dashboard-static-check.mjs';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

async function main() {
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErr = attachPageErrorCollector(page);

  try {
    try {
      await gotoDashboardReady(page, BASE);
    } catch (e) {
      throw new Error(
        `Дашборд не готов на ${BASE} — запустите npm run dashboard и убедитесь, что список загрузился. ${e.message}`
      );
    }

    const appPath = await getDashboardAppScriptPath(page);
    if (!appPath.includes('app.js')) {
      errors.push('settings: в index нет script app.js');
    } else {
      const head = await page.evaluate(async (src) => {
        const res = await fetch(src, { method: 'HEAD' });
        return res.ok ? null : `HEAD ${res.status}`;
      }, appPath);
      if (head) errors.push(`settings: ${appPath} — ${head}`);
    }

    const loadErrors = pageErr.drainUnique();
    if (loadErrors.length) {
      errors.push(`settings: pageerror при загрузке: ${loadErrors.join('; ')}`);
    }

    await openSettingsModal(page);

    const badInitToast = await page
      .locator('.toast--bad')
      .filter({ hasText: /не загрузились/i })
      .count();
    if (badInitToast > 0) {
      errors.push('settings: тост «не загрузились» — модуль settings-modal не подключился');
    }

    for (const tab of SETTINGS_TAB_IDS) {
      await page.locator(`[data-settings-tab="${tab}"]`).click();
      await page.waitForTimeout(60);
      const panelOk = await page.evaluate((tabId) => {
        const panel = document.getElementById(`settings-panel-${tabId}`);
        const btn = document.querySelector(`[data-settings-tab="${tabId}"]`);
        return Boolean(panel && !panel.hidden && btn?.classList.contains('active'));
      }, tab);
      if (!panelOk) errors.push(`settings tabs: вкладка «${tab}» не активировала панель`);
    }

    const layoutBar = await page.locator('#settings-layout-bar').count();
    if (layoutBar < 1) errors.push('settings: нет полосы пресетов окна (#settings-layout-bar)');

    await page.locator('[data-settings-layout-preset="compact"]').first().click();
    await page.waitForTimeout(200);
    const compactW = await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v4');
      return dlg ? Math.round(dlg.getBoundingClientRect().width) : 0;
    });
    if (compactW < 400 || compactW > 520) {
      errors.push(`settings layout: compact width=${compactW}, ожидалось ~448`);
    }

    await page.locator('[data-settings-path="limits"]').click();
    await page.waitForTimeout(200);
    const limitsPanel = await page.evaluate(
      () => !document.getElementById('settings-panel-apply')?.hidden
    );
    if (!limitsPanel) errors.push('settings quick path: «Лимиты» не открыл вкладку Отклики');

    await page.locator('[data-settings-tab="targeting"]').click();
    await page.waitForTimeout(80);
    const targetingField = page.locator('#pref-min-monthly-rub');
    if (await targetingField.count()) {
      const prev = await targetingField.inputValue();
      await targetingField.fill(String(Number(prev || 0) + 1000));
      await page.waitForTimeout(40);
      const dirtyTargeting = await page.evaluate(() =>
        document
          .querySelector('[data-settings-tab="targeting"]')
          ?.classList.contains('settings-tabs__btn--dirty')
      );
      const dirtyLetters = await page.evaluate(() =>
        document
          .querySelector('[data-settings-tab="letters"]')
          ?.classList.contains('settings-tabs__btn--dirty')
      );
      if (!dirtyTargeting) errors.push('settings: dirty только на вкладке targeting');
      if (dirtyLetters) errors.push('settings: dirty ошибочно на вкладке letters');
      await targetingField.fill(prev);
    }

    await page.locator('[data-settings-tab="letters"]').click();
    await page.waitForTimeout(120);
    await page.locator('[data-letter-preset="strict"]').click();
    await page.locator('#btn-settings-save-now').click();
    await page
      .waitForFunction(
        () => document.getElementById('settings-save-hint')?.textContent?.includes('Сохранено'),
        null,
        { timeout: 10_000 }
      )
      .catch(() => errors.push('settings: нет «Сохранено» после пресета Строгий'));

    const prefs = await page.evaluate(async () => {
      const res = await fetch('/api/preferences');
      const data = await res.json();
      return data.preferences || {};
    });
    if (prefs.batchLetterRequireMetric !== true) {
      errors.push('settings API: batchLetterRequireMetric !== true после Строгий');
    }
    if (prefs.batchAutoApproveBestLetter !== true) {
      errors.push('settings API: batchAutoApproveBestLetter !== true после Строгий');
    }

    const chips = await page.locator('#settings-dialog-summary .settings-chip').count();
    if (chips < 2) errors.push('settings: мало чипов в сводке');

    await page.locator('[data-settings-tab="appearance"]').click();
    await page.waitForTimeout(80);
    const appearancePanel = await page.evaluate(
      () => !document.getElementById('settings-panel-appearance')?.hidden
    );
    if (!appearancePanel) errors.push('settings: вкладка «Интерфейс» не открылась');

    await page.keyboard.press('Escape');
    await waitSettingsModalHidden(page);

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('hh-open-settings', {
          detail: { tab: 'apply', focus: 'settings-limits-hh' },
        })
      );
    });
    await waitSettingsModalOpen(page);
    const eventOpenOk = await page.evaluate(
      () =>
        !document.getElementById('settings-panel-apply')?.hidden &&
        document.getElementById('settings-limits-hh')
    );
    if (!eventOpenOk) errors.push('settings: hh-open-settings не открыл apply + лимиты');

    await page.locator('#settings-modal .modal-backdrop').click({ position: { x: 12, y: 12 } });
    await waitSettingsModalHidden(page);

    await page.goto(`${BASE}/?settings=letters&focus=fp`, { waitUntil: 'domcontentloaded' });
    await waitSettingsModalOpen(page);
    const deepOk = await page.evaluate(() => {
      const panel = document.getElementById('settings-panel-letters');
      const fp = document.getElementById('batch-false-positive-max');
      return Boolean(panel && !panel.hidden && fp);
    });
    if (!deepOk) errors.push('settings deep link: letters + поле FP');

    await page.keyboard.press('Alt+1');
    await page.waitForTimeout(80);
    const systemPanel = await page.evaluate(
      () => !document.getElementById('settings-panel-system')?.hidden
    );
    if (!systemPanel) errors.push('settings: Alt+1 не переключил на Система');

    await page.locator('[data-settings-tab="targeting"]').click();
    await page.waitForTimeout(80);
    await page.locator('#pref-min-monthly-rub').fill('155000');
    const dirtyTabIds = await page.evaluate(() =>
      [...document.querySelectorAll('.settings-tabs__btn--dirty')].map(
        (b) => b.getAttribute('data-settings-tab')
      )
    );
    if (dirtyTabIds.length !== 1 || dirtyTabIds[0] !== 'targeting') {
      errors.push(`settings dirty per-tab: ожидали [targeting], получили ${dirtyTabIds.join(',')}`);
    }
    const revertVisible = await page.evaluate(() => {
      const btn = document.getElementById('btn-settings-revert-tab');
      return btn && !btn.hidden;
    });
    if (!revertVisible) errors.push('settings: «Отменить на вкладке» не видна при dirty');
    await page.locator('#btn-settings-revert-tab').click();
    await page.waitForTimeout(80);
    const reverted = await page.evaluate(() => {
      const btn = document.querySelector('[data-settings-tab="targeting"]');
      return !btn?.classList.contains('settings-tabs__btn--dirty');
    });
    if (!reverted) errors.push('settings: отмена на вкладке не сняла dirty');

    await page.locator('#pref-min-monthly-rub').fill('155000');
    await page.locator('#btn-settings-save-now').click();
    await page
      .waitForFunction(
        () => document.getElementById('settings-save-hint')?.textContent?.includes('Сохранено'),
        null,
        { timeout: 10_000 }
      )
      .catch(() => errors.push('settings: нет «Сохранено» после таргетинга'));
    const targetingPrefs = await page.evaluate(async () => {
      const res = await fetch('/api/preferences');
      return (await res.json()).preferences || {};
    });
    if (targetingPrefs.minMonthlyRub !== 155000) {
      errors.push('settings API: minMonthlyRub !== 155000 после таргетинга');
    }

    await page.locator('#settings-modal .modal-close--settings').click();
    await waitSettingsModalHidden(page);

    await page.goto(`${BASE}/?settings=targeting&settingsLayout=wide`, {
      waitUntil: 'domcontentloaded',
    });
    await waitSettingsModalOpen(page);
    const wideW = await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v4');
      return dlg ? Math.round(dlg.getBoundingClientRect().width) : 0;
    });
    if (wideW < 800) errors.push(`settings layout deep link: wide width=${wideW}, ожидалось ≥800`);
    const wideBtn = await page.evaluate(() =>
      document.querySelector('[data-settings-layout-preset="wide"]')?.classList.contains('active')
    );
    if (!wideBtn) errors.push('settings layout deep link: пресет «Широкое» не активен');

    await page.evaluate(() => {
      const modal = document.getElementById('batch-report-modal');
      if (!modal) return;
      modal.hidden = false;
      modal.classList.add('modal--open');
    });
    const batchActions = await page.locator('[data-batch-report-settings]').count();
    if (batchActions < 3) {
      errors.push('batch-report: нет кнопок перехода в настройки');
    }
    await page.locator('[data-batch-report-settings="fp"]').click();
    await waitSettingsModalOpen(page);
    const fpField = await page.evaluate(() => Boolean(document.getElementById('batch-false-positive-max')));
    if (!fpField) errors.push('batch-report→settings: не открыл поле FP');
    await page.keyboard.press('Escape');
    await waitSettingsModalHidden(page);
    await page.evaluate(() => {
      const m = document.getElementById('batch-report-modal');
      if (m) {
        m.classList.remove('modal--open');
        m.hidden = true;
      }
    });

    const sessionErrors = pageErr.drainUnique();
    if (sessionErrors.length) {
      errors.push(`settings: pageerror за сессию: ${sessionErrors.join('; ')}`);
    }
  } finally {
    await browser.close();
  }

  if (errors.length) {
    console.error('FAIL:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('OK: test-dashboard-settings.mjs');
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
