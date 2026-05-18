/**
 * Прикрепить PDF / выбор резюме из профиля hh.ru в форме отклика.
 */

import { clickHuman } from './hh-human-delay.mjs';

/**
 * @param {import('playwright').Page} page
 */
function responseFormRoot(page) {
  if (/applicant\/vacancy_response/i.test(page.url())) {
    return page.locator('main, [data-qa="vacancy-response"], body').first();
  }
  return page
    .locator('[data-qa="vacancy-response-popup-form"]')
    .or(page.locator('[role="dialog"]'))
    .first();
}

function profileResumeHash() {
  return String(process.env.HH_PROFILE_RESUME_HASH || '').trim();
}

export async function attachResumePdfInResponseModal(page, pdfPath) {
  if (!pdfPath) return null;
  const root = responseFormRoot(page);
  const inputs = root.locator('input[type=file]');
  const n = await inputs.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    try {
      await inputs.nth(i).setInputFiles(pdfPath);
      console.log('[hh-apply] Прикреплено резюме PDF в форме отклика');
      return 'response-modal-file';
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * @param {import('playwright').Locator} item
 */
async function resumeItemTitle(item) {
  return ((await item.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('playwright').Page} page
 */
export async function readCurrentResponseResumeHash(page) {
  const root = responseFormRoot(page);
  const links = root.locator('a[href*="/resume/"]');
  const n = await links.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const href = (await links.nth(i).getAttribute('href').catch(() => '')) || '';
    const m = href.match(/\/resume\/([a-f0-9]{16,})/i);
    if (m) return m[1];
  }
  const u = page.url();
  const mu = u.match(/[?&]resumeId=([a-f0-9]{16,})/i);
  return mu?.[1] || '';
}

/**
 * @param {import('playwright').Page} page
 */
export async function readCurrentResponseResumeTitle(page) {
  const root = responseFormRoot(page);
  const title = root.locator('[data-qa="resume-title"]').first();
  if (await title.isVisible({ timeout: 1200 }).catch(() => false)) {
    return resumeItemTitle(title);
  }
  const block = root.locator('[data-qa="cell-left-side"]').first();
  if (await block.isVisible({ timeout: 800 }).catch(() => false)) {
    const t = await resumeItemTitle(block);
    if (t.length > 3) return t;
  }
  return '';
}

function titleMatchesPreferred(title, preferredRaw) {
  const t = String(title || '').toLowerCase();
  const p = String(preferredRaw || '').toLowerCase().trim();
  if (!p || !t) return false;
  return t.includes(p);
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 * @param {string} hash
 */
async function clickResumeByHash(page, scope, hash) {
  const candidates = [
    scope.locator(`a[href*="/resume/${hash}"]`),
    scope.locator(`a[href*="${hash}"]`),
    scope.locator(`[data-qa*="resume"]:has(a[href*="${hash}"])`),
    scope.locator(`label:has(a[href*="${hash}"])`),
    scope.locator(`[class*="resume" i]:has(a[href*="${hash}"])`),
    page.locator(`a[href*="/resume/${hash}"]`),
    page.locator(`a[href*="${hash}"]`),
  ];

  for (const loc of candidates) {
    const el = loc.first();
    if (!(await el.isVisible({ timeout: 1200 }).catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click({ force: true });
    await page.waitForTimeout(900);
    const curHash = await readCurrentResponseResumeHash(page);
    if (curHash === hash) return true;
    const title = await readCurrentResponseResumeTitle(page);
    if (title && !/поддержк|support/i.test(title)) return true;
  }

  const radios = scope.locator(`input[type="radio"][value*="${hash}"], input[type="radio"][data-resume-id="${hash}"]`);
  if ((await radios.count().catch(() => 0)) > 0) {
    const r = radios.first();
    await r.scrollIntoViewIfNeeded().catch(() => {});
    await r.click({ force: true });
    await page.waitForTimeout(700);
    return (await readCurrentResponseResumeHash(page)) === hash;
  }

  return false;
}

/**
 * @param {import('playwright').Page} page
 */
async function openResumePickerOnResponsePage(page) {
  const root = responseFormRoot(page);

  for (const re of [/изменить/i, /другое резюме/i, /сменить резюме/i, /выбрать другое/i, /выбрать резюме/i]) {
    const btn = root.getByRole('button', { name: re }).first();
    if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true });
      await page.waitForTimeout(900);
      return true;
    }
    const link = root.getByRole('link', { name: re }).first();
    if (await link.isVisible({ timeout: 400 }).catch(() => false)) {
      await link.click({ force: true });
      await page.waitForTimeout(900);
      return true;
    }
  }

  const changeResume = root.locator('[data-qa="resume-change"], [data-qa*="change-resume" i]').first();
  if (await changeResume.isVisible({ timeout: 800 }).catch(() => false)) {
    await changeResume.click({ force: true });
    await page.waitForTimeout(900);
    return true;
  }

  const title = root.locator('[data-qa="resume-title"]').first();
  if (await title.isVisible({ timeout: 800 }).catch(() => false)) {
    const cell = root
      .locator('[data-qa="cell-left-side"], [data-qa="cell"]')
      .filter({ has: title })
      .first();
    if (await cell.isVisible({ timeout: 400 }).catch(() => false)) {
      await cell.scrollIntoViewIfNeeded().catch(() => {});
      await cell.click({ force: true });
    } else {
      await title.click({ force: true });
    }
    await page.waitForTimeout(900);
    return true;
  }

  const section = root.getByText(/резюме для отклика/i).first();
  if (await section.isVisible({ timeout: 500 }).catch(() => false)) {
    await section.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} preferredRaw
 * @param {string} hash
 */
async function pickResumeInOverlay(page, preferredRaw, hash) {
  const prefRe = new RegExp(preferredRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const overlay = page.locator('[data-qa="modal-overlay"], [role="dialog"]');
  const scope = (await overlay.first().isVisible({ timeout: 2000 }).catch(() => false))
    ? overlay.first()
    : page.locator('body');

  if (hash && (await clickResumeByHash(page, scope, hash))) {
    return await readCurrentResponseResumeTitle(page);
  }

  const card = scope
    .locator('[data-qa^="resume-card"], [data-qa^="resume-card-link"], [data-qa="resume"]')
    .filter({ hasText: prefRe })
    .first();
  if (await card.isVisible({ timeout: 3500 }).catch(() => false)) {
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.click({ force: true });
    await page.waitForTimeout(800);
    const cur = await readCurrentResponseResumeTitle(page);
    if (titleMatchesPreferred(cur, preferredRaw)) return cur;
  }

  const titles = scope.locator('[data-qa="resume-title"]');
  const n = await titles.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const el = titles.nth(i);
    const text = await resumeItemTitle(el);
    if (!titleMatchesPreferred(text, preferredRaw)) continue;
    const row = el.locator('xpath=ancestor::label | ancestor::*[contains(@class,"resume")][1]').first();
    if (await row.isVisible({ timeout: 400 }).catch(() => false)) {
      await row.click({ force: true });
    } else {
      await el.click({ force: true });
    }
    await page.waitForTimeout(700);
    return text;
  }

  const any = scope.getByText(prefRe).first();
  if (await any.isVisible({ timeout: 1500 }).catch(() => false)) {
    await any.click({ force: true });
    await page.waitForTimeout(700);
    return resumeItemTitle(any);
  }

  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} preferredRaw
 * @param {string} hash
 */
async function selectResumeOnVacancyResponsePage(page, preferredRaw, hash) {
  const currentHash = await readCurrentResponseResumeHash(page);
  if (hash && currentHash === hash) {
    return await readCurrentResponseResumeTitle(page);
  }

  const current = await readCurrentResponseResumeTitle(page);
  if (titleMatchesPreferred(current, preferredRaw) && (!hash || currentHash === hash)) {
    return current;
  }

  if (hash && (await clickResumeByHash(page, page, hash))) {
    return await readCurrentResponseResumeTitle(page);
  }

  await openResumePickerOnResponsePage(page);
  const picked = await pickResumeInOverlay(page, preferredRaw, hash);
  if (picked) {
    const h = await readCurrentResponseResumeHash(page);
    if (hash && h === hash) return picked;
    if (titleMatchesPreferred(picked, preferredRaw)) return picked;
  }

  await openResumePickerOnResponsePage(page);
  await page.waitForTimeout(500);
  const retry = await pickResumeInOverlay(page, preferredRaw, hash);
  if (retry) {
    const h = await readCurrentResponseResumeHash(page);
    if (hash && h === hash) return retry;
    if (titleMatchesPreferred(retry, preferredRaw)) return retry;
  }

  const after = await readCurrentResponseResumeTitle(page);
  const afterHash = await readCurrentResponseResumeHash(page);
  if (hash && afterHash === hash) return after;
  if (titleMatchesPreferred(after, preferredRaw)) return after;
  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preferredTitle?: string, forceReselect?: boolean }} opts
 */
export async function selectProfileResumeInResponseModal(page, opts = {}) {
  const preferredRaw = String(opts.preferredTitle || process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  const hash = profileResumeHash();
  if (!preferredRaw && !hash) return null;
  const preferred = preferredRaw.toLowerCase();

  if (/applicant\/vacancy_response/i.test(page.url())) {
    const picked = await selectResumeOnVacancyResponsePage(page, preferredRaw, hash);
    if (picked) {
      const h = await readCurrentResponseResumeHash(page);
      if (hash && h === hash) return picked;
      if (titleMatchesPreferred(picked, preferredRaw)) return picked;
    }
  }

  if (hash && (await clickResumeByHash(page, responseFormRoot(page), hash))) {
    return await readCurrentResponseResumeTitle(page);
  }

  const root = responseFormRoot(page);
  const items = root.locator(
    '[data-qa="resume-select-item"], label:has(input[type="radio"]), [class*="ResumeItem"], [class*="resume-item"]'
  );
  const count = await items.count().catch(() => 0);

  let targetIdx = -1;
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const itemHash = await item.locator('a[href*="/resume/"]').first().getAttribute('href').catch(() => '');
    if (hash && itemHash?.includes(hash)) {
      targetIdx = i;
      break;
    }
    const title = (await resumeItemTitle(item)).toLowerCase();
    if (preferred && title.includes(preferred)) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) return null;

  const item = items.nth(targetIdx);
  if (!(await item.isVisible({ timeout: 800 }).catch(() => false))) return null;
  const title = await resumeItemTitle(item);
  const radio = item.locator('input[type="radio"]').first();
  const hasRadio = (await radio.count().catch(() => 0)) > 0;

  await item.scrollIntoViewIfNeeded().catch(() => {});
  await clickHuman(page, item);
  await page.waitForTimeout(450);
  if (hasRadio && !(await radio.isChecked().catch(() => false))) {
    await radio.click({ force: true });
  }
  return title;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preferredTitle?: string, log?: (msg: string) => void }} opts
 * @returns {Promise<{ ok: boolean, title: string | null, preferred: string, hash?: string }>}
 */
export async function ensurePreferredProfileResume(page, opts = {}) {
  const log = opts.log || (() => {});
  const preferredRaw = String(opts.preferredTitle || process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  const hash = profileResumeHash();
  if (!preferredRaw && !hash) return { ok: true, title: null, preferred: '' };

  const currentHash = await readCurrentResponseResumeHash(page);
  if (hash && currentHash === hash) {
    const title = await readCurrentResponseResumeTitle(page);
    log(`[hh-resume] Резюме по hash: ${title || hash.slice(0, 12) + '…'}`);
    return { ok: true, title, preferred: preferredRaw, hash };
  }

  let title = await readCurrentResponseResumeTitle(page);
  if (titleMatchesPreferred(title, preferredRaw) && (!hash || currentHash === hash)) {
    return { ok: true, title, preferred: preferredRaw, hash };
  }

  title = await selectProfileResumeInResponseModal(page, {
    preferredTitle: preferredRaw,
    forceReselect: true,
  });

  const afterHash = await readCurrentResponseResumeHash(page);
  if (hash && afterHash === hash) {
    const afterTitle = await readCurrentResponseResumeTitle(page);
    log(`[hh-resume] Выбрано резюме (hash): ${afterTitle || hash.slice(0, 12) + '…'}`);
    return { ok: true, title: afterTitle || title, preferred: preferredRaw, hash };
  }

  if (titleMatchesPreferred(title, preferredRaw)) {
    log(`[hh-resume] Выбрано резюме: ${title}`);
    return { ok: true, title, preferred: preferredRaw, hash };
  }

  const after = await readCurrentResponseResumeTitle(page);
  if (titleMatchesPreferred(after, preferredRaw)) {
    log(`[hh-resume] Резюме в форме: ${after}`);
    return { ok: true, title: after, preferred: preferredRaw, hash };
  }

  log(
    `[hh-resume] Не удалось выбрать «${preferredRaw || 'резюме'}». Сейчас: ${after || title || '—'}. ` +
      `hash=${hash ? 'задан' : 'нет'}. Проверьте config/devops.env`
  );
  return { ok: false, title: after || title, preferred: preferredRaw, hash };
}
