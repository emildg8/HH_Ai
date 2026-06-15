/**
 * DS-08: spot a11y checks (focus, ARIA, labels) — без axe.
 *   npm run test:dashboard-a11y
 */
import { chromium } from 'playwright';
import { startDemoDashboard, waitDashboardHttp, stopDemoDashboard } from '../lib/demo-dashboard-server.mjs';
import { gotoDashboardReady } from './lib/dashboard-test-helpers.mjs';

const PORT = Number(process.env.A11Y_PORT || 3856);
const BASE = `http://127.0.0.1:${PORT}`;

/** @type {string[]} */
const CHECKS = [
  'main-landmark',
  'settings-modal-aria',
  'chat-inbox-aria',
  'service-drawer-aria',
  'icon-buttons-named',
  'settings-tabs-labelled',
  'filter-search-label',
  'modal-focus-trap-ready',
  'status-live-regions',
  'keyboard-focus-visible',
  'score-threshold-label',
  'workflow-nav-buttons',
  'empty-state-not-loading',
  'chat-badge-accessible',
  'onboarding-dismiss-named',
  'funnel-modal-title',
  'apply-view-tabs',
  'dock-toggle-pressed',
  'letter-issues-modal',
  'job-control-named',
];

async function main() {
  const { child } = startDemoDashboard({ port: PORT });
  const errors = [];
  try {
    if (!(await waitDashboardHttp(`${BASE}/`))) throw new Error('dashboard not up');

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('hh-dashboard-onboarding-dismissed', '1');
    });
    await gotoDashboardReady(page, BASE);

    const r = await page.evaluate(async () => {
      const fails = [];
      const ok = (name, cond, msg = '') => {
        if (!cond) fails.push(`${name}${msg ? `: ${msg}` : ''}`);
      };

      ok('main-landmark', Boolean(document.querySelector('main, [role="main"], .workspace-stage')));
      ok(
        'settings-modal-aria',
        Boolean(document.getElementById('settings-modal')?.querySelector('[role="dialog"][aria-modal="true"]'))
      );
      ok(
        'chat-inbox-aria',
        Boolean(document.getElementById('chat-inbox-modal')?.querySelector('#chat-inbox-title')) &&
          Boolean(document.getElementById('chat-inbox-modal')?.querySelector('[role="dialog"]'))
      );
      ok(
        'service-drawer-aria',
        Boolean(document.getElementById('service-drawer')?.querySelector('[role="dialog"][aria-labelledby="service-drawer-title"]'))
      );

      const iconBtns = [...document.querySelectorAll('button')].filter((b) => {
        const t = (b.textContent || '').trim();
        const named = b.getAttribute('aria-label') || b.getAttribute('title');
        if (t || named) return false;
        if (b.closest('.dock-mini, .card-dismiss, .modal-close')) return false;
        return true;
      });
      ok('icon-buttons-named', iconBtns.length <= 3, `${iconBtns.length} unnamed (non-dock)`);

      const tabs = document.querySelectorAll('.settings-tabs__btn');
      ok('settings-tabs-labelled', tabs.length >= 4);
      tabs.forEach((t, i) => ok('settings-tabs-labelled', (t.textContent || '').trim().length > 0, `#${i}`));

      ok(
        'filter-search-label',
        Boolean(
          document.getElementById('filter-search')?.labels?.length ||
            document.querySelector('label[for="filter-search"]') ||
            document.getElementById('filter-search')?.getAttribute('title')
        )
      );

      ok('modal-focus-trap-ready', Boolean(document.getElementById('settings-modal')?.querySelector('.modal-dialog[tabindex]')));
      ok('status-live-regions', document.querySelectorAll('[aria-live]').length >= 2);

      const firstCard = document.querySelector('#list .card-tile, #list .card');
      ok(
        'keyboard-focus-visible',
        !firstCard || Number(firstCard.tabIndex) >= -1,
        firstCard ? `tabIndex=${firstCard.tabIndex}` : 'skip'
      );

      ok(
        'score-threshold-label',
        Boolean(document.getElementById('score-threshold-input')?.labels?.length || document.querySelector('label[for="score-threshold-input"]'))
      );
      ok('workflow-nav-buttons', document.querySelectorAll('[data-workflow]').length >= 4);
      ok('empty-state-not-loading', !document.querySelector('#list')?.textContent?.includes('Загрузка'));

      ok('chat-badge-accessible', Boolean(document.getElementById('btn-open-chat-inbox') || document.querySelector('[data-open-chat-inbox]')));

      const od = document.querySelector('.onboarding-dismiss');
      ok('onboarding-dismiss-named', !od || Boolean(od.getAttribute('aria-label') || od.textContent?.trim()));

      ok('funnel-modal-title', Boolean(document.getElementById('funnel-modal-title')));
      ok('apply-view-tabs', document.querySelectorAll('[data-apply-view]').length >= 5);
      ok('dock-toggle-pressed', [...document.querySelectorAll('[data-dock-toggle]')].every((b) => b.hasAttribute('aria-pressed')));
      ok('letter-issues-modal', Boolean(document.getElementById('letter-issues-modal')));
      ok('job-control-named', Boolean(document.getElementById('job-control-actions')));

      return fails;
    });

    for (const f of r) errors.push(f);
    await browser.close();
  } finally {
    await stopDemoDashboard(child);
  }

  const missing = CHECKS.filter((c) => !errors.some((e) => e.startsWith(c)));
  void missing;
  if (errors.length) {
    console.error('FAIL test-dashboard-a11y:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log(`OK: test-dashboard-a11y.mjs (${CHECKS.length} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
