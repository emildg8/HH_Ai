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
function hashFromHref(href) {
  const m = String(href || '').match(/\/resume\/([a-f0-9]{16,})/i);
  return m?.[1] || '';
}

/**
 * Hash выбранного резюме (не первой ссылки на странице).
 * @param {import('playwright').Page} page
 */
export async function readCurrentResponseResumeHash(page) {
  const root = responseFormRoot(page);

  const checkedRadio = root.locator(
    'input[type="radio"]:checked, [data-qa="resume-select-item"] input[type="radio"]:checked'
  );
  if ((await checkedRadio.count().catch(() => 0)) > 0) {
    const val = (await checkedRadio.first().getAttribute('value').catch(() => '')) || '';
    if (/^[a-f0-9]{16,}$/i.test(val)) return val;
    const row = checkedRadio.first().locator('xpath=ancestor::*[.//a[contains(@href,"/resume/")]][1]');
    const href = (await row.locator('a[href*="/resume/"]').first().getAttribute('href').catch(() => '')) || '';
    const h = hashFromHref(href);
    if (h) return h;
  }

  const selectedItem = root.locator(
    '[data-qa="resume-select-item"]:has(input[type="radio"]:checked), [data-qa="resume-select-item"][class*="selected" i], [data-qa="resume-select-item"][aria-checked="true"]'
  );
  if ((await selectedItem.count().catch(() => 0)) > 0) {
    const href =
      (await selectedItem
        .first()
        .locator('a[href*="/resume/"]')
        .first()
        .getAttribute('href')
        .catch(() => '')) || '';
    const h = hashFromHref(href);
    if (h) return h;
  }

  const titleBlock = root.locator('[data-qa="resume-title"]').first();
  if (await titleBlock.isVisible({ timeout: 600 }).catch(() => false)) {
    const href =
      (await titleBlock
        .locator('xpath=ancestor::*[.//a[contains(@href,"/resume/")]][1]//a[contains(@href,"/resume/")]')
        .first()
        .getAttribute('href')
        .catch(() => '')) || '';
    const h = hashFromHref(href);
    if (h) return h;
  }

  const resumeArea = root.locator(
    '[data-qa="resume-select-item"], [data-qa*="resume-select" i], [data-qa="cell-left-side"]'
  );
  if ((await resumeArea.count().catch(() => 0)) > 0) {
    const links = resumeArea.first().locator('a[href*="/resume/"]');
    const n = await links.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const h = hashFromHref(await links.nth(i).getAttribute('href').catch(() => ''));
      if (h) return h;
    }
  }

  const links = root.locator('a[href*="/resume/"]');
  const n = await links.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const h = hashFromHref(await links.nth(i).getAttribute('href').catch(() => ''));
    if (h) return h;
  }

  return readResumeHashFromUrlOnly(page);
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

export function titleMatchesPreferred(title, preferredRaw) {
  const t = String(title || '').toLowerCase();
  const p = String(preferredRaw || '').toLowerCase().trim();
  if (!p || !t) return false;
  if (p === 'devops' && /\bdevops\b/i.test(t)) return true;
  if (t.includes(p)) return true;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
}

export function confirmedPreferredResumeTitle(observedTitle, preferredRaw) {
  return titleMatchesPreferred(observedTitle, preferredRaw) ? observedTitle : null;
}

/** @param {string} title @param {string} preferredRaw */
function scoreTitleMatch(title, preferredRaw) {
  const t = String(title || '').toLowerCase();
  const p = String(preferredRaw || '').toLowerCase().trim();
  if (!p || !t) return 0;
  if (p.includes('devops') && /data\s*engineer|data\s*scientist/i.test(t)) return 0;
  if (t === p) return 100;
  if (new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title)) return 90;
  if (t.includes(p)) return 70;
  if (p.length <= 12 && /\bdevops\b/i.test(t)) return 85;
  return 0;
}

/**
 * Hash из URL часто устаревший — не доверять, если в форме уже видно другое резюме.
 * @param {import('playwright').Page} page
 */
