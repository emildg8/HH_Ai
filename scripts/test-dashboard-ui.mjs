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

async function openSettingsTab(page, tabId) {
  await page.locator('#btn-open-settings').click();
  await waitModalOpen(page, 'settings-modal');
  await page.locator(`[data-settings-tab="${tabId}"]`).click();
}

async function closeSettingsModal(page) {
  await page.locator('#settings-modal .modal-close').click();
  await waitModalHidden(page, 'settings-modal');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];

  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/local-dashboard-defaults\.mjs/i.test(t)) return;
    if (/favicon\.ico/i.test(t)) return;
    errors.push(`console: ${t}`);
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#list', { timeout: 15_000 });

  if (!(await page.$('#toast-host'))) throw new Error('Нет #toast-host');

  await page.evaluate(() => {
    const host = document.getElementById('toast-host');
    const t = document.createElement('div');
    t.className = 'toast toast--good toast--visible';
    t.textContent = 'test-toast';
    host.appendChild(t);
  });
  await page.waitForSelector('.toast--visible', { timeout: 3000 });

  await page.locator('[data-tip]').first().hover();
  await page.waitForSelector('.float-tip:not([hidden])', { timeout: 3000 });
  if (!(await page.locator('.float-tip').textContent())?.trim()) {
    throw new Error('Плавающая подсказка пуста');
  }

  await page.locator('[data-apply-view="applied"]').click();
  await page.locator('[data-apply-view="noQuestionnaire"]').click();
  await page.locator('[data-apply-view="questionnaire"]').click();
  await page.locator('[data-apply-view="queue"]').click();

  await openSettingsTab(page, 'list');
  await page.locator('#filter-reset').click();
  await closeSettingsModal(page);

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
    const variantTabsOk = await page.evaluate(() => {
      const tabs = document.querySelectorAll('#draft-modal .draft-variant-tab');
      return tabs.length >= 1;
    });
    if (!variantTabsOk) errors.push('draft-modal: нет вкладок A/B');
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

  await openSettingsTab(page, 'ui');

  for (const preset of ['0.85', '1', '1.15']) {
    await page.locator(`[data-ui-scale-preset="${preset}"]`).click();
    await page.waitForTimeout(150);
    const gap = await page.evaluate(() => {
      const shell = document.getElementById('app-shell');
      if (!shell) return { missing: true };
      const r = shell.getBoundingClientRect();
      return {
        bottom: Math.round(window.innerHeight - (r.top + r.height)),
        right: Math.round(window.innerWidth - (r.left + r.width)),
      };
    });
    if (gap.missing) errors.push('нет #app-shell');
    else if (gap.bottom > 12 || gap.right > 12) {
      errors.push(`масштаб ${preset}: пустое поле bottom=${gap.bottom} right=${gap.right}`);
    }
  }

  await page.locator('[data-ui-scale-preset="1"]').click();

  const setTextAmount = async (n) => {
    await page.locator('#card-text-range').fill(String(n));
    await page.locator('#card-text-range').dispatchEvent('input', { bubbles: true });
    await page.waitForTimeout(120);
  };

  for (const [amount, dens] of [
    [15, 'compact'],
    [50, 'medium'],
    [85, 'full'],
  ]) {
    await setTextAmount(amount);
    const applied = await page.evaluate((d) => document.documentElement.dataset.cardDensity === d, dens);
    if (!applied) errors.push(`плотность карточек: не применился режим ${dens} (полоска ${amount})`);
  }
  await closeSettingsModal(page);
  await page.locator('.card-size-toolbar [data-card-size-preset="compact"]').click();
  await page.waitForTimeout(200);
  const listMode = await page.evaluate(() => {
    const tile = document.querySelector('#list .card-tile');
    return {
      layout: document.documentElement.dataset.cardLayout,
      listDisplay: getComputedStyle(document.getElementById('list')).display,
      hasTile: !!tile,
      title: tile?.querySelector('.card-tile__title')?.textContent?.trim().length > 0,
    };
  });
  if (listMode.layout !== 'tile-compact') {
    errors.push(`краткий режим: ожидали layout=tile-compact, got ${listMode.layout}`);
  }
  if (!listMode.hasTile) errors.push('краткий режим: нет плиток .card-tile');
  if (!listMode.title) errors.push('краткий режим: нет заголовка на плитке');
  if (listMode.listDisplay !== 'grid') {
    errors.push(`краткий режим: список должен быть grid, got ${listMode.listDisplay}`);
  }

  const tileOpen = page.locator('#list .card-tile__open').first();
  if ((await tileOpen.count()) > 0) {
    await tileOpen.scrollIntoViewIfNeeded();
    try {
      await tileOpen.click({ timeout: 8000 });
    } catch {
      await page.evaluate(() => document.querySelector('#list .card-tile__open')?.click());
    }
    await waitModalOpen(page, 'vacancy-detail-modal');
    const detailOk = await page.evaluate(
      () => !!document.querySelector('#vacancy-detail-body .card--in-modal')
    );
    if (!detailOk) errors.push('модалка вакансии: нет полной карточки в теле');
    await page.keyboard.press('Escape');
    await waitModalHidden(page, 'vacancy-detail-modal');
  }

  await page.locator('.card-size-toolbar [data-card-size-preset="full"]').click();
  await page.waitForTimeout(200);
  const fullMode = await page.evaluate(() => ({
    layout: document.documentElement.dataset.cardLayout,
    listDisplay: getComputedStyle(document.getElementById('list')).display,
    hasCard: !!document.querySelector('#list .card'),
  }));
  if (fullMode.layout !== 'expanded') {
    errors.push(`полный режим: ожидали layout=expanded, got ${fullMode.layout}`);
  }
  if (!fullMode.hasCard) errors.push('полный режим: нет .card в ленте');
  if (fullMode.listDisplay !== 'flex') {
    errors.push(`полный режим: список должен быть flex, got ${fullMode.listDisplay}`);
  }
  await openSettingsTab(page, 'ui');
  await setTextAmount(85);
  await page.waitForTimeout(120);
  const fullText = await page.evaluate(() => {
    const card = document.querySelector('#list .card');
    if (!card) return { skip: true };
    return {
      hasMetaDetail: !!card.querySelector('.card-meta-detail:not([hidden])'),
      descParas: card.querySelectorAll('.card-desc-block .card-para').length,
    };
  });
  if (!fullText.skip && !fullText.hasMetaDetail) {
    errors.push('полный текст: нет блока meta-detail');
  }
  const hasRisksBox = await page.evaluate(
    () => !!document.querySelector('#card-tpl .risks-box, #list .risks-box')
  );
  if (!hasRisksBox) errors.push('нет блока .risks-box в шаблоне/карточке');

  await setTextAmount(50);

  const setFontScale = async (n) => {
    await page.locator('#card-font-range').fill(String(n));
    await page.locator('#card-font-range').dispatchEvent('input', { bubbles: true });
    await page.waitForTimeout(120);
  };
  await setFontScale(100);
  const titleFs100 = await page.evaluate(() => {
    const el = document.querySelector('#list .card .title-link');
    return el ? parseFloat(getComputedStyle(el).fontSize, 10) : 0;
  });
  await setFontScale(130);
  const titleFs130 = await page.evaluate(() => {
    const el = document.querySelector('#list .card .title-link');
    return el ? parseFloat(getComputedStyle(el).fontSize, 10) : 0;
  });
  if (titleFs100 > 0 && titleFs130 < titleFs100 * 1.2) {
    errors.push(
      `размер текста в карточке: ползунок не влияет на шрифт (${titleFs100}px → ${titleFs130}px)`
    );
  }
  await setFontScale(100);
  await closeSettingsModal(page);

  const junkFiltered = await page.evaluate(async () => {
    const { isGenericQuestionLabel, isCaptchaFieldLabel } = await import('/questionnaire-labels.mjs');
    const junk =
      'Отклик на вакансию Для отклика необходимо ответить на несколько вопросов работодателя';
    return (
      isGenericQuestionLabel(junk) &&
      isGenericQuestionLabel('Писать тут') &&
      isGenericQuestionLabel('Текст с картинки') &&
      isCaptchaFieldLabel('Текст с картинки Неверный текст. Пожалуйста, повторите попытку.')
    );
  });
  if (!junkFiltered) errors.push('questionnaire-labels: не отфильтрован шум / капча');

  const choiceUiOk = await page.evaluate(async () => {
    const { isChoiceQuestion, matchAnswerToOption } = await import('/questionnaire-choice.mjs');
    const q = {
      index: 1,
      label: 'Есть ли у вас опыт работы DevOps-инженером?',
      type: 'radio',
      options: [
        { value: '1', label: '1 (Нет)' },
        { value: '4', label: '4 (Опыт 3-6 лет)' },
      ],
    };
    return isChoiceQuestion(q) && Boolean(matchAnswerToOption('4', q.options));
  });
  if (!choiceUiOk) errors.push('questionnaire-choice: модуль не загружается');

  await page.evaluate(() => {
    const modal = document.getElementById('questionnaire-modal');
    const body = modal?.querySelector('.modal-questionnaire-body');
    const vac = modal?.querySelector('.modal-vacancy-questionnaire');
    if (vac) vac.textContent = 'UI test vacancy';
    if (body) {
      body.innerHTML = `<p class="questionnaire-warn">Тест</p>
        <fieldset class="questionnaire-q">
          <legend>1. Грейд?</legend>
          <div class="questionnaire-choice">
            <label class="questionnaire-choice-opt"><input type="radio" class="questionnaire-a questionnaire-a--choice" data-index="1" name="t" value="2 (Middle)"><span>2 (Middle)</span></label>
            <label class="questionnaire-choice-opt"><input type="radio" class="questionnaire-a questionnaire-a--choice" data-index="1" name="t" value="3 (Senior)" checked><span>3 (Senior)</span></label>
          </div>
        </fieldset>`;
    }
    modal.hidden = false;
    modal.classList.add('modal--open');
  });
  await waitModalOpen(page, 'questionnaire-modal');
  await page.locator('#questionnaire-modal .modal-close').click();
  await waitModalHidden(page, 'questionnaire-modal');

  const qBtn = page.locator('.btn-questionnaire-view:not([hidden])').first();
  if ((await qBtn.count()) > 0) {
    await qBtn.scrollIntoViewIfNeeded();
    await qBtn.click({ force: true });
    try {
      await waitModalOpen(page, 'questionnaire-modal');
      await page.keyboard.press('Escape');
      await waitModalHidden(page, 'questionnaire-modal');
    } catch {
      /* карточка без анкеты — кнопка могла не открыть модалку */
    }
  }

  const layout = await page.evaluate(() => {
    const list = document.getElementById('list');
    const shell = document.getElementById('app-shell');
    const listDisplay = list ? getComputedStyle(list).display : '';
    return {
      shellH: shell ? Math.round(shell.getBoundingClientRect().height) : 0,
      vh: window.innerHeight,
      listDisplay,
    };
  });
  if (layout.shellH > layout.vh + 12) {
    errors.push(`shell выше viewport: ${layout.shellH} > ${layout.vh}`);
  }
  const listLayout = await page.evaluate(() => ({
    cardLayout: document.documentElement.dataset.cardLayout,
    listDisplay: getComputedStyle(document.getElementById('list')).display,
  }));
  const expectListDisplay = listLayout.cardLayout === 'expanded' ? 'flex' : 'grid';
  if (listLayout.listDisplay !== expectListDisplay) {
    errors.push(
      `список (${listLayout.cardLayout}): ожидали display=${expectListDisplay}, got ${listLayout.listDisplay}`
    );
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#list', { timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const nav = document.getElementById('list-breadcrumbs-host')?.querySelector('.list-breadcrumbs');
      return Boolean(nav && /карточ/i.test(nav.textContent || ''));
    },
    null,
    { timeout: 20_000 }
  );

  await page.setViewportSize({ width: 1920, height: 1080 });
  const cardInfo = await page.evaluate(() => {
    const card = document.querySelector('#list .card');
    const tile = document.querySelector('#list .card-tile');
    const el = card || tile;
    const titleEl = card?.querySelector('.title-link') || tile?.querySelector('.card-tile__title');
    return {
      w: el ? Math.round(el.getBoundingClientRect().width) : 0,
      layout: document.documentElement.dataset.cardLayout || '',
      title: titleEl?.textContent?.trim().length > 0,
      isTile: !!tile && !card,
    };
  });
  if (cardInfo.w > 0 && !cardInfo.isTile && cardInfo.w < 220) {
    errors.push(`карточка слишком узкая: ${cardInfo.w}px (layout=${cardInfo.layout})`);
  }
  if (cardInfo.w > 0 && !cardInfo.title) {
    errors.push('после перезагрузки: нет заголовка на карточке/плитке');
  }

  const breadcrumbsOk = await page.evaluate(() => {
    const host = document.getElementById('list-breadcrumbs-host');
    const nav = host?.querySelector('.list-breadcrumbs');
    return Boolean(nav && nav.textContent?.includes('карточ'));
  });
  if (!breadcrumbsOk) errors.push('нет хлебных крошек в toolbar');

  await page.keyboard.press('Control+k');
  await page.waitForSelector('#command-palette:not([hidden])', { timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.getElementById('command-palette')?.hasAttribute('hidden'),
    null,
    { timeout: 3000 }
  );

  await page.locator('#btn-open-shortcuts').click();
  await waitModalOpen(page, 'shortcuts-modal');
  await page.keyboard.press('Escape');
  await waitModalHidden(page, 'shortcuts-modal');

  const sparklineOk = await page.evaluate(async () => {
    const st = await fetch('/api/job-status').then((r) => r.json());
    return Boolean(st.dashboardStats?.applyTimelineLast7?.length === 7);
  });
  if (!sparklineOk) errors.push('API: нет applyTimelineLast7 в dashboardStats');

  const shellOk = await page.evaluate(() => {
    const routine = document.getElementById('btn-daily-routine-menubar')?.textContent || '';
    const harvest = document.getElementById('btn-run-harvest-menubar')?.textContent || '';
    const dockIcon = document.querySelector('[data-dock-toggle="left"] .ui-icon');
    const sparkline = document.querySelector('.daily-sparkline');
    const pinIcon = document.querySelector('[data-dock-pin="left"] .ui-icon--pin');
    return (
      routine.includes('Утренний') &&
      harvest.includes('Поиск') &&
      Boolean(dockIcon) &&
      Boolean(sparkline) &&
      Boolean(pinIcon)
    );
  });
  if (!shellOk) errors.push('оболочка: menubar COPY, SVG-иконки или sparkline не на месте');

  if (errors.length) throw new Error(errors.join('\n'));

  console.log('OK: tooltips, tabs, плитки/лента, модалка вакансии, журнал, breadcrumbs, palette, layout 1920×1080');
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  if (e.stack) console.error(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
});
