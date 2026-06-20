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

const LAYOUT_TAB_IDS = ['system', 'appearance', 'teleprompter', 'expert'];

/** @param {import('playwright').Page} page */
async function readSettingsLayoutMetrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#settings-modal .settings-nav');
    const content = document.querySelector('#settings-modal .settings-content');
    const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
    const shell = document.querySelector('#settings-modal .settings-shell');
    const nr = nav?.getBoundingClientRect();
    const cr = content?.getBoundingClientRect();
    const dr = dlg?.getBoundingClientRect();
    return {
      navVisible: Boolean(nr && nr.width > 50 && getComputedStyle(nav).display !== 'none'),
      contentRatio: cr && dr && dr.width > 0 ? cr.width / dr.width : 0,
      drill: shell?.classList.contains('settings-shell--drill') ?? false,
      solo: shell?.classList.contains('settings-shell--solo') ?? false,
      sidebar: shell?.classList.contains('settings-shell--sidebar') ?? false,
      wide: shell?.classList.contains('settings-shell--wide') ?? false,
      gridColumnStart: content ? getComputedStyle(content).gridColumnStart : '',
      build: document.querySelector('#settings-modal [data-settings-build]')?.getAttribute('data-settings-build') || '',
    };
  });
}

/** @param {import('playwright').Page} page */
async function assertSettingsFooterInDialog(page) {
  return page.evaluate(() => {
    const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
    const footer = document.querySelector('#settings-modal .settings-footer--v5');
    if (!dlg || !footer) return 'нет диалога или футера';
    const dr = dlg.getBoundingClientRect();
    const fr = footer.getBoundingClientRect();
    const tol = 4;
    if (fr.left < dr.left - tol || fr.right > dr.right + tol) {
      return `выходит за ширину диалога (dlg ${Math.round(dr.left)}–${Math.round(dr.right)}, footer ${Math.round(fr.left)}–${Math.round(fr.right)})`;
    }
    if (fr.bottom > dr.bottom + tol || fr.top < dr.top + dr.height * 0.45) {
      return `не внизу диалога (dlg bottom ${Math.round(dr.bottom)}, footer top ${Math.round(fr.top)})`;
    }
    return null;
  });
}

/** @param {import('playwright').Page} page @param {string} tab */
async function assertDesktopSettingsLayout(page, tab) {
  await page.locator(`[data-settings-tab="${tab}"]`).click();
  await page.waitForTimeout(80);
  const layout = await readSettingsLayoutMetrics(page);
  if (!layout.navVisible) {
    return `settings layout [${tab}]: nav не виден на desktop`;
  }
  if (layout.contentRatio < 0.65) {
    return `settings layout [${tab}]: content/dialog=${layout.contentRatio.toFixed(2)}, ожидалось ≥0.65`;
  }
  if (layout.drill || layout.solo) {
    return `settings layout [${tab}]: залип drill/solo на desktop`;
  }
  if (!layout.sidebar && !layout.wide) {
    return `settings layout [${tab}]: нет settings-shell--sidebar/--wide на desktop`;
  }
  if (!layout.wide) {
    return `settings layout [${tab}]: нет settings-shell--wide на desktop`;
  }
  return null;
}

/** @param {import('playwright').Page} page */
async function waitSettingsSaveIdle(page) {
  await page.waitForFunction(
    () => !document.getElementById('settings-modal')?.classList.contains('settings-dialog--saving'),
    null,
    { timeout: 15_000 }
  );
}

