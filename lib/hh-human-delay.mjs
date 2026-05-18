/**
 * Паузы и ввод «похожий на человека» для сценария отклика.
 * HH_FAST=1 — быстрый режим (fill, короткие паузы) для отладки селекторов.
 */

export function isFastMode() {
  return process.env.HH_FAST === '1';
}

export function jitterMs(minMs, maxMs) {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export async function sleepJitter(page, minMs, maxMs) {
  await page.waitForTimeout(jitterMs(minMs, maxMs));
}

export async function betweenMajorSteps(page) {
  if (isFastMode()) {
    await page.waitForTimeout(jitterMs(40, 120));
    return;
  }
  await sleepJitter(page, 450, 1400);
}

export async function clickHuman(page, locator) {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  if (isFastMode()) {
    await el.click();
    return;
  }
  await sleepJitter(page, 80, 280);
  await el.click({ delay: jitterMs(22, 85) });
}

export async function typeInField(page, locator, text, opts = {}) {
  const human = opts.humanTyping !== false && !isFastMode();
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click().catch(() => {});

  if (!human) {
    const target = locator.first();
    const isCE = await target.evaluate((n) => n.getAttribute('contenteditable') === 'true').catch(() => false);
    if (isCE) {
      await target.fill('');
      await target.fill(text);
    } else {
      await target.fill('');
      await target.fill(text);
    }
    return;
  }

  await el.fill('').catch(() => {});
  for (const ch of text) {
    await el.pressSequentially(ch, { delay: 0 });
    await page.waitForTimeout(jitterMs(14, 52));
  }
}
