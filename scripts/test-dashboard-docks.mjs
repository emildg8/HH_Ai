/**
 * Проверка док-панелей: скрытие, свёрнутый режим, ширина центра.
 */
import { chromium } from 'playwright';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('#list .card', { timeout: 15_000 });

  const measure = async () =>
    page.evaluate(() => {
      const center = document.querySelector('.workspace-center');
      const list = document.getElementById('list');
      const left = document.getElementById('dock-left');
      const right = document.getElementById('dock-right');
      return {
        centerW: center ? Math.round(center.getBoundingClientRect().width) : 0,
        listW: list ? Math.round(list.getBoundingClientRect().width) : 0,
        leftDisplay: left ? getComputedStyle(left).display : 'none',
        rightDisplay: right ? getComputedStyle(right).display : 'none',
        cols: document.querySelector('.workspace-stage')?.style.gridTemplateColumns || '',
      };
    });

  let m = await measure();
  if (m.centerW < 400) errors.push(`центр узкий по умолчанию: ${m.centerW}px`);

  await page.locator('[data-dock-toggle="left"]').click();
  await page.waitForTimeout(200);
  m = await measure();
  if (m.leftDisplay !== 'none') errors.push('левая панель не скрылась (display)');
  if (m.centerW < 500) errors.push(`после скрытия слева центр узкий: ${m.centerW}px`);

  await page.locator('[data-dock-toggle="right"]').click();
  await page.waitForTimeout(200);
  m = await measure();
  if (m.rightDisplay !== 'none') errors.push('правая панель не скрылась');
  if (m.centerW < 800) errors.push(`обе скрыты — центр узкий: ${m.centerW}px`);

  const title = await page.evaluate(
    () => document.querySelector('#list .card .title-link')?.textContent?.trim().length > 0
  );
  if (!title) errors.push('при скрытых панелях нет заголовка карточки');

  await page.locator('[data-dock-toggle="left"]').click();
  await page.locator('[data-dock-toggle="right"]').click();
  await page.waitForTimeout(200);
  m = await measure();
  if (m.leftDisplay === 'none' || m.rightDisplay === 'none') {
    errors.push('панели не восстановились после повторного клика');
  }

  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('OK: доки скрываются, центр расширяется, карточки на месте');
}

main().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