async function main() {
  const errors = [];
  let step = 'start';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  const pageErr = attachPageErrorCollector(page);

  try {
    try {
      step = 'gotoDashboardReady';
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
    await page.waitForFunction(
      () => {
        const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
        return Boolean(dlg && dlg.getBoundingClientRect().width > 900);
      },
      null,
      { timeout: 8000 }
    );

    const badInitToast = await page
      .locator('.toast--bad')
      .filter({ hasText: /не загрузились/i })
      .count();
    if (badInitToast > 0) {
      errors.push('settings: тост «не загрузились» — модуль settings-modal не подключился');
    }

    const toolbar = await page.locator('#settings-toolbar').count();
    if (toolbar > 0) errors.push('settings: устаревший #settings-toolbar');

    const navOk = await page.locator('.settings-nav').count();
    if (navOk < 1) errors.push('settings: нет боковой навигации (.settings-nav)');

    const layoutRatio = await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
      const shell = document.querySelector('#settings-modal .settings-shell');
      if (!dlg || !shell) return 0;
      const dw = dlg.getBoundingClientRect().width;
      const sw = shell.getBoundingClientRect().width;
      return dw > 0 ? sw / dw : 0;
    });
    if (layoutRatio < 0.85) {
      errors.push(`settings layout: shell/dialog=${layoutRatio.toFixed(2)}, ожидалось ≥0.85`);
    }

    const defaultDlgW = await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
      return dlg ? Math.round(dlg.getBoundingClientRect().width) : 0;
    });
    if (defaultDlgW < 990) {
      errors.push(`settings layout: дефолтная ширина=${defaultDlgW}, ожидалось ≥990 (~1120)`);
    }

    let footerLayoutErr = await assertSettingsFooterInDialog(page);
    if (footerLayoutErr) errors.push(`settings footer [desktop]: ${footerLayoutErr}`);

    await page.setViewportSize({ width: 3840, height: 1080 });
    await page.waitForTimeout(150);
    await page.locator('[data-settings-tab="apply"]').click();
    await page.waitForTimeout(120);
    footerLayoutErr = await assertSettingsFooterInDialog(page);
    if (footerLayoutErr) errors.push(`settings footer [ultrawide]: ${footerLayoutErr}`);
    await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
      if (dlg) {
        dlg.style.width = '3200px';
        dlg.style.maxWidth = '3200px';
        dlg.classList.add('settings-dialog--user-sized');
      }
    });
    await page.waitForTimeout(80);
    await page.evaluate(() => window.hhEnforceSettingsDialogBounds?.());
    await page.waitForTimeout(80);
    footerLayoutErr = await assertSettingsFooterInDialog(page);
    if (footerLayoutErr) {
      errors.push(`settings footer [ultrawide forced-wide]: ${footerLayoutErr}`);
    }
    await page.locator('[data-conversion-preset="quality"]').click();
    await page.waitForTimeout(350);
    footerLayoutErr = await assertSettingsFooterInDialog(page);
    if (footerLayoutErr) errors.push(`settings footer [gate preset]: ${footerLayoutErr}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(150);

    const buildMark = await page.evaluate(
      () => document.querySelector('#settings-modal [data-settings-build]')?.getAttribute('data-settings-build') || ''
    );
    if (buildMark !== 'settings9') {
      errors.push(`settings layout: маркер сборки «${buildMark || 'нет'}», ожидалось settings9`);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    for (const tab of LAYOUT_TAB_IDS) {
      const layoutErr = await assertDesktopSettingsLayout(page, tab);
      if (layoutErr) errors.push(layoutErr);
    }

    await page.setViewportSize({ width: 680, height: 800 });
    await page.waitForTimeout(200);
    await page.locator('[data-settings-tab="teleprompter"]').click();
    await page.waitForTimeout(80);
    const narrowVpLayout = await readSettingsLayoutMetrics(page);
    const narrowVpDialogW = await page.evaluate(
      () => document.querySelector('#settings-modal .settings-dialog--v5')?.getBoundingClientRect().width ?? 0
    );
    if (narrowVpDialogW <= 640) {
      errors.push(`settings layout [dialog-wide]: dialogW=${Math.round(narrowVpDialogW)}, ожидалось >640`);
    }
    if (!narrowVpLayout.navVisible) {
      errors.push('settings layout [dialog-wide]: nav не виден при широкой модалке');
    }
    if (!narrowVpLayout.wide) {
      errors.push('settings layout [dialog-wide]: нет settings-shell--wide');
    }
    if (narrowVpLayout.contentRatio < 0.65) {
      errors.push(
        `settings layout [dialog-wide]: content/dialog=${narrowVpLayout.contentRatio.toFixed(2)}, ожидалось ≥0.65`
      );
    }
    await page.locator('[data-settings-tab="appearance"]').click();
    await page.waitForTimeout(80);
    const narrowVpAppearance = await readSettingsLayoutMetrics(page);
    if (narrowVpAppearance.contentRatio < 0.65) {
      errors.push(
        `settings layout [dialog-wide appearance]: content/dialog=${narrowVpAppearance.contentRatio.toFixed(2)}, ожидалось ≥0.65`
      );
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(150);

    await page.locator('[data-settings-tab="appearance"]').click();
    await page.waitForTimeout(80);
    const segOverlap = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#settings-panel-appearance .settings-seg--mode .seg-btn')];
      if (btns.length < 2) return false;
      const rects = btns.map((b) => b.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlap =
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1;
          if (overlap) return true;
        }
      }
      return false;
    });
    if (segOverlap) errors.push('settings layout: segmented «Простой/Расширенный» наезжают');

    await page.locator('[data-settings-tab="appearance"]').click();
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      const nav = document.querySelector('#settings-modal .settings-nav');
      if (nav instanceof HTMLElement) nav.style.display = 'none';
      document.querySelector('.settings-shell')?.classList.add('settings-shell--drill');
    });
    const hiddenNavLayout = await readSettingsLayoutMetrics(page);
    if (hiddenNavLayout.contentRatio < 0.65) {
      errors.push(
        `settings layout [hidden nav]: content/dialog=${hiddenNavLayout.contentRatio.toFixed(2)}, ожидалось ≥0.65`
      );
    }
    if (hiddenNavLayout.gridColumnStart !== '2') {
      errors.push(
        `settings layout [hidden nav]: grid-column-start=${hiddenNavLayout.gridColumnStart}, ожидалось 2`
      );
    }
    await page.evaluate(() => {
      const nav = document.querySelector('#settings-modal .settings-nav');
      if (nav instanceof HTMLElement) nav.style.removeProperty('display');
      const shell = document.querySelector('.settings-shell');
      shell?.classList.remove('settings-shell--drill', 'settings-shell--solo', 'settings-shell--pick');
      shell?.classList.add('settings-shell--sidebar');
    });

    const labelCaps = await page.evaluate(() => {
      const el = document.querySelector('#settings-panel-teleprompter .settings-field__label');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.textTransform === 'uppercase';
    });
    if (labelCaps) errors.push('settings: подписи полей в капсе (ожидался sentence case)');

    const hubExtra = await page.locator('#letter-hub-extra').count();
    if (hubExtra > 0) errors.push('settings: устаревший #letter-hub-extra в DOM');

    const profileOpts = await page.evaluate(() => {
      const sel = document.getElementById('settings-profile-select');
      return sel ? sel.options.length : 0;
    });
    if (profileOpts < 1) {
      errors.push('settings: #settings-profile-select без опций после открытия');
    }

    const footerJargon = await page.locator('#settings-footer-tab-note').count();
    if (footerJargon > 0) {
      errors.push('settings: устаревший #settings-footer-tab-note в футере');
    }

    const autosaveHint = await page.evaluate(
      () => document.getElementById('settings-save-hint')?.textContent || ''
    );
    if (!/сохраняются автоматически/i.test(autosaveHint)) {
      errors.push(`settings: нет подсказки автосохранения в футере («${autosaveHint}»)`);
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
    if (layoutBar < 1) errors.push('settings: нет пресетов окна (#settings-layout-bar)');

    await page.locator('[data-settings-tab="appearance"]').click();
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      document.querySelector('#settings-layout-bar [data-settings-layout-preset="compact"]')?.click();
    });
    await page
      .waitForFunction(
        () => {
          const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
          if (!dlg) return false;
          const w = Math.round(dlg.getBoundingClientRect().width);
          return w >= 860 && w <= 940;
        },
        null,
        { timeout: 5000 }
      )
      .catch(() => {});
    const compactW = await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v5, #settings-modal .settings-dialog--v4');
      return dlg ? Math.round(dlg.getBoundingClientRect().width) : 0;
    });
    if (compactW < 860 || compactW > 940) {
      errors.push(`settings layout: compact width=${compactW}, ожидалось ~900`);
    }

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('hh-open-settings', {
          detail: { tab: 'apply', focus: 'settings-limits-hh' },
        })
      );
    });
    await page.waitForTimeout(200);
    const limitsPanel = await page.evaluate(
      () => !document.getElementById('settings-panel-apply')?.hidden
    );
    if (!limitsPanel) errors.push('settings deep link: apply + лимиты не открылись');

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
          ?.classList.contains('settings-nav__btn--dirty')
      );
      const dirtyApply = await page.evaluate(() =>
        document
          .querySelector('[data-settings-tab="apply"]')
          ?.classList.contains('settings-nav__btn--dirty')
      );
      if (!dirtyTargeting) errors.push('settings: dirty только на вкладке targeting');
      if (dirtyApply) errors.push('settings: dirty ошибочно на вкладке apply');
      await targetingField.fill(prev);
    }

    await page.locator('[data-settings-tab="letters"]').click();
    await page.waitForTimeout(120);
    await page.locator('[data-letter-preset="strict"]').click();
    await page.waitForTimeout(80);
    const saveVisible = await page.locator('#btn-settings-save-now').isVisible();
    if (!saveVisible) errors.push('settings: «Сохранить сейчас» не появилась после изменения');
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

    await page.locator('[data-settings-tab="teleprompter"]').click();
    await page.waitForTimeout(120);
    const telePanel = await page.evaluate(
      () => !document.getElementById('settings-panel-teleprompter')?.hidden
    );
    if (!telePanel) errors.push('settings: вкладка «Суфлёр» не открылась');
    const micSelect = page.locator('#settings-mic-select');
    if (await micSelect.count()) {
      if ((await micSelect.locator('option').count()) < 1) await page.waitForTimeout(400);
      const optionCount = await micSelect.locator('option').count();
      if (optionCount < 1) errors.push('settings: #settings-mic-select без опций');
      const firstVal = await micSelect.evaluate((sel) => {
        const o = sel.options[1] || sel.options[0];
        if (!o) return '';
        sel.value = o.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return o.value;
      });
      if (firstVal) {
        await page.waitForTimeout(700);
        const micSaved = await page.evaluate(async () => {
          const res = await fetch('/api/preferences');
          return (await res.json()).preferences?.interviewCopilot?.micDevice || '';
        });
        if (micSaved !== firstVal) {
          errors.push(`settings API: micDevice «${micSaved}» !== «${firstVal}»`);
        }
      }
    }

    await page.locator('[data-settings-tab="appearance"]').click();
    await page.waitForTimeout(80);
    const appearancePanel = await page.evaluate(
      () => !document.getElementById('settings-panel-appearance')?.hidden
    );
    if (!appearancePanel) errors.push('settings: вкладка «Интерфейс» не открылась');

    await waitSettingsSaveIdle(page).catch(() => errors.push('settings: сохранение не завершилось перед закрытием'));
    await page.keyboard.press('Escape');
    step = 'waitHiddenAfterEscape1';
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
    step = 'waitHiddenBackdrop';
    await waitSettingsModalHidden(page);

    await page.goto(`${BASE}/?settings=letters&focus=fp`, { waitUntil: 'domcontentloaded' });
    await waitSettingsModalOpen(page);
    const deepOk = await page.evaluate(() => {
      const panel = document.getElementById('settings-panel-letters');
      const fp = document.getElementById('batch-false-positive-max');
      return Boolean(panel && !panel.hidden && fp);
    });
    if (!deepOk) errors.push('settings deep link: letters + поле ложных пропусков');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await page.locator('#settings-zone-back').click();
    await page.waitForTimeout(80);
    const backHiddenOnPick = await page.evaluate(
      () => document.getElementById('settings-zone-back')?.hidden === true
    );
    if (!backHiddenOnPick) errors.push('settings mobile: «← Разделы» видна в режиме pick');
    await page.locator('[data-settings-tab="apply"]').click();
    await page.waitForTimeout(80);
    const backVisibleOnDrill = await page.evaluate(
      () => document.getElementById('settings-zone-back')?.hidden === false
    );
    if (!backVisibleOnDrill) errors.push('settings mobile: нет «← Разделы» в режиме drill');
    await page.locator('#settings-zone-back').click();
    await page.waitForTimeout(80);
    const backAfterPick = await page.evaluate(
      () => document.getElementById('settings-zone-back')?.hidden === true
    );
    if (!backAfterPick) errors.push('settings mobile: «← Разделы» не скрылась после возврата');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(150);
    const afterResize = await readSettingsLayoutMetrics(page);
    if (afterResize.contentRatio < 0.65) {
      errors.push(
        `settings layout after resize: content/dialog=${afterResize.contentRatio.toFixed(2)}, ожидалось ≥0.65`
      );
    }
    if (afterResize.drill || afterResize.solo) {
      errors.push('settings layout after resize: залип drill/solo после возврата на desktop');
    }

    await page.keyboard.press('Alt+1');
    await page.waitForTimeout(80);
    const systemPanel = await page.evaluate(
      () => !document.getElementById('settings-panel-system')?.hidden
    );
    if (!systemPanel) errors.push('settings: Alt+1 не переключил на Систему');

    await page.locator('[data-settings-tab="targeting"]').click();
    await page.waitForTimeout(80);
    await page.locator('#pref-min-monthly-rub').fill('155000');
    const dirtyTabIds = await page.evaluate(() =>
      [...document.querySelectorAll('.settings-nav__btn--dirty')].map(
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
    await page.evaluate(() => document.getElementById('btn-settings-revert-tab')?.click());
    await page.waitForTimeout(80);
    const reverted = await page.evaluate(() => {
      const btn = document.querySelector('[data-settings-tab="targeting"]');
      return !btn?.classList.contains('settings-nav__btn--dirty');
    });
    if (!reverted) errors.push('settings: отмена на вкладке не сняла dirty');

    await page.locator('#pref-min-monthly-rub').fill('155000');
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
    step = 'waitHiddenClose';
    await waitSettingsModalHidden(page);

    await page.goto(`${BASE}/?settings=targeting&settingsLayout=wide`, {
      waitUntil: 'domcontentloaded',
    });
    await waitSettingsModalOpen(page);
    const wideW = await page.evaluate(() => {
      const dlg = document.querySelector('#settings-modal .settings-dialog--v5, #settings-modal .settings-dialog--v4');
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
  } catch (e) {
    errors.push(`settings step «${step}»: ${e.message || e}`);
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
