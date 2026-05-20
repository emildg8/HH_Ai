/**
 * Скриншоты дашборда с демо-данными (без личной информации).
 *   npm run docs:screenshots
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { ROOT } from '../lib/paths.mjs';

const PORT = Number(process.env.DEMO_DASHBOARD_PORT || 3851);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const DEMO_QUEUE = path.join(ROOT, 'docs', 'demo', 'vacancies-demo.json');

async function waitHttp(url, ms = 30_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function startDemoServer() {
  return spawn(
    process.execPath,
    [
      'scripts/dashboard-server.mjs',
      '--port=3851',
      '--queue-file=./docs/demo/vacancies-demo.json',
    ],
    { cwd: ROOT, stdio: 'ignore', env: process.env }
  );
}

async function capture() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(DEMO_QUEUE)) {
    throw new Error(`Нет ${DEMO_QUEUE}`);
  }

  const child = startDemoServer();
  try {
    if (!(await waitHttp(`${BASE}/`))) {
      throw new Error(`Дашборд не стартовал на ${BASE}`);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.addInitScript(() => {
      localStorage.setItem('hh-dashboard-theme', 'dark');
      localStorage.setItem('hh-dashboard-ui-scale', '0.95');
      localStorage.setItem('hh-dashboard-card-density', 'medium');
    });

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(OUT_DIR, 'dashboard-queue.png'), fullPage: false });

    const batchBtn = page.locator('button, [role="button"]').filter({ hasText: /батч|Батч|отклик/i }).first();
    if (await batchBtn.count()) {
      await batchBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'dashboard-batch.png'), fullPage: false });

    const qTab = page.locator('button, [role="tab"], a').filter({ hasText: /анкет/i }).first();
    if (await qTab.count()) {
      await qTab.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, 'dashboard-questionnaire.png'), fullPage: false });
    }

    const card = page.locator('.vacancy-card, [data-vacancy-id], article').first();
    if (await card.count()) {
      await card.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT_DIR, 'dashboard-card.png'), fullPage: false });
    }

    await browser.close();
    console.log(`[docs:screenshots] OK: ${OUT_DIR}`);
  } finally {
    child.kill('SIGTERM');
  }
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
