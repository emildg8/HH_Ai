/**
 * Счётчики вкладок раздела (статус, авто/ручные отклонённые).
 *   node scripts/test-section-counters.mjs
 */
import { chromium } from 'playwright';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';

loadEnv();
applyStoredProfile();

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#list .card, #list .card-tile', { timeout: 20000 });
await page.locator('[data-status="rejected"]').click();
await page.waitForTimeout(900);

const result = await page.evaluate(async () => {
  const rRejected = await fetch('/api/vacancies?status=rejected&scoreBand=high&applyView=queue&rejectSource=all');
  const jRejected = await rRejected.json();
  const cRejected = jRejected.counts || {};
  const rQueue = await fetch('/api/vacancies?status=pending&scoreBand=all&applyView=queue');
  const jQueue = await rQueue.json();
  const cQueue = jQueue.counts || {};
  const rApplied = await fetch('/api/vacancies?status=pending&scoreBand=all&applyView=applied');
  const jApplied = await rApplied.json();
  const cApplied = jApplied.counts || {};
  const rejectedTab = document.querySelector('.vacancy-tabs [data-status="rejected"]')?.textContent?.trim();
  const subTabs = [...document.querySelectorAll('#rejected-source-tabs [data-rejected-source]')].map(
    (b) => b.textContent?.trim()
  );
  const queueTab = document.querySelector('.apply-view-tabs [data-apply-view="queue"]')?.textContent?.trim();
  const appliedTab = document.querySelector('.apply-view-tabs [data-apply-view="applied"]')?.textContent?.trim();
  return {
    api: {
      shown: cRejected.shown,
      queue: cRejected.queue,
      rejectedAll: cRejected.rejectedAll,
      rejectedAuto: cRejected.rejectedAuto,
      rejectedManual: cRejected.rejectedManual,
      statusRejected: cRejected.statusTabCounts?.rejected,
      appliedFromQueue: cQueue.applied,
      appliedShown: cApplied.shown,
    },
    rejectedTab,
    subTabs,
    queueTab,
    appliedTab,
    listCards: document.querySelectorAll('#list .card, #list .card-tile').length,
  };
});

const errors = [];
if (!result.rejectedTab?.includes('(')) errors.push('вкладка «Отклонённые» без счётчика');
if (!result.subTabs.every((t) => /\(\d+\)/.test(t))) errors.push('подвкладки без счётчика: ' + result.subTabs.join(', '));
if (result.api.shown !== result.listCards) {
  errors.push(`список ${result.listCards} ≠ shown ${result.api.shown}`);
}
if (result.api.rejectedAll !== result.api.shown) {
  errors.push(`rejectedAll ${result.api.rejectedAll} ≠ shown ${result.api.shown}`);
}
if (result.api.statusRejected !== result.api.rejectedAll) {
  errors.push(`statusTabCounts.rejected ${result.api.statusRejected} ≠ rejectedAll ${result.api.rejectedAll}`);
}
const autoManual = (result.api.rejectedAuto || 0) + (result.api.rejectedManual || 0);
if (autoManual !== result.api.rejectedAll) {
  errors.push(`auto+manual ${autoManual} ≠ all ${result.api.rejectedAll}`);
}
if (!result.appliedTab?.includes('(')) errors.push('вкладка «Отклики» без счётчика');
if ((result.api.appliedFromQueue || 0) <= 0) {
  errors.push(`counts.applied из очереди = ${result.api.appliedFromQueue}`);
}
if (result.api.appliedFromQueue !== result.api.appliedShown) {
  errors.push(
    `applied из queue-view ${result.api.appliedFromQueue} ≠ shown на вкладке откликов ${result.api.appliedShown}`
  );
}

if (errors.length) {
  console.error('FAIL:', errors.join('; '));
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log('test-section-counters: ok', result.rejectedTab, result.appliedTab, result.subTabs.join(' | '));
await browser.close();
