/**
 * Smoke-тест UI дашборда (Full HD viewport).
 * Запуск: node scripts/test-dashboard-ui.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

async function waitModalHidden(page, id) {
  await page.waitForFunction(
    (modalId) => document.getElementById(modalId)?.hasAttribute('hidden'),
    id,
    { timeout: 5000 }
  );
}

async function waitModalOpen(page, id) {
  await page.waitForFunction(
    (modalId) => {
      const m = document.getElementById(modalId);
      return m && !m.hidden && m.classList.contains('modal--open');
    },
    id,
    { timeout: 5000 }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];

  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });

  if (!(await page.$('#toast-host'))) throw new Error('Нет #toast-host');

  await page.evaluate(() => {
    const host = document.getElementById('toast-host');
    const t = document.createElement('div');
    t.className = 'toast toast--good toast--visible';
    t.textContent = 'test-toast';
    host.appendChild(t);
  });
  await page.waitForSelector('.toast--visible', { timeout: 3000 });

  await page.locator('.seg-btn[data-tip]').first().hover();
  await page.waitForSelector('.float-tip:not([hidden])', { timeout: 3000 });
  if (!(await page.locator('.float-tip').textContent())?.trim()) {
    throw new Error('Плавающая подсказка пуста');
  }

  await page.locator('[data-apply-view="applied"]').click();
  await page.locator('[data-apply-view="queue"]').click();

  const filterPanel = page.locator('#panel-filters');
  await filterPanel.evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
  await page.locator('#filter-reset').click();

  await page.locator('.btn-log-apply').click();
  await waitModalOpen(page, 'apply-log-modal');
  await page.locator('#apply-log-modal .btn-refresh-apply-log').click();
  await page.locator('#apply-log-modal input[value="harvest"]').check();
  await page.locator('#apply-log-modal input[value="apply"]').check();

  await page.locator('#apply-log-modal .modal-backdrop').click({ position: { x: 8, y: 8 } });
  await waitModalHidden(page, 'apply-log-modal');

  await page.locator('.btn-log-apply').click();
  await waitModalOpen(page, 'apply-log-modal');
  await page.keyboard.press('Escape');
  await waitModalHidden(page, 'apply-log-modal');

  const draftBtn = page.locator('.cover-draft-btn:not([hidden])').first();
  if ((await draftBtn.count()) > 0) {
    await draftBtn.click();
    await waitModalOpen(page, 'draft-modal');
    await page.keyboard.press('Escape');
    await waitModalHidden(page, 'draft-modal');
  } else {
    await page.evaluate(() => {
      const modal = document.getElementById('draft-modal');
      const body = modal?.querySelector('.modal-draft-body');
      const vac = modal?.querySelector('.modal-vacancy');
      if (vac) vac.textContent = 'UI test';
      if (body) body.innerHTML = '<p class="modal-empty">test</p>';
      modal.hidden = false;
      modal.classList.add('modal--open');
    });
    await waitModalOpen(page, 'draft-modal');
    await page.locator('#draft-modal .modal-close').click();
    await waitModalHidden(page, 'draft-modal');
  }

  const hasApprovedBtn = (await page.locator('.btn-view-approved:not([hidden])').count()) > 0;
  if (hasApprovedBtn) {
    await page.evaluate(() => {
      document.querySelector('.btn-view-approved:not([hidden])')?.click();
    });
    await waitModalOpen(page, 'approved-letter-modal');
    await page.locator('#approved-letter-modal .modal-backdrop').click({ position: { x: 5, y: 5 } });
    await waitModalHidden(page, 'approved-letter-modal');
  }

  const layout = await page.evaluate(() => {
    const list = document.getElementById('list');
    const cols = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length;
    return {
      appH: document.body.clientHeight,
      vh: window.innerHeight,
      gridCols: cols,
    };
  });
  if (layout.appH > layout.vh + 4) {
    errors.push(`body выше viewport: ${layout.appH} > ${layout.vh}`);
  }
  if (layout.gridCols < 1 || layout.gridCols > 8) {
    errors.push(`неожиданное число колонок: ${layout.gridCols}`);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: 'networkidle' });
  const narrowCols = await page.evaluate(() => {
    const list = document.getElementById('list');
    return getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length;
  });
  if (narrowCols < 1) {
    errors.push(`узкое окно: колонок ${narrowCols}`);
  }

  if (errors.length) throw new Error(errors.join('\n'));

  console.log('OK: tooltips, tabs, фильтры, журнал, модалки, layout 1920×1080');
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
