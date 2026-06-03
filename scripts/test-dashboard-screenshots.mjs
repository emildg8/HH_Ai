/**
 * DS-07: screenshot regression (Playwright vs baseline).
 *   npm run test:dashboard-screenshots
 *   npm run test:dashboard-screenshots:update
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { ROOT } from '../lib/paths.mjs';
import { startDemoDashboard, waitDashboardHttp, stopDemoDashboard } from '../lib/demo-dashboard-server.mjs';
import { gotoDashboardReady } from './lib/dashboard-test-helpers.mjs';

const PORT = Number(process.env.SCREENSHOT_PORT || 3855);
const BASE = `http://127.0.0.1:${PORT}`;
const BASELINE = path.join(ROOT, 'docs', 'screenshots', 'baseline');
const UPDATE = process.argv.includes('--update');
const MAX_DIFF = Number(process.env.SCREENSHOT_MAX_DIFF || 0.04);

/** @type {Array<{ name: string, capture: (page: import('playwright').Page) => Promise<void> }>} */
const SHOTS = [
  {
    name: '01-queue',
    capture: async (page) => {
      await gotoDashboardReady(page, BASE);
    },
  },
  {
    name: '02-settings',
    capture: async (page) => {
      await gotoDashboardReady(page, BASE);
      await page.locator('#btn-open-settings').click();
      await page.waitForFunction(
        () => {
          const m = document.getElementById('settings-modal');
          return m && !m.hidden && m.classList.contains('modal--open');
        },
        null,
        { timeout: 10_000 }
      );
      await page.waitForTimeout(300);
    },
  },
  {
    name: '03-service-drawer',
    capture: async (page) => {
      await gotoDashboardReady(page, BASE);
      await page.locator('#btn-open-service').click();
      await page.waitForFunction(
        () => {
          const d = document.getElementById('service-drawer');
          return d && !d.hidden && d.classList.contains('service-drawer--open');
        },
        null,
        { timeout: 8000 }
      );
      await page.waitForTimeout(300);
    },
  },
  {
    name: '04-chat-inbox',
    capture: async (page) => {
      await gotoDashboardReady(page, BASE);
      await page.evaluate(() => document.querySelector('[data-open-chat-inbox]')?.click());
      await page.waitForFunction(
        () => {
          const m = document.getElementById('chat-inbox-modal');
          return m && !m.hidden && m.classList.contains('modal--open');
        },
        null,
        { timeout: 10_000 }
      );
      await page.waitForFunction(
        () =>
          document.querySelector('.chat-inbox-item') ||
          document.querySelector('#chat-inbox-list .chat-inbox-empty'),
        null,
        { timeout: 10_000 }
      );
      await page.waitForTimeout(500);
    },
  },
  {
    name: '05-funnel',
    capture: async (page) => {
      await gotoDashboardReady(page, BASE);
      await page.evaluate(() => {
        document.getElementById('funnel-mini')?.click();
        document.querySelector('[data-open-funnel]')?.click();
        document.querySelector('.crm-kpi')?.click();
      });
      await page.waitForFunction(
        () => {
          const m = document.getElementById('funnel-modal');
          return m && !m.hidden && m.classList.contains('modal--open');
        },
        null,
        { timeout: 8000 }
      ).catch(() => {});
      await page.waitForTimeout(600);
    },
  },
  {
    name: '06-applied-view',
    capture: async (page) => {
      await gotoDashboardReady(page, BASE);
      await page.locator('[data-apply-view="applied"]').click();
      await page.waitForTimeout(600);
    },
  },
];

async function comparePng(page, actual, expected) {
  const a = fs.readFileSync(actual).toString('base64');
  const b = fs.readFileSync(expected).toString('base64');
  const result = await page.evaluate(
    async ([ba, bb, maxDiff]) => {
      function load(b64) {
        return new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = `data:image/png;base64,${b64}`;
        });
      }
      const [ia, ib] = await Promise.all([load(ba), load(bb)]);
      if (ia.width !== ib.width || ia.height !== ib.height) {
        return { ok: false, ratio: 1, reason: `size ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
      }
      const c1 = document.createElement('canvas');
      c1.width = ia.width;
      c1.height = ia.height;
      c1.getContext('2d').drawImage(ia, 0, 0);
      const c2 = document.createElement('canvas');
      c2.width = ib.width;
      c2.height = ib.height;
      c2.getContext('2d').drawImage(ib, 0, 0);
      const d1 = c1.getContext('2d').getImageData(0, 0, ia.width, ia.height).data;
      const d2 = c2.getContext('2d').getImageData(0, 0, ib.width, ib.height).data;
      let diff = 0;
      const px = d1.length / 4;
      for (let i = 0; i < d1.length; i += 4) {
        if (
          Math.abs(d1[i] - d2[i]) > 2 ||
          Math.abs(d1[i + 1] - d2[i + 1]) > 2 ||
          Math.abs(d1[i + 2] - d2[i + 2]) > 2
        ) {
          diff += 1;
        }
      }
      const ratio = diff / px;
      return {
        ok: ratio <= maxDiff,
        ratio,
        reason: `${(ratio * 100).toFixed(2)}% pixels differ`,
      };
    },
    [a, b, MAX_DIFF]
  );
  return result;
}

async function main() {
  fs.mkdirSync(BASELINE, { recursive: true });
  const { child } = startDemoDashboard({ port: PORT });
  const errors = [];
  try {
    if (!(await waitDashboardHttp(`${BASE}/`))) throw new Error('dashboard not up');

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('hh-dashboard-onboarding-dismissed', '1');
      localStorage.setItem('hh-dashboard-theme', 'dark');
    });

    for (const shot of SHOTS) {
      const out = path.join(BASELINE, `${shot.name}.png`);
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#list', { timeout: 15_000 });
      await page.waitForTimeout(400);
      await shot.capture(page);
      const buf = await page.screenshot({ fullPage: false });
      if (UPDATE || !fs.existsSync(out)) {
        fs.writeFileSync(out, buf);
        console.log(`${UPDATE ? 'UPDATE' : 'CREATE'} ${shot.name}`);
        continue;
      }
      const tmp = path.join(BASELINE, `.tmp-${shot.name}.png`);
      fs.writeFileSync(tmp, buf);
      const cmp = await comparePng(page, tmp, out);
      fs.unlinkSync(tmp);
      if (!cmp.ok) errors.push(`${shot.name}: ${cmp.reason}`);
      else console.log(`OK  ${shot.name} (${cmp.reason})`);
    }
    await browser.close();
  } finally {
    await stopDemoDashboard(child);
  }

  if (errors.length) {
    console.error('FAIL test-dashboard-screenshots:\n' + errors.map((e) => ` - ${e}`).join('\n'));
    console.error('Обновить baseline: npm run test:dashboard-screenshots:update');
    process.exit(1);
  }
  console.log('OK: test-dashboard-screenshots.mjs');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
