/**
 * Прикрепить PDF / выбор резюме из профиля hh.ru в форме отклика.
 */

import { clickHuman, isFastMode } from './hh-human-delay.mjs';
import { pickAndApplyEmployerResume } from './hh-resume-picker.mjs';

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

/** Не путать варианты анкеты работодателя с резюме в списке radio. */
function looksLikeResumeListEntry(title, hash, href) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const h = String(hash || '').trim();
  const u = String(href || '');
  if (h && /^[a-f0-9]{16,}$/i.test(h)) return true;
  if (/\/resume\/[a-f0-9]{16,}/i.test(u)) return true;
  if (
    /тестирован|smoke|регресс|интеграц|доступност|язык.*программ|автотест|pytest|матчмейкинг/i.test(
      t
    )
  ) {
    return false;
  }
  if (t.length > 95) return false;
  if (!h && !/\/resume\//i.test(u)) return false;
  return t.length >= 3;
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

  const hasResumeList = await root
    .locator('[data-qa="resume-select-item"]')
    .first()
    .isVisible({ timeout: 300 })
    .catch(() => false);
  if (!hasResumeList) return readResumeHashFromUrlOnly(page);
  return '';
}

/**
 * Резюме, которые hh.ru показывает в форме отклика (работодатель может отфильтровать список).
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ title: string, hash: string }>>}
 */
export async function listResponseFormResumes(page) {
  const root = responseFormRoot(page);
  const items = root.locator('[data-qa="resume-select-item"]');
  const count = await items.count().catch(() => 0);
  /** @type {Array<{ title: string, hash: string }>} */
  const out = [];

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const title = await resumeItemTitle(item);
    const href =
      (await item.locator('a[href*="/resume/"]').first().getAttribute('href').catch(() => '')) || '';
    let hash = hashFromHref(href);
    const radio = item.locator('input[type="radio"]').first();
    if (!hash && (await radio.count().catch(() => 0)) > 0) {
      const val = (await radio.getAttribute('value').catch(() => '')) || '';
      if (/^[a-f0-9]{16,}$/i.test(val)) hash = val;
    }
    out.push({ title, hash });
  }

  if (!out.length) {
    const labels = root.locator('label:has(input[type="radio"])');
    const ln = await labels.count().catch(() => 0);
    for (let i = 0; i < ln; i++) {
      const label = labels.nth(i);
      const title = await resumeItemTitle(label);
      const href =
        (await label.locator('a[href*="/resume/"]').first().getAttribute('href').catch(() => '')) ||
        '';
      let hash = hashFromHref(href);
      const radio = label.locator('input[type="radio"]').first();
      if (!hash && (await radio.count().catch(() => 0)) > 0) {
        const val = (await radio.getAttribute('value').catch(() => '')) || '';
        if (/^[a-f0-9]{16,}$/i.test(val)) hash = val;
      }
      if (!looksLikeResumeListEntry(title, hash, href)) continue;
      out.push({ title, hash });
    }
  }

  return out;
}

/**
 * @param {Array<{ title: string, hash: string }>} available
 * @param {string} hash
 * @param {string} preferredRaw
 */
function preferredResumeListed(available, hash, preferredRaw) {
  if (!available.length) return true;
  if (hash && available.some((a) => a.hash === hash)) return true;
  if (preferredRaw && available.some((a) => titleMatchesPreferred(a.title, preferredRaw))) return true;
  return false;
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
  if (/devops|sre|инженер эксплуатации|platform engineer|mlops|observability/i.test(p)) {
    if (/data\s*engineer|data\s*scientist|аналитик данных/i.test(t)) return false;
    if (/\bdevops\b|\bsre\b|mlops|observability|platform\s+engineer|инженер эксплуатации/i.test(t)) {
      return true;
    }
  }
  if (/data\s*engineer|аналитик данных/i.test(p) && /\bdevops\b|sre\b/i.test(t)) return false;
  if (p === 'devops' && /\bdevops\b/i.test(t)) return true;
  if (t.includes(p)) return true;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
}

