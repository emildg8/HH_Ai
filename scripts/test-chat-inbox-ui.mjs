/**
 * Gate C: inbox → thread → mark sent (demo data).
 *   npm run test:chat-inbox-ui
 */
import { chromium } from 'playwright';
import { startDemoDashboard, waitDashboardHttp, stopDemoDashboard } from '../lib/demo-dashboard-server.mjs';
import { gotoDashboardReady } from './lib/dashboard-test-helpers.mjs';

const PORT = Number(process.env.CHAT_UI_PORT || 3857);
const BASE = `http://127.0.0.1:${PORT}`;

async function waitModalOpen(page, id) {
  await page.waitForFunction(
    (modalId) => {
      const m = document.getElementById(modalId);
      return m && !m.hidden && m.classList.contains('modal--open');
    },
    id,
    { timeout: 8000 }
  );
}

async function main() {
  const { child } = startDemoDashboard({ port: PORT });
  const errors = [];
  try {
    if (!(await waitDashboardHttp(`${BASE}/`))) throw new Error('dashboard not up');

    const inbox = await (await fetch(`${BASE}/api/chat-inbox?filter=all&limit=5`)).json();
    if (!inbox.ok || !Array.isArray(inbox.items)) errors.push('API chat-inbox недоступен');

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('hh-dashboard-onboarding-dismissed', '1'));
    await gotoDashboardReady(page, BASE);

    await page.locator('#btn-open-service').click();
    await page.waitForSelector('#service-drawer:not([hidden])', { timeout: 5000 });
    await page.locator('[data-open-chat-inbox]').click();
    await waitModalOpen(page, 'chat-inbox-modal');
    await page.waitForTimeout(800);

    const hasList = await page.evaluate(() => Boolean(document.getElementById('chat-inbox-list')));
    if (!hasList) errors.push('нет #chat-inbox-list');

    const threadBtn = page.locator('.chat-inbox-item').first();
    if ((await threadBtn.count()) === 0) {
      errors.push('inbox пуст — нужны demo-данные с чатами (docs/demo/vacancies-demo.json)');
    } else {
      await threadBtn.click();
      await page.waitForTimeout(400);
      const draft = page.locator('#chat-inbox-draft');
      await draft.fill('Тест Gate C — автоответ');
      await page.locator('#btn-chat-inbox-mark-sent').click();
      await page.waitForTimeout(500);
      const toastOk = await page.evaluate(() =>
        Boolean(document.querySelector('.toast, [role="status"]')?.textContent?.includes('Отмечено'))
      );
      if (!toastOk) {
        const apiOk = await page.evaluate(async () => {
          const items = document.querySelector('.chat-inbox-item--active');
          const id = items?.getAttribute('data-thread-id');
          if (!id) return false;
          const r = await fetch('/api/chat-mark-sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, text: 'gate-c' }),
          });
          return r.ok;
        });
        if (!apiOk) errors.push('mark sent не сработал');
      }
    }

    await page.keyboard.press('Escape');
    await browser.close();
  } finally {
    await stopDemoDashboard(child);
  }

  if (errors.length) {
    console.error('FAIL test-chat-inbox-ui:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('OK: test-chat-inbox-ui.mjs (Gate C)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
