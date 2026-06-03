/**
 * Общие хелперы Playwright-тестов дашборда: readiness вместо sleep.
 */

/**
 * @param {import('playwright').Page} page
 * @param {string} [base]
 */
export async function gotoDashboardReady(page, base = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849') {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#list', { timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const list = document.getElementById('list');
      if (!list) return false;
      if (list.querySelector('.card, .card-tile')) return true;
      const empty = list.querySelector('.empty');
      const text = empty?.textContent || '';
      return empty && !/загрузка/i.test(text);
    },
    null,
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} key dataset key on documentElement
 * @param {string} value
 * @param {number} [timeout]
 */
export async function waitDataset(page, key, value, timeout = 8000) {
  await page.waitForFunction(
    ([k, v]) => document.documentElement.dataset[k] === v,
    [key, value],
    { timeout }
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {'left'|'right'} side
 */
export async function waitDockVisible(page, side, timeout = 5000) {
  await page.waitForFunction(
    (s) => {
      const dock = document.getElementById(`dock-${s}`);
      return dock && getComputedStyle(dock).display !== 'none';
    },
    side,
    { timeout }
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {'left'|'right'} side
 */
export async function waitDockHidden(page, side, timeout = 5000) {
  await page.waitForFunction(
    (s) => {
      const dock = document.getElementById(`dock-${s}`);
      return !dock || getComputedStyle(dock).display === 'none';
    },
    side,
    { timeout }
  );
}

/** @param {import('playwright').Page} page */
export function attachPageErrorCollector(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return {
    errors,
    drainUnique: () => [...new Set(errors)],
    assertNone: (label) => {
      const u = [...new Set(errors)];
      if (!u.length) return;
      throw new Error(`${label}: ${u.join('; ')}`);
    },
  };
}

/** @param {import('playwright').Page} page @param {string} [modalId] */
export async function waitSettingsModalOpen(page, modalId = 'settings-modal') {
  await page.waitForFunction(
    (id) => {
      const m = document.getElementById(id);
      return m && !m.hidden && m.classList.contains('modal--open');
    },
    modalId,
    { timeout: 8000 }
  );
}

/** @param {import('playwright').Page} page @param {string} [modalId] */
export async function waitSettingsModalHidden(page, modalId = 'settings-modal') {
  await page.waitForFunction(
    (id) => document.getElementById(id)?.hasAttribute('hidden'),
    modalId,
    { timeout: 5000 }
  );
}

/** @param {import('playwright').Page} page */
export async function openSettingsModal(page) {
  await page.locator('#btn-open-settings').click();
  await waitSettingsModalOpen(page);
}

/** @param {import('playwright').Page} page */
export async function getDashboardAppScriptPath(page) {
  return page.evaluate(() => {
    const el = document.querySelector('script[type="module"][src*="app.js"]');
    return el?.getAttribute('src') || '';
  });
}
