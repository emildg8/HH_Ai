/**
 * «Поднять резюме в поиске» на hh.ru (список резюме соискателя).
 */

import { sleepJitter } from './hh-human-delay.mjs';
import { listApplicantResumes } from './hh-resume-editor.mjs';
import { loadResumeRoutingConfig } from './resume-routing.mjs';
import { RESUME_LIST_URL } from './hh-resume-selectors.mjs';

const RAISE_LABEL = /поднять\s+в\s+поиске/i;
const RAISE_ALL_LABEL = /^поднять$/i;
const COOLDOWN_HINT = /сможете поднять|следующ|через\s+\d+\s*ч|будет доступн/i;

/**
 * @param {import('playwright').Page} page
 * @param {{ log?: (msg: string) => void }} opts
 */
async function tryRaiseAllOnList(page, opts = {}) {
  const log = opts.log || (() => {});

  const block = page.getByText(/Поднимите резюме/i).first();
  if (await block.isVisible({ timeout: 2500 }).catch(() => false)) {
    const container = block.locator('xpath=ancestor::*[contains(@class,"resume") or @data-qa][position()<=4]').first();
    const btn = container
      .getByRole('button', { name: RAISE_ALL_LABEL })
      .or(container.getByRole('link', { name: RAISE_ALL_LABEL }))
      .first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await btn.isDisabled().catch(() => false)) {
        return { ok: false, reason: 'cooldown', message: 'Подъём всех: кулдаун (4 ч)' };
      }
      log('[resume-raise] Поднять все резюме (блок на странице)');
      await btn.click();
      await page.waitForTimeout(2500);
      await dismissRaiseConfirm(page);
      return { ok: true, method: 'raise-all-block' };
    }
  }

  const globalBtn = page
    .getByRole('button', { name: RAISE_ALL_LABEL })
    .filter({ hasNot: page.getByText(/автоматически/i) })
    .first();
  if (await globalBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    if (!(await globalBtn.isDisabled().catch(() => false))) {
      log('[resume-raise] Поднять все (общая кнопка)');
      await globalBtn.click();
      await page.waitForTimeout(2500);
      await dismissRaiseConfirm(page);
      return { ok: true, method: 'raise-all-global' };
    }
  }

  return { ok: false, reason: 'not-found', message: 'Кнопка подъёма всех резюме не найдена' };
}

/**
 * @param {import('playwright').Page} page
 */
async function dismissRaiseConfirm(page) {
  const confirm = page
    .getByRole('button', { name: /^(подтвердить|да|ок|готово)$/i })
    .first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click();
    await page.waitForTimeout(1200);
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} hash
 * @param {{ log?: (msg: string) => void }} opts
 */
async function tryRaiseOneCard(page, hash, opts = {}) {
  const log = opts.log || (() => {});

  await page.evaluate((h) => {
    const a = document.querySelector(`a[href*="/resume/${h}"], [data-qa="resume-card-link-${h}"]`);
    a?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, hash);
  await page.waitForTimeout(400);

  const card = page
    .locator('[data-qa="resume"]')
    .filter({ has: page.locator(`a[href*="/resume/${hash}"], [data-qa="resume-card-link-${hash}"]`) })
    .first();

  if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
    return { ok: false, reason: 'not-found', message: `Карточка резюме ${hash.slice(0, 8)}… не на странице` };
  }

  const cardText = ((await card.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
  if (COOLDOWN_HINT.test(cardText) && !RAISE_LABEL.test(cardText)) {
    return { ok: false, reason: 'cooldown', message: 'Кулдаун ~4 ч (см. карточку на hh.ru)' };
  }

  const raiseBtn = card
    .getByRole('button', { name: RAISE_LABEL })
    .or(card.getByRole('link', { name: RAISE_LABEL }))
    .or(card.locator('button, a').filter({ hasText: RAISE_LABEL }))
    .first();

  if (!(await raiseBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
    if (COOLDOWN_HINT.test(cardText)) {
      return { ok: false, reason: 'cooldown', message: 'Подъём недоступен (кулдаун)' };
    }
    return { ok: false, reason: 'not-found', message: 'Кнопка «Поднять в поиске» не найдена' };
  }

  if (await raiseBtn.isDisabled().catch(() => false)) {
    return { ok: false, reason: 'cooldown', message: 'Кнопка неактивна (кулдаун 4 ч)' };
  }

  log(`[resume-raise] Поднять: ${hash.slice(0, 8)}…`);
  await raiseBtn.click();
  await page.waitForTimeout(2000);
  await dismissRaiseConfirm(page);
  return { ok: true, method: 'card' };
}

/**
 * @param {import('playwright').Page} page
 * @param {{
 *   raiseAll?: boolean,
 *   hash?: string,
 *   role?: string,
 *   hashes?: string[],
 *   log?: (msg: string) => void,
 * }} opts
 */
export async function raiseResumesOnHh(page, opts = {}) {
  const log = opts.log || ((m) => console.log(m));
  /** @type {Set<string>} */
  const targetHashes = new Set();

  if (opts.raiseAll) {
    await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1200);
    const listed = await listApplicantResumes(page);
    for (const r of listed) targetHashes.add(r.hash);
  } else if (opts.hash) {
    targetHashes.add(String(opts.hash).trim());
  } else if (opts.role) {
    const cfg = loadResumeRoutingConfig();
    const entry = cfg.resumes?.[opts.role];
    if (!entry?.hash) throw new Error(`Нет hash для роли «${opts.role}» в resume-routing.json`);
    targetHashes.add(entry.hash);
  } else if (opts.hashes?.length) {
    for (const h of opts.hashes) targetHashes.add(String(h).trim());
  } else {
    const cfg = loadResumeRoutingConfig();
    for (const e of Object.values(cfg.resumes || {})) {
      if (e?.hash) targetHashes.add(String(e.hash).trim());
    }
  }

  if (!targetHashes.size && !opts.raiseAll) {
    throw new Error('Нет hash резюме — заполните config/resume-routing.json (npm run devops:list-resumes)');
  }

  await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  /** @type {{ raised: object[], skipped: object[], errors: object[] }} */
  const out = { raised: [], skipped: [], errors: [] };

  if (opts.raiseAll && targetHashes.size > 1) {
    const all = await tryRaiseAllOnList(page, { log });
    if (all.ok) {
      out.raised.push({ scope: 'all', ...all });
      return out;
    }
    if (all.reason === 'cooldown') {
      out.skipped.push({ scope: 'all', ...all });
    } else {
      log(`[resume-raise] Подъём всех не сработал (${all.message}) — по одному`);
    }
  }

  for (const hash of targetHashes) {
    const r = await tryRaiseOneCard(page, hash, { log });
    const row = { hash, ...r };
    if (r.ok) out.raised.push(row);
    else if (r.reason === 'cooldown') out.skipped.push(row);
    else out.errors.push(row);
    await sleepJitter(page, 700, 1400);
  }

  return out;
}
