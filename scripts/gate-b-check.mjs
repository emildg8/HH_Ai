#!/usr/bin/env node
/**
 * Gate B: путь «пустая очередь → demo → карточки» ≤5 мин (автопроверка).
 *   npm run gate-b
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { ROOT, DATA_DIR } from '../lib/paths.mjs';
import { startDemoDashboard, waitDashboardHttp, stopDemoDashboard } from '../lib/demo-dashboard-server.mjs';

const PORT = Number(process.env.GATE_B_PORT || 3854);
const BASE = `http://127.0.0.1:${PORT}`;
const REPORT = path.join(DATA_DIR, 'gate-b-last.json');
const EMPTY_QUEUE = path.join(DATA_DIR, 'gate-b-empty-queue.json');
const MAX_MS = 5 * 60 * 1000;

async function main() {
  const t0 = Date.now();
  /** @type {Array<{ step: string, ok: boolean, ms: number, detail?: string }>} */
  const steps = [];

  function step(name, ok, detail = '') {
    steps.push({ step: name, ok, ms: Date.now() - t0, detail });
    console.log(`${ok ? 'OK' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    return ok;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(EMPTY_QUEUE, '[]\n', 'utf8');

  const { child } = startDemoDashboard({ port: PORT, queueFile: './data/gate-b-empty-queue.json' });
  try {
    if (!step('dashboard-up', await waitDashboardHttp(`${BASE}/`, 45_000), BASE)) {
      throw new Error('dashboard not up');
    }

    const meta1 = await (await fetch(`${BASE}/api/queue-meta`)).json();
    step('queue-empty', meta1.empty === true && meta1.demoAvailable === true, JSON.stringify(meta1));

    const load = await fetch(`${BASE}/api/load-demo-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const loadJson = await load.json();
    step('load-demo', load.ok && loadJson.ok && loadJson.count > 0, `count=${loadJson.count}`);

    const vac = await (await fetch(`${BASE}/api/vacancies?status=pending&applyView=queue`)).json();
    const n = Array.isArray(vac.items) ? vac.items.length : 0;
    step('vacancies-visible', n > 0, `${n} cards`);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForFunction(
      () => document.querySelector('#list .card-tile, #list .card') != null,
      null,
      { timeout: 20_000 }
    );
    const uiCards = await page.evaluate(
      () => document.querySelectorAll('#list .card-tile, #list .card').length
    );
    step('ui-cards', uiCards > 0, `${uiCards} in DOM`);
    await browser.close();

    const elapsed = Date.now() - t0;
    step('time-under-5min', elapsed <= MAX_MS, `${Math.round(elapsed / 1000)}s`);

    const ok = steps.every((s) => s.ok);
    const report = {
      gate: 'B',
      ok,
      elapsedMs: elapsed,
      checkedAt: new Date().toISOString(),
      steps,
    };
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n[gate-b] ${ok ? 'PASSED' : 'FAILED'} (${Math.round(elapsed / 1000)}s) → ${REPORT}`);
    if (!ok) process.exit(1);
  } finally {
    await stopDemoDashboard(child);
  }
}

main().catch((e) => {
  console.error('[gate-b] FAIL:', e.message || e);
  process.exit(1);
});