/**
 * Перезагрузка мастера отклика с нужным resumeId (сброс шага письма).
 * @param {import('playwright').Page} page
 * @param {{ vacancyId: string, resumeHash: string, log?: (msg: string) => void }} opts
 */
export async function reloadVacancyResponseWithResume(page, opts) {
  const vacancyId = String(opts.vacancyId || '').trim();
  const resumeHash = String(opts.resumeHash || '').trim();
  const log = opts.log || (() => {});
  if (!vacancyId || !resumeHash) return false;
  const q = new URLSearchParams({ vacancyId, resumeId: resumeHash, hhtmFrom: 'vacancy' });
  const url = `https://hh.ru/applicant/vacancy_response?${q.toString()}`;
  log(`[hh-resume] Перезагрузка формы отклика (resumeId=${resumeHash.slice(0, 8)}…)`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  return true;
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

  for (const re of [
    /редактировать/i,
    /изменить/i,
    /другое резюме/i,
    /сменить резюме/i,
    /выбрать другое/i,
    /выбрать резюме/i,
  ]) {
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
 * Выбор резюме радиокнопкой в списке на странице отклика (основной UI hh.ru).
 * @param {import('playwright').Page} page
 * @param {string} preferredRaw
 * @param {string} hash
 */
export async function selectResumeRadioFromList(page, preferredRaw, hash) {
  const root = responseFormRoot(page);
  const items = root.locator('[data-qa="resume-select-item"]');
  const count = await items.count().catch(() => 0);
  const pickWait = isFastMode() ? 350 : 700;

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const title = await resumeItemTitle(item);
    const href =
      (await item.locator('a[href*="/resume/"]').first().getAttribute('href').catch(() => '')) || '';
    const itemHash = hashFromHref(href);
    const byHash = hash && itemHash === hash;
    const byTitle = preferredRaw && titleMatchesPreferred(title, preferredRaw);
    if (!byHash && !byTitle) continue;

    await item.scrollIntoViewIfNeeded().catch(() => {});
    const radio = item.locator('input[type="radio"]').first();
    if ((await radio.count().catch(() => 0)) > 0) {
      await radio.check({ force: true }).catch(async () => {
        await radio.click({ force: true });
      });
    } else {
      await item.click({ force: true });
    }
    await page.waitForTimeout(pickWait);

    const pickedTitle = await readCurrentResponseResumeTitle(page);
    const pickedHash = await readCurrentResponseResumeHash(page);
    if (byHash && pickedHash === hash) return pickedTitle || title;
    if (byTitle && titleMatchesPreferred(pickedTitle, preferredRaw)) return pickedTitle || title;
  }

  const labels = root.locator('label:has(input[type="radio"])');
  const ln = await labels.count().catch(() => 0);
  for (let i = 0; i < ln; i++) {
    const label = labels.nth(i);
    const title = await resumeItemTitle(label);
    if (!preferredRaw || !titleMatchesPreferred(title, preferredRaw)) continue;
    const radio = label.locator('input[type="radio"]').first();
    await radio.check({ force: true }).catch(() => label.click({ force: true }));
    await page.waitForTimeout(pickWait);
    const pickedTitle = await readCurrentResponseResumeTitle(page);
    if (titleMatchesPreferred(pickedTitle, preferredRaw)) return pickedTitle || title;
  }

  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} preferredRaw
 * @param {string} hash
 */
async function pickResumeInOverlay(page, preferredRaw, hash) {
  const prefRe = new RegExp(preferredRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const overlay = page.locator('[data-qa="modal-overlay"], [role="dialog"]');
  const scope = (await overlay.first().isVisible({ timeout: isFastMode() ? 800 : 2000 }).catch(() => false))
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
  /** @type {string} */
  let bestTitle = '';
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
      bestTitle = title;
    }
  }
  if (bestIdx < 0 || bestScore < 55) {
    await openResumePickerOnResponsePage(page);
    await page.waitForTimeout(500);
    return pickResumeInOverlay(page, preferredRaw, '');
  }

  const item = items.nth(bestIdx);
  await item.scrollIntoViewIfNeeded().catch(() => {});
  const radio = item.locator('input[type="radio"]').first();
  if ((await radio.count().catch(() => 0)) > 0) {
    await radio.check({ force: true }).catch(() => clickHuman(page, item));
  } else {
    await clickHuman(page, item);
  }
  await page.waitForTimeout(isFastMode() ? 250 : 450);
  const picked = await readCurrentResponseResumeTitle(page);
  return titleMatchesPreferred(picked, preferredRaw) ? picked : bestTitle;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preferredTitle?: string, forceReselect?: boolean, resumeHash?: string }} opts
 */
