/**
 * Интеграционный smoke: GET API + кнопки/тогглы/поля дашборда с бэкендом.
 *   node scripts/test-dashboard-integration.mjs
 */
import { chromium } from 'playwright';
import { gotoDashboardReady } from './lib/dashboard-test-helpers.mjs';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

const GET_APIS = [
  '/api/harvest-tick',
  '/api/job-status',
  '/api/conversion-stats',
  '/api/dashboard-stats',
  '/api/funnel-analytics',
  '/api/vacancies',
  '/api/cover-letters',
  '/api/hh-apply-chat-log',
  '/api/harvest-log',
  '/api/preferences',
  '/api/profiles',
  '/api/preferences/save',
  '/api/questionnaire/reprobe-candidates',
  '/api/chat-inbox',
  '/api/queue-meta',
  '/api/settings/targeting-preview',
  '/api/chat-follow-up-schedule',
  '/api/chat-follow-ups',
  '/api/daily-routine',
  '/api/resume-sync-report',
  '/api/routing-health',
  '/api/batch-report',
  '/api/resume-raise-schedule',
  '/api/daily-digest',
  '/api/cover-letter/quality-hub',
  '/api/cover-letter/metrics-summary',
  '/api/quality/baseline',
  '/api/targeting/golden-regression',
  '/api/cover-letter/stats?batchScope=noQuestionnaire&queueStatus=pending&minScore=0',
  '/api/batch-precheck?batchScope=noQuestionnaire&queueStatus=pending&minScore=0&maxScore=0',
];

const REQUIRED_IDS = [
  'btn-daily-routine',
  'btn-run-harvest',
  'btn-batch-auto',
  'btn-batch-manual',
  'btn-open-settings',
  'btn-open-service',
  'btn-open-shortcuts',
  'filter-search',
  'filter-reset',
  'score-threshold-input',
  'batch-limit',
  'settings-modal',
  'service-drawer',
  'funnel-modal',
  'job-progress',
  'job-control-actions',
  'btn-job-pause',
  'btn-job-stop',
  'btn-job-resume',
  'letter-stats-body',
  'letter-center-panel',
  'btn-letter-center-prepare',
  'batch-precheck-modal',
  'chat-inbox-modal',
  'btn-open-chat-inbox',
];

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

async function waitModalHidden(page, id) {
  await page.waitForFunction(
    (modalId) => document.getElementById(modalId)?.hasAttribute('hidden'),
    id,
    { timeout: 5000 }
  );
}

