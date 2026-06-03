/**
 * Проверка док-панелей: скрытие по сплиттеру, раскрытие кликом, ширина центра.
 */
import { chromium } from 'playwright';
import {
  gotoDashboardReady,
  waitDockHidden,
  waitDockVisible,
} from './lib/dashboard-test-helpers.mjs';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];

  await gotoDashboardReady(page, BASE);

  const measure = async () =>
    page.evaluate(() => {
      const center = document.querySelector('.workspace-center');
      const left = document.getElementById('dock-left');
      const right = document.getElementById('dock-right');
      const leftSplit = document.getElementById('splitter-left');
      const rightSplit = document.getElementById('splitter-right');
      return {
        centerW: center ? Math.round(center.getBoundingClientRect().width) : 0,
        leftDisplay: left ? getComputedStyle(left).display : 'none',
        rightDisplay: right ? getComputedStyle(right).display : 'none',
        leftSplitHidden: leftSplit?.classList.contains('dock-splitter--panel-hidden'),
        rightSplitHidden: rightSplit?.classList.contains('dock-splitter--panel-hidden'),
      };
    });

  let m = await measure();
  const minCenter = Math.floor(1400 * 0.45);
  if (m.centerW < minCenter) errors.push(`центр узкий по умолчанию: ${m.centerW}px`);
  if (m.leftSplitHidden || m.rightSplitHidden) {
    errors.push('сплиттеры не должны быть в режиме скрытой панели по умолчанию');
  }

  await page.locator('#splitter-left').click({ position: { x: 6, y: 200 } });
  await waitDockHidden(page, 'left');
  m = await measure();
  if (m.leftDisplay !== 'none') errors.push('левая панель не скрылась (display)');
  if (!m.leftSplitHidden) errors.push('левый сплиттер не перешёл в режим скрытой панели');

  await page.locator('#splitter-right').click({ position: { x: 6, y: 200 } });
  await waitDockHidden(page, 'right');
  m = await measure();
  if (m.rightDisplay !== 'none') errors.push('правая панель не скрылась');
  if (!m.rightSplitHidden) errors.push('правый сплиттер не перешёл в режим скрытой панели');
  if (m.centerW < Math.floor(1400 * 0.7)) errors.push(`обе скрыты — центр узкий: ${m.centerW}px`);

  // hover сразу после скрытия не должен раскрывать панели (курсор остаётся на сплиттере)
  await page.locator('#splitter-left').hover({ position: { x: 6, y: 200 } });
  await page.locator('#splitter-right').hover({ position: { x: 6, y: 200 } });
  await page.waitForTimeout(250);
  m = await measure();
  if (m.leftDisplay !== 'none' || m.rightDisplay !== 'none') {
    errors.push('панели вернулись после hover на сплиттере сразу после скрытия');
  }

  const title = await page.evaluate(
    () => document.querySelector('#list .card .title-link, #list .card-tile__title')?.textContent?.trim().length > 0
  );
  if (!title) errors.push('при скрытых панелях нет заголовка карточки');

  await page.locator('#splitter-left').click({ position: { x: 6, y: 200 } });
  await waitDockVisible(page, 'left');
  await page.locator('#splitter-right').click({ position: { x: 6, y: 200 } });
  await waitDockVisible(page, 'right');
  m = await measure();
  if (m.leftDisplay === 'none' || m.rightDisplay === 'none') {
    errors.push('панели не восстановились после клика по сплиттеру');
  }

  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('OK: доки скрываются по сплиттеру, раскрываются кликом, центр расширяется');
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