async function readResumeHashFromUrlOnly(page) {
  const mu = page.url().match(/[?&]resumeId=([a-f0-9]{16,})/i);
  return mu?.[1] || '';
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

  if (hash && !preferredRaw && (await clickResumeByHash(page, scope, hash))) {
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
  const useHash = hash && !preferredRaw;
  const currentHash = await readCurrentResponseResumeHash(page);
  if (useHash && currentHash === hash) {
    return await readCurrentResponseResumeTitle(page);
  }

  const current = await readCurrentResponseResumeTitle(page);
  if (titleMatchesPreferred(current, preferredRaw) && (!useHash || currentHash === hash)) {
    return current;
  }

  if (useHash && (await clickResumeByHash(page, page, hash))) {
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
 * @param {string} preferredRaw
 * @param {string} [hash]
 */
async function selectBestResumeByTitleInList(page, preferredRaw, hash = '') {
  const root = responseFormRoot(page);
  const items = root.locator(
    '[data-qa="resume-select-item"], label:has(input[type="radio"]), [class*="ResumeItem"], [class*="resume-item"]'
  );
  const count = await items.count().catch(() => 0);
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const title = await resumeItemTitle(item);
    let score = scoreTitleMatch(title, preferredRaw);
    const itemHref =
      (await item.locator('a[href*="/resume/"]').first().getAttribute('href').catch(() => '')) || '';
    if (hash && itemHref.includes(hash) && titleMatchesPreferred(title, preferredRaw)) score += 5;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestIdx < 0 || bestScore < 55) {
    await openResumePickerOnResponsePage(page);
    await page.waitForTimeout(500);
    return pickResumeInOverlay(page, preferredRaw, '');
  }

  const item = items.nth(bestIdx);
  await item.scrollIntoViewIfNeeded().catch(() => {});
  await clickHuman(page, item);
  await page.waitForTimeout(450);
  const radio = item.locator('input[type="radio"]').first();
  if ((await radio.count().catch(() => 0)) > 0 && !(await radio.isChecked().catch(() => false))) {
    await radio.click({ force: true });
  }
  const picked = await readCurrentResponseResumeTitle(page);
  return confirmedPreferredResumeTitle(picked, preferredRaw);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preferredTitle?: string, forceReselect?: boolean, resumeHash?: string }} opts
 */
export async function selectProfileResumeInResponseModal(page, opts = {}) {
  const preferredRaw = String(opts.preferredTitle || process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  const configHash = String(opts.resumeHash ?? profileResumeHash()).trim();
  if (!preferredRaw && !configHash) return null;

  if (preferredRaw) {
    const byTitle = await selectBestResumeByTitleInList(page, preferredRaw, configHash);
    if (byTitle && titleMatchesPreferred(byTitle, preferredRaw)) return byTitle;
  }

  if (configHash && (await clickResumeByHash(page, responseFormRoot(page), configHash))) {
    const t = await readCurrentResponseResumeTitle(page);
    if (!preferredRaw || titleMatchesPreferred(t, preferredRaw)) return t;
  }

  if (/applicant\/vacancy_response/i.test(page.url())) {
    const picked = await selectResumeOnVacancyResponsePage(page, preferredRaw, configHash);
    if (picked && titleMatchesPreferred(picked, preferredRaw)) return picked;
    if (picked && !preferredRaw) return picked;
  }

  if (configHash && (await clickResumeByHash(page, responseFormRoot(page), configHash))) {
    const t = await readCurrentResponseResumeTitle(page);
    if (!preferredRaw || titleMatchesPreferred(t, preferredRaw)) return t;
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
    if (configHash && itemHash?.includes(configHash)) {
      targetIdx = i;
      break;
    }
    const title = (await resumeItemTitle(item)).toLowerCase();
    const pref = preferredRaw.toLowerCase();
    if (pref && title.includes(pref)) {
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
  const configHash = profileResumeHash();
  if (!preferredRaw && !configHash) return { ok: true, title: null, preferred: '' };

  const currentHash = await readCurrentResponseResumeHash(page);
  let title = await readCurrentResponseResumeTitle(page);

  /** Hash не используем, если по нему в форме уже не то резюме (часто устаревший resumeId в URL). */
  let effectiveHash = configHash;
  if (configHash && preferredRaw && currentHash === configHash && !titleMatchesPreferred(title, preferredRaw)) {
    effectiveHash = '';
    if (!opts._hashMismatchLogged) {
      opts._hashMismatchLogged = true;
      log(
        `[hh-resume] HASH в config устарел (сейчас «${title || '—'}», нужно «${preferredRaw}») — выбираю по названию. ` +
          'Обновите: npm run devops:list-resumes → HH_PROFILE_RESUME_HASH в config/devops.env'
      );
    }
  }

  if (titleMatchesPreferred(title, preferredRaw)) {
    log(`[hh-resume] Резюме: ${title}`);
    return { ok: true, title, preferred: preferredRaw, hash: currentHash || effectiveHash || configHash };
  }

  if (effectiveHash && currentHash === effectiveHash && titleMatchesPreferred(title, preferredRaw)) {
    log(`[hh-resume] Резюме по hash: ${title || effectiveHash.slice(0, 12) + '…'}`);
    return { ok: true, title, preferred: preferredRaw, hash: effectiveHash };
  }

  if (effectiveHash && currentHash && currentHash !== effectiveHash && preferredRaw) {
    log(
      `[hh-resume] В форме другой hash (${currentHash.slice(0, 8)}…); ищу «${preferredRaw}»`
    );
  }

  title = await selectProfileResumeInResponseModal(page, {
    preferredTitle: preferredRaw,
    forceReselect: true,
    resumeHash: effectiveHash,
  });

  let afterTitle = await readCurrentResponseResumeTitle(page);
  let afterHash = await readCurrentResponseResumeHash(page);

  if (
    !confirmedPreferredResumeTitle(afterTitle, preferredRaw) &&
    effectiveHash &&
    (await clickResumeByHash(page, responseFormRoot(page), effectiveHash))
  ) {
    await page.waitForTimeout(600);
    afterTitle = await readCurrentResponseResumeTitle(page);
    afterHash = await readCurrentResponseResumeHash(page);
  }

  const confirmedTitle = confirmedPreferredResumeTitle(afterTitle, preferredRaw);
  if (confirmedTitle) {
    log(`[hh-resume] Выбрано резюме: ${confirmedTitle}`);
    return { ok: true, title: confirmedTitle, preferred: preferredRaw, hash: afterHash };
  }

  log(
    `[hh-resume] Не удалось выбрать «${preferredRaw || 'резюме'}». Сейчас: ${afterTitle || title || '—'}. ` +
      `Запустите: npm run devops:list-resumes и обновите HH_PROFILE_RESUME_HASH в config/devops.env`
  );
  return { ok: false, title: afterTitle || title, preferred: preferredRaw, hash: afterHash };
}