export async function selectProfileResumeInResponseModal(page, opts = {}) {
  const preferredRaw = String(opts.preferredTitle || process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  const configHash = String(opts.resumeHash ?? profileResumeHash()).trim();
  if (!preferredRaw && !configHash) return null;

  const { isEmployerQuestionnaireWizardStep } = await import('./hh-employer-questionnaire.mjs');
  if (await isEmployerQuestionnaireWizardStep(page)) {
    return readCurrentResponseResumeTitle(page);
  }

  if (/applicant\/vacancy_response/i.test(page.url())) {
    const fromRadio = await selectResumeRadioFromList(page, preferredRaw, configHash);
    if (fromRadio && titleMatchesPreferred(fromRadio, preferredRaw)) return fromRadio;
    if (fromRadio && configHash) {
      const h = await readCurrentResponseResumeHash(page);
      if (h === configHash) return fromRadio;
    }
  }

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
 * @param {{ preferredTitle?: string, resumeHash?: string, vacancyId?: string, log?: (msg: string) => void }} opts
 * @returns {Promise<{ ok: boolean, title: string | null, preferred: string, hash?: string }>}
 */
export async function ensurePreferredProfileResume(page, opts = {}) {
  const log = opts.log || (() => {});
  const preferredRaw = String(opts.preferredTitle || process.env.HH_PROFILE_RESUME_TITLE || '').trim();
  const configHash = String(opts.resumeHash ?? profileResumeHash()).trim();
  const vacancyId = String(opts.vacancyId || '').trim();
  const idealRole = String(opts.idealRole || '').trim();
  if (!preferredRaw && !configHash && !idealRole) return { ok: true, title: null, preferred: '' };

  const { isEmployerQuestionnaireWizardStep } = await import('./hh-employer-questionnaire.mjs');
  if (await isEmployerQuestionnaireWizardStep(page)) {
    const title = await readCurrentResponseResumeTitle(page).catch(() => '');
    log('[hh-resume] Шаг анкеты — выбор резюме на hh.ru уже пройден, не трогаем radio вопросов');
    return { ok: true, title: title || null, preferred: preferredRaw, skippedOnQuestionnaire: true };
  }

  if (/applicant\/vacancy_response/i.test(page.url())) {
    const picked = await pickAndApplyEmployerResume(page, {
      idealRole,
      preferredTitle: preferredRaw,
      resumeHash: configHash,
      vacancyId,
      log,
    });
    if (picked.ok || picked.notInEmployerList) return picked;
  }

  const legacy = await selectProfileResumeInResponseModal(page, {
    preferredTitle: preferredRaw,
    forceReselect: true,
    resumeHash: configHash,
  });
  const afterTitle = await readCurrentResponseResumeTitle(page);
  const afterHash = await readCurrentResponseResumeHash(page);
  if (configHash && afterHash && afterHash === configHash) {
    log(`[hh-resume] Выбрано по hash: ${afterTitle || legacy || configHash.slice(0, 8) + '…'}`);
    return { ok: true, title: afterTitle || legacy, preferred: preferredRaw, hash: afterHash };
  }
  if (legacy && titleMatchesPreferred(legacy, preferredRaw)) {
    log(`[hh-resume] Выбрано (модалка): ${legacy}`);
    return { ok: true, title: legacy, preferred: preferredRaw, hash: afterHash };
  }
  if (titleMatchesPreferred(afterTitle, preferredRaw)) {
    return { ok: true, title: afterTitle, preferred: preferredRaw, hash: afterHash };
  }
  return {
    ok: false,
    title: afterTitle,
    preferred: preferredRaw,
    hash: afterHash,
    resumeMismatch: true,
  };
}