async function checkGetApis(errors) {
  for (const path of GET_APIS) {
    try {
      const res = await fetch(`${BASE}${path}`);
      if (!res.ok) {
        errors.push(`GET ${path}: HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) {
        errors.push(`GET ${path}: не JSON (${ct})`);
        continue;
      }
      const data = await res.json();
      if (data?.error && path !== '/api/batch-report') {
        errors.push(`GET ${path}: ${data.error}`);
      }
    } catch (e) {
      errors.push(`GET ${path}: ${e.message}`);
    }
  }
}

async function main() {
  const errors = [];

  await checkGetApis(errors);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/local-dashboard-defaults\.mjs|favicon\.ico/i.test(t)) return;
    errors.push(`console: ${t}`);
  });

  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
  });

  await gotoDashboardReady(page, BASE);

  const dockSectionsOk = await page.evaluate(() => {
    const routine = document.getElementById('btn-daily-routine');
    const navTab = document.querySelector('[data-apply-view="queue"]');
    return (
      document.querySelector('.dock-section--actions')?.contains(routine) &&
      document.querySelector('.dock-section--nav')?.contains(navTab)
    );
  });
  if (!dockSectionsOk) errors.push('dock-section: кнопки вынесены из секций (пустые оболочки)');

  const navLabelsOk = await page.evaluate(() => {
    const texts = [...document.querySelectorAll('.apply-view-tabs [data-apply-view]')].map(
      (b) => b.textContent || ''
    );
    return (
      texts.some((t) => t.startsWith('Очередь')) &&
      texts.some((t) => t.includes('Без анкет')) &&
      !texts.some((t) => /Без анк\./.test(t) || /Отлож\./.test(t))
    );
  });
  if (!navLabelsOk) errors.push('apply-view: сокращённые подписи вкладок');

  const countsOk = await page.evaluate(async () => {
    const r = await fetch('/api/vacancies?status=pending&applyView=queue&scoreBand=all');
    const j = await r.json();
    const c = j.counts || {};
    return (
      typeof c.queue === 'number' &&
      typeof c.noQuestionnaire === 'number' &&
      c.queue >= c.noQuestionnaire &&
      c.queue >= c.questionnaire
    );
  });
  if (!countsOk) errors.push('API counts: queue < noQuestionnaire или неверная логика');

  for (const id of REQUIRED_IDS) {
    if (!(await page.$(`#${id}`))) errors.push(`нет элемента #${id}`);
  }

  const serviceActions = await page.$$eval('[data-service-action]', (els) =>
    els.map((el) => el.dataset.serviceAction).filter(Boolean)
  );
  const knownActions = new Set([
    'sync-hh-responses',
    'sync-hh-chats',
    'apply-negotiations-cache',
    'import-negotiations-queue',
    'prune-responded',
    'sync-resume-from-source',
    'sync-resume-variants',
    'raise-resumes-all',
    'raise-resumes-routing',
    'raise-resumes-role',
    'import-interview-notes',
    'daily-digest',
    'chat-reply-batch',
    'open-chat-inbox',
    'questionnaire-reprobe',
    'questionnaire-prep',
  ]);
  for (const a of serviceActions) {
    if (!knownActions.has(a)) errors.push(`неизвестный data-service-action: ${a}`);
  }

  for (const step of ['find', 'review', 'apply', 'track']) {
    await page.locator(`[data-workflow="${step}"]`).click();
    await page.waitForTimeout(80);
    const active = await page.evaluate(
      (s) => document.querySelector(`[data-workflow="${s}"]`)?.classList.contains('workflow-nav__step--active'),
      step
    );
    if (!active) errors.push(`workflow: шаг «${step}» не активировался`);
  }

  await page.locator('[data-apply-view="queue"]').click();
  await page.waitForTimeout(100);

  for (const st of ['pending', 'approved', 'rejected']) {
    await page.locator(`[data-status="${st}"]`).click();
    await page.waitForTimeout(60);
    const active = await page.evaluate(
      (s) => document.querySelector(`[data-status="${s}"]`)?.classList.contains('active'),
      st
    );
    if (!active) errors.push(`status: вкладка «${st}» не активна`);
  }

  for (const band of ['high', 'low', 'all']) {
    await page.locator(`#panel-score-band .tab-band[data-band="${band}"]`).click({ timeout: 5000 }).catch(() => {
      if (band === 'low') return;
      errors.push(`score-band: не кликнулась «${band}»`);
    });
    await page.waitForTimeout(60);
  }

  for (const view of ['noQuestionnaire', 'questionnaire', 'applied', 'hidden', 'deferred']) {
    await page.locator(`[data-apply-view="${view}"]`).click();
    await page.waitForTimeout(60);
    const active = await page.evaluate(
      (v) => document.querySelector(`[data-apply-view="${v}"]`)?.classList.contains('active'),
      view
    );
    if (!active) errors.push(`apply-view: вкладка «${view}» не активна`);
  }

  await page.locator('[data-apply-view="queue"]').click();
  await page.waitForTimeout(80);

  await page.locator('#filter-search').fill('test company');

  await page.locator('#btn-open-settings').click();
  await waitModalOpen(page, 'settings-modal');
  await page.locator('[data-settings-tab="appearance"]').click();
  await page.waitForTimeout(80);
  await page.locator('#filter-reset').click();
  const filtersCleared = await page.evaluate(() => {
    const s = document.getElementById('filter-search')?.value || '';
    return s === '';
  });
  if (!filtersCleared) errors.push('filter-reset: поля не очистились');
  await page.locator('[data-settings-tab="apply"]').click();
  await page.waitForTimeout(80);

  await page.locator('#settings-modal .modal-close').click();
  await waitModalHidden(page, 'settings-modal');

  await page.locator('#btn-open-service').click();
  await page.waitForSelector('#service-drawer:not([hidden])', { timeout: 3000 });
  await page.locator('#service-drawer .service-drawer__close').click();
  await page.waitForFunction(
    () => document.getElementById('service-drawer')?.hasAttribute('hidden'),
    null,
    { timeout: 3000 }
  );

  await page.locator('#btn-open-settings').click();
  await waitModalOpen(page, 'settings-modal');

  for (const tab of ['apply', 'letters', 'appearance']) {
    await page.locator(`[data-settings-tab="${tab}"]`).click();
    await page.waitForTimeout(80);
    const panelVisible = await page.evaluate((t) => {
      const panel = document.getElementById(`settings-panel-${t}`);
      return panel && !panel.hidden;
    }, tab);
    if (!panelVisible) errors.push(`settings: панель «${tab}» не видна`);
  }

  await page.locator('[data-settings-tab="apply"]').click();
  await page.waitForTimeout(80);

  const origScore = await page.inputValue('#score-threshold-input');
  const newScore = origScore === '55' ? '56' : '55';
  await page.locator('#score-threshold-input').fill(newScore);
  await page.locator('#score-threshold-input').dispatchEvent('input', { bubbles: true });
  await page.locator('#score-threshold-input').dispatchEvent('change', { bubbles: true });
  await page.waitForFunction(
    () => document.getElementById('settings-save-hint')?.textContent?.includes('Сохранено'),
    null,
    { timeout: 8000 }
  ).catch(() => errors.push('preferences save: нет подтверждения «Сохранено»'));
  await page.locator('#score-threshold-input').fill(origScore);
  await page.locator('#score-threshold-input').dispatchEvent('input', { bubbles: true });
  await page.waitForTimeout(700);

  await page.locator('[data-settings-tab="appearance"]').click();
  await page.waitForTimeout(80);

  for (const preset of ['simple', 'standard', 'expert']) {
    await page.locator(`[data-layout-preset="${preset}"]`).click();
    await page.waitForTimeout(120);
  }

  await page.locator('#btn-reset-panel-order').click();
  await page.waitForTimeout(150);

  const cbCount = await page.locator('#sidebar-panel-builder input[type="checkbox"]').count();
  if (cbCount < 3) errors.push('sidebar builder: мало чекбоксов панелей');

  const builderLayoutOk = await page.evaluate(() => {
    const left = document.querySelector('[data-builder-list="left"]');
    const right = document.querySelector('[data-builder-list="right"]');
    const sample = left?.querySelector('.sidebar-builder__text')?.textContent?.trim() || '';
    return Boolean(left && right && left.children.length >= 3 && !/слева|справа/i.test(sample));
  });
  if (!builderLayoutOk) errors.push('sidebar builder: нет двух колонок или слипшиеся подписи');

  const firstCb = page.locator('#sidebar-panel-builder input[type="checkbox"]').first();
  if ((await firstCb.count()) > 0) {
    const wasChecked = await firstCb.isChecked();
    await firstCb.click();
    await page.waitForTimeout(100);
    if ((await firstCb.isChecked()) === wasChecked) {
      errors.push('sidebar builder: чекбокс не переключился');
    }
    await firstCb.click();
  }

  await page.locator('#settings-modal .modal-close').click();
  await waitModalHidden(page, 'settings-modal');

  await page.locator('#splitter-left').click({ position: { x: 6, y: 200 } });
  await page.waitForTimeout(150);
  await page.locator('#splitter-left').hover();
  await page.waitForTimeout(150);

  await page.locator('#btn-open-shortcuts').click();
  await waitModalOpen(page, 'shortcuts-modal');
  await page.keyboard.press('Escape');
  await waitModalHidden(page, 'shortcuts-modal');

  const onboardingVisible = await page.evaluate(() => {
    const panel = document.getElementById('onboarding-panel');
    return Boolean(panel && !panel.hidden);
  });
  if (onboardingVisible) {
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('[data-onboarding-action="harvest"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (clicked) {
      try {
        await page.waitForFunction(
          () => document.getElementById('btn-run-harvest')?.classList.contains('onboarding-target'),
          null,
          { timeout: 3000 }
        );
      } catch {
        errors.push('onboarding: CTA «Поиск» не подсвечивает кнопку');
      }
    }
  }

  await page.locator('.crm-kpi').click();
  await waitModalOpen(page, 'funnel-modal');
  try {
    await page.waitForFunction(
      () => {
        const body = document.getElementById('funnel-modal-body');
        return Boolean(
          body &&
            body.querySelector('.funnel-modal-grid') &&
            body.querySelector('.funnel-gauge-grid, .funnel-panel')
        );
      },
      null,
      { timeout: 8000 }
    );
  } catch {
    errors.push('funnel-modal: нет сетки графиков после открытия');
  }
  await page.locator('#funnel-modal .modal-close--funnel').click();
  await waitModalHidden(page, 'funnel-modal');

  const jobUiOk = await page.evaluate(() => {
    const jp = document.getElementById('job-progress');
    const actions = document.getElementById('job-control-actions');
    const btns = actions ? actions.querySelectorAll('.btn').length : 0;
    return Boolean(jp && actions && btns === 3);
  });
  if (!jobUiOk) errors.push('job-progress: блок управления задачей повреждён');

  const digestOk = await page.evaluate(async () => {
    const r = await fetch('/api/daily-digest', { method: 'POST', body: JSON.stringify({ sendTelegram: false }) });
    const j = await r.json();
    return r.ok && Boolean(j.digest);
  });
  if (!digestOk) errors.push('POST /api/daily-digest: нет digest');

  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForFunction(
    () => document.getElementById('app-shell')?.classList.contains('workspace-shell--mobile'),
    null,
    { timeout: 5000 }
  );
  await page.waitForFunction(
    () => Boolean(document.getElementById('app-shell')?.style.getPropertyValue('--mobile-bar-h')),
    null,
    { timeout: 3000 }
  );
  const mobileBarVisible = await page.evaluate(() => {
    const bar = document.getElementById('mobile-bar');
    return bar && !bar.hidden && getComputedStyle(bar).display !== 'none';
  });
  if (!mobileBarVisible) errors.push('mobile: нижняя панель не видна при 900px');

  await page.locator('#mobile-bar [data-mobile-sheet="left"]').click();
  await page.waitForFunction(
    () => {
      const dock = document.getElementById('dock-left');
      if (!dock?.classList.contains('mobile-sheet--open')) return false;
      const tr = getComputedStyle(dock).transform;
      return tr === 'none' || !tr.includes('105%');
    },
    null,
    { timeout: 5000 }
  );
  const sheetAboveBar = await page.evaluate(() => {
    const dock = document.getElementById('dock-left');
    const bar = document.getElementById('mobile-bar');
    const shell = document.getElementById('app-shell');
    if (!dock || !bar || !shell) return false;
    const dockRect = dock.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const cssBottom = parseFloat(getComputedStyle(dock).bottom) || 0;
    const barH = barRect.height;
    const aligned = Math.abs(dockRect.bottom - barRect.top) <= 6;
    const cssOk = Math.abs(cssBottom - barH) <= 8 || Boolean(shell.style.getPropertyValue('--mobile-bar-h'));
    return aligned || cssOk;
  });
  if (!sheetAboveBar) errors.push('mobile: левый sheet перекрывается нижним bar');

  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !document.getElementById('dock-left')?.classList.contains('mobile-sheet--open'),
    null,
    { timeout: 5000 }
  );

  await page.setViewportSize({ width: 1920, height: 1080 });

  const onboardingDismiss = page.locator('#onboarding-panel .onboarding-dismiss');
  if ((await onboardingDismiss.count()) > 0 && (await onboardingDismiss.isVisible())) {
    await onboardingDismiss.click();
    await page.waitForTimeout(200);
  }

  await page.goto(`${BASE}/?settings=letters&focus=fp`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#settings-modal:not([hidden])', { timeout: 12_000 });
  const deepLinkOk = await page.evaluate(() => {
    const panel = document.getElementById('settings-panel-letters');
    const fp = document.getElementById('batch-false-positive-max');
    const url = new URL(location.href);
    return Boolean(panel && !panel.hidden && fp && !url.searchParams.has('settings'));
  });
  if (!deepLinkOk) errors.push('settings deep link: letters+fp или очистка URL');
  await page.locator('#settings-modal .modal-close--settings').click();
  await waitModalHidden(page, 'settings-modal');

  await browser.close();

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    `OK: ${GET_APIS.length} GET API, workflow, вкладки, фильтры, service drawer, settings save, deep link, layout, mobile`
  );
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
