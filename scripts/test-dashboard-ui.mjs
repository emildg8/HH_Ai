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
  await page.locator('[data-apply-view="noQuestionnaire"]').click();
  await page.locator('[data-apply-view="questionnaire"]').click();
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
  const widths = {};
  for (const [amount, dens] of [
    [15, 'compact'],
    [50, 'medium'],
    [85, 'full'],
  ]) {
    await setTextAmount(amount);
    await page.waitForTimeout(150);
    widths[dens] = await page.evaluate(() => {
      const card = document.querySelector('#list .card');
      return card ? Math.round(card.getBoundingClientRect().width) : 0;
    });
  }
  if (widths.compact && widths.full && Math.abs(widths.compact - widths.full) > 8) {
    errors.push(
      `ширина карточки не должна зависеть от режима текста: compact=${widths.compact} full=${widths.full}`
    );
  }
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

  const junkFiltered = await page.evaluate(async () => {
    const { isGenericQuestionLabel } = await import('/questionnaire-labels.mjs');
    const junk =
      'Отклик на вакансию Для отклика необходимо ответить на несколько вопросов работодателя';
    return isGenericQuestionLabel(junk) && isGenericQuestionLabel('Писать тут');
  });
  if (!junkFiltered) errors.push('questionnaire-labels: не отфильтрован шум страницы / placeholder');

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
    await waitModalOpen(page, 'questionnaire-modal');
    await page.keyboard.press('Escape');
    await waitModalHidden(page, 'questionnaire-modal');
  }

  const layout = await page.evaluate(() => {
    const list = document.getElementById('list');
    const cols = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length;
    const shell = document.getElementById('app-shell');
    return {
      shellH: shell ? Math.round(shell.getBoundingClientRect().height) : 0,
      vh: window.innerHeight,
      gridCols: cols,
    };
  });
  if (layout.shellH > layout.vh + 12) {
    errors.push(`shell выше viewport: ${layout.shellH} > ${layout.vh}`);
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

  await page.setViewportSize({ width: 1920, height: 1080 });
  const wideCols = await page.evaluate(() => {
    const list = document.getElementById('list');
    return getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length;
  });
  const cardW = await page.evaluate(() => {
    const card = document.querySelector('#list .card');
    return card ? Math.round(card.getBoundingClientRect().width) : 0;
  });
  if (cardW > 0 && cardW < 440) {
    errors.push(`ширина карточки слишком мала: ${cardW}px (ожидали ~40rem)`);
  }

  if (errors.length) throw new Error(errors.join('\n'));

  console.log('OK: tooltips, tabs, плотность карточек, фильтры, журнал, модалки, layout 1920×1080');
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
