/**
 * Выбор резюме по тому, что hh.ru реально показывает в форме отклика.
 * Сначала список работодателя → scoring по config/resume-routing.json → radio.check().
 */

import { loadResumeRoutingConfig } from './resume-routing.mjs';
import { isFastMode } from './hh-human-delay.mjs';
import {
  listResponseFormResumes,
  readCurrentResponseResumeHash,
  readCurrentResponseResumeTitle,
  titleMatchesPreferred,
  selectResumeRadioFromList,
  reloadVacancyResponseWithResume,
  selectProfileResumeInResponseModal,
} from './hh-resume-upload.mjs';

const MIN_SCORE = 30;
const MIN_FALLBACK_SCORE = 40;

/**
 * Magritte compact: карточка резюме (role=button + шеврон) открывает список.
 * Не кликать «Другое Softline» в сайдбаре вакансии.
 * @param {import('playwright').Page} page
 * @param {(msg: string) => void} log
 */
async function openCompactResumePicker(page, log) {
  const tryList = async () => {
    const radios = await page.locator('input[type="radio"]').count().catch(() => 0);
    if (radios < 2) return [];
    return dedupeEmployerResumes(await listMagritteResumeRadios(page));
  };

  // 1) Magritte-карточка резюме (role=button + resume-title) — не сайдбар «Другое Softline/Ригла».
  const card = page
    .locator('[role="button"]')
    .filter({ has: page.locator('[data-qa="resume-title"]') })
    .first();
  if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
    log('[hh-resume] Открываем список резюме (клик + Enter по Magritte-карточке)');
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
    await card.focus().catch(() => {});
    await page.keyboard.press('Enter');
    for (const waitMs of [300, 600, 1200, 2000]) {
      await page.waitForTimeout(waitMs);
      const out = await tryList();
      if (out.length >= 2) {
        log(`[hh-resume] список после открытия: ${out.length}`);
        return out;
      }
    }
  } else {
    log('[hh-resume] Magritte-карточка резюме не найдена');
  }

  // 2) Клик по самому [data-qa=resume-title] / шеврону в блоке «Резюме для отклика»
  const titleEl = page.locator('[data-qa="resume-title"]').first();
  if (await titleEl.isVisible({ timeout: 1500 }).catch(() => false)) {
    log('[hh-resume] Клик по resume-title (раскрыть список)');
    await titleEl.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    let out = await tryList();
    if (out.length >= 2) return out;
    const parentBtn = titleEl.locator('xpath=ancestor::*[@role="button"][1]').first();
    if (await parentBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await parentBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      out = await tryList();
      if (out.length >= 2) return out;
    }
  }

  const fallback = dedupeEmployerResumes(await listMagritteResumeRadios(page));
  if (fallback.length) log(`[hh-resume] Magritte radio fallback: ${fallback.length}`);
  return fallback;
}

/**
 * Magritte expanded list: radio + соседний resume-title (без data-qa=resume-select-item).
 * @param {import('playwright').Page} page
 */
async function listMagritteResumeRadios(page) {
  return page.evaluate(() => {
    /** @type {Array<{ title: string, hash: string }>} */
    const out = [];
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    for (const input of radios) {
      const name = `${input.name || ''} ${input.getAttribute('data-qa') || ''}`.toLowerCase();
      if (/letter|письм|agree|соглас/i.test(name)) continue;
      let hash = '';
      const val = input.value || '';
      if (/^[a-f0-9]{16,}$/i.test(val)) hash = val;
      const row =
        input.closest('[role="button"], label, [data-qa="cell"], [class*="magritte-card"]') ||
        input.parentElement;
      const titleEl = row?.querySelector('[data-qa="resume-title"], [data-qa="cell-text-content"]');
      let title = (titleEl?.textContent || '').replace(/\s+/g, ' ').trim();
      if (!title) {
        const aria = input.getAttribute('aria-label') || '';
        title = aria.replace(/\s+/g, ' ').trim();
      }
      if (!title || title.length < 4) continue;
      if (!hash) {
        const href = row?.querySelector('a[href*="/resume/"]')?.getAttribute('href') || '';
        const m = href.match(/\/resume\/([a-f0-9]{16,})/i);
        if (m) hash = m[1];
      }
      out.push({ title, hash });
    }
    return out;
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} title
 * @param {string} [hash]
 */
async function selectMagritteResumeByTitle(page, title, hash = '') {
  const want = String(title || '').trim();
  if (!want && !hash) return null;
  const ok = await page.evaluate(
    ({ wantTitle, wantHash }) => {
      const radios = [...document.querySelectorAll('input[type="radio"]')];
      for (const input of radios) {
        const row =
          input.closest('[role="button"], label, [data-qa="cell"], [class*="magritte-card"]') ||
          input.parentElement;
        const titleEl = row?.querySelector('[data-qa="resume-title"], [data-qa="cell-text-content"]');
        const t = (titleEl?.textContent || input.getAttribute('aria-label') || '')
          .replace(/\s+/g, ' ')
          .trim();
        const val = input.value || '';
        const byHash = wantHash && val === wantHash;
        const byTitle =
          wantTitle && t.toLowerCase().includes(wantTitle.toLowerCase().slice(0, 24));
        if (!byHash && !byTitle) continue;
        input.click();
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        row?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return t || wantTitle;
      }
      return null;
    },
    { wantTitle: want, wantHash: hash }
  );
  if (ok) await page.waitForTimeout(700);
  return ok;
}

/**
 * Совместимы ли роли резюме для авто-fallback (без явного allowWrongResumeFallback).
 * devops↔infra ок; support/lead/tam — только свой трек.
 * @param {string} idealRole
 * @param {string} pickedRole
 */
export function resumeRolesCompatible(idealRole, pickedRole) {
  const a = String(idealRole || '').trim().toLowerCase();
  const b = String(pickedRole || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const infraFamily = new Set(['devops', 'infra']);
  if (infraFamily.has(a) && infraFamily.has(b)) return true;
  return false;
}

/**
 * Заголовок UI похож на support / lead — нельзя для devops|infra|tam без явного allow.
 * @param {string} title
 * @param {string} idealRole
 */
export function isCrossTrackResumeTitle(title, idealRole) {
  const role = String(idealRole || '').trim().toLowerCase();
  if (!role || !['devops', 'infra', 'tam'].includes(role)) return false;
  const t = String(title || '').toLowerCase();
  if (!t) return false;
  if (/руководитель\s+служб|рук\.?\s*поддерж/i.test(t)) return true;
  if (/специалист\s+технической\s+поддерж|поддержк[аи].*l\s*[123]/i.test(t)) return true;
  if (role !== 'tam' && /account\s+manager|tam\b/i.test(t)) return true;
  return false;
}

/**
 * Эвристика роли по заголовку резюме на форме hh (без списка radio).
 * @param {string} title
 * @returns {string}
 */
export function inferResumeRoleFromHhTitle(title) {
  const cfg = loadResumeRoutingConfig();
  const t = String(title || '').trim();
  if (!t) return '';
  let bestRole = '';
  let bestScore = 0;
  for (const [r, entry] of Object.entries(cfg.resumes || {})) {
    let score = 0;
    if (titleMatchesPreferred(t, entry.titleMatch)) score += 45;
    if (titleMatchesPreferred(t, entry.titleOnHh)) score += 40;
    if (score > bestScore) {
      bestScore = score;
      bestRole = r;
    }
  }
  if (bestScore >= 40) return bestRole;
  const low = t.toLowerCase();
  if (/руководитель\s+служб|рук\.?\s*поддерж/i.test(low)) return 'support_lead';
  if (/специалист\s+технической\s+поддерж|поддержк[аи].*l\s*[123]|инженер\s+сопровожд/i.test(low)) {
    return 'support';
  }
  if (/\bdevops\b|\bsre\b/i.test(low)) return 'devops';
  if (/системн/i.test(low)) return 'infra';
  if (/account\s+manager|\btam\b/i.test(low)) return 'tam';
  return '';
}

/**
 * Sticky DevOps при ideal infra (или наоборот) на шаге анкеты — нужен repair/STOP.
 * Семья devops↔infra остаётся в resumeRolesCompatible для раннего picker, не для submit анкеты.
 * @param {string} idealRole
 * @param {string} curTitle
 * @param {string} [guessedRole]
 * @returns {{ mismatch: boolean, reason: string }}
 */
export function questionnaireInfraFamilyStickyMismatch(idealRole, curTitle, guessedRole = '') {
  const ideal = String(idealRole || '').trim().toLowerCase();
  const title = String(curTitle || '').trim();
  const guessed = String(guessedRole || inferResumeRoleFromHhTitle(title) || '').trim().toLowerCase();
  if (!ideal || !title) return { mismatch: false, reason: '' };
  const looksDevops = guessed === 'devops' || /\bdevops\b|\bsre\b/i.test(title);
  const looksInfra =
    guessed === 'infra' || (/системн/i.test(title) && !/\bdevops\b|\bsre\b|поддержк|руководитель/i.test(title));
  if (ideal === 'infra' && looksDevops) {
    return { mismatch: true, reason: 'sticky-devops-on-infra-ideal' };
  }
  if (ideal === 'devops' && looksInfra) {
    return { mismatch: true, reason: 'sticky-infra-on-devops-ideal' };
  }
  return { mismatch: false, reason: '' };
}

/**
 * Сверка резюме на шаге анкеты работодателя (после sticky выбора).
 * Альтуэра 16.07: support/lead при ideal devops|infra.
 * Биржа 18.07: DevOps при ideal support — раньше не стопало (односторонний gate).
 * P2 20.07: sticky DevOps при ideal infra → STOP (семья только для раннего picker).
 *
 * @param {{ curTitle?: string, preferredTitle?: string, idealRole?: string }} opts
 * @returns {{ block: boolean, reason: string }}
 */
export function questionnaireStepResumeBlocksSubmit(opts = {}) {
  const curTitle = String(opts.curTitle || '').trim();
  const preferredTitle = String(opts.preferredTitle || '').trim();
  const ideal = String(opts.idealRole || '').trim().toLowerCase();
  if (!curTitle) return { block: false, reason: '' };

  const titleOk =
    (preferredTitle && titleMatchesPreferred(curTitle, preferredTitle)) ||
    (ideal === 'infra' && /системн/i.test(curTitle) && !/поддержк|руководитель|devops|sre/i.test(curTitle)) ||
    (ideal === 'devops' && /devops|sre/i.test(curTitle)) ||
    (ideal === 'support' &&
      /поддержк|l\s*[23]|сопровожд/i.test(curTitle) &&
      !/devops|sre|руководитель\s+служб/i.test(curTitle)) ||
    (ideal === 'support_lead' && /руководитель|рук\.?\s*поддерж/i.test(curTitle));

  if (titleOk) return { block: false, reason: 'title-ok' };

  const guessed = inferResumeRoleFromHhTitle(curTitle);
  const stickyFamily = questionnaireInfraFamilyStickyMismatch(ideal, curTitle, guessed);
  if (stickyFamily.mismatch) {
    return { block: true, reason: stickyFamily.reason };
  }
  if (ideal && guessed && resumeRolesCompatible(ideal, guessed)) {
    return { block: false, reason: 'compatible-family' };
  }

  // Альтуэра: L2/lead в форме при плане devops|infra|tam
  if (isCrossTrackResumeTitle(curTitle, ideal || 'devops')) {
    return { block: true, reason: 'cross-track-support-on-tech-ideal' };
  }

  // Биржа: DevOps/infra/tam в форме при плане support*
  if (['support', 'support_lead', 'tam'].includes(ideal)) {
    if (/devops|sre/i.test(curTitle) || guessed === 'devops' || guessed === 'infra') {
      return { block: true, reason: 'tech-cv-on-support-ideal' };
    }
    if (ideal === 'support' && (/руководитель\s+служб|рук\.?\s*поддерж/i.test(curTitle) || guessed === 'support_lead')) {
      return { block: true, reason: 'lead-on-support-ideal' };
    }
    if (ideal !== 'tam' && (guessed === 'tam' || /account\s+manager|\btam\b/i.test(curTitle))) {
      return { block: true, reason: 'tam-on-support-ideal' };
    }
    if (preferredTitle && guessed && !resumeRolesCompatible(ideal, guessed)) {
      return { block: true, reason: 'incompatible-guessed-role' };
    }
  }

  // Легаси: чужой support-title при tech-ideal (если isCrossTrack не сработал по роли)
  if (
    preferredTitle &&
    /поддержк|руководитель/i.test(curTitle) &&
    ['devops', 'infra', 'tam'].includes(ideal)
  ) {
    return { block: true, reason: 'legacy-support-title-mismatch' };
  }

  return { block: false, reason: '' };
}

/**
 * @param {Array<{ title: string, hash: string }>} list
 */
export function dedupeEmployerResumes(list) {
  const seen = new Set();
  return list.filter((x) => {
    const key = x.hash || x.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {{ titleOnHh?: string, titleMatch?: string, hash?: string }} entry
 * @param {{ title: string, hash: string }} item
 */
export function resumeEntryMatchesItem(entry, item) {
  if (!entry || !item) return false;
  const hash = String(entry.hash || '').trim();
  if (hash && item.hash === hash) return true;
  const match = String(entry.titleMatch || entry.titleOnHh || '').trim();
  if (match && titleMatchesPreferred(item.title, match)) return true;
  if (entry.titleOnHh && titleMatchesPreferred(item.title, entry.titleOnHh)) return true;
  return false;
}

/**
 * @param {Array<{ title: string, hash: string }>} available
 * @param {string} idealRole
 */
export function pickBestFromEmployerList(available, idealRole) {
  const cfg = loadResumeRoutingConfig();
  const role = String(idealRole || cfg.defaultRole || 'devops');
  const idealEntry = cfg.resumes[role] || cfg.resumes[cfg.defaultRole];
  const idealInList = Boolean(idealEntry && available.some((a) => resumeEntryMatchesItem(idealEntry, a)));

  /** @type {{ title: string, hash: string, role: string, label: string, score: number } | null} */
  let pick = null;
  let bestScore = 0;

  for (const item of available) {
    for (const [r, entry] of Object.entries(cfg.resumes || {})) {
      let score = 0;
      if (item.hash && entry.hash && item.hash === entry.hash) score += 60;
      if (titleMatchesPreferred(item.title, entry.titleMatch)) score += 45;
      if (titleMatchesPreferred(item.title, entry.titleOnHh)) score += 40;
      if (r === role) score += 20;
      else if (r === cfg.defaultRole) score += 5;
      if (score > bestScore) {
        bestScore = score;
        pick = {
          title: item.title,
          hash: item.hash,
          role: r,
          label: String(entry.label || r),
          score,
        };
      }
    }
  }

  return { pick, bestScore, idealInList, idealRole: role, idealEntry };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ title: string, hash: string }} target
 */
async function currentMatchesTarget(page, target) {
  const curHash = await readCurrentResponseResumeHash(page);
  const curTitle = await readCurrentResponseResumeTitle(page);
  if (target.hash && curHash === target.hash) return true;
  if (titleMatchesPreferred(curTitle, target.title)) return true;
  return false;
}

/**
 * Единая точка выбора резюме на форме отклика.
 * @param {import('playwright').Page} page
 * @param {{
 *   idealRole?: string,
 *   preferredTitle?: string,
 *   resumeHash?: string,
 *   vacancyId?: string,
 *   log?: (msg: string) => void,
 * }} opts
 */
export async function pickAndApplyEmployerResume(page, opts = {}) {
  const log = opts.log || (() => {});
  const cfg = loadResumeRoutingConfig();
  const idealRole =
    String(opts.idealRole || '').trim() ||
    (opts.preferredTitle ? inferRoleFromTitle(opts.preferredTitle, cfg) : '') ||
    cfg.defaultRole ||
    'devops';
  const magritteOnly = opts.magritteOnly === true;

  const root = page.locator('[data-qa="vacancy-response-popup-form"], [role="dialog"], main, body').first();
  const listSelector =
    '[data-qa="resume-select-item"], label:has(input[type="radio"]), [class*="ResumeItem"], [class*="resume-item"]';
  const RESUME_LIST_BACKOFF_MS = [800, 1500];
  const t0 = Date.now();
  /** @type {ReturnType<typeof dedupeEmployerResumes>} */
  let available = [];

  if (magritteOnly) {
    available = dedupeEmployerResumes(await listMagritteResumeRadios(page));
    if (!available.length) {
      available = await openCompactResumePicker(page, log);
    }
    if (!available.length) {
      log('[hh-resume] magritteOnly: список пуст после compact — стоп (без широкого scan)');
      return {
        ok: false,
        reason: 'empty-list',
        preferred: opts.preferredTitle || '',
        availableResumes: [],
      };
    }
  } else {
    for (let attempt = 0; attempt <= RESUME_LIST_BACKOFF_MS.length; attempt++) {
      if (attempt > 0) {
        await page.waitForTimeout(RESUME_LIST_BACKOFF_MS[attempt - 1]);
      }
      await root
        .locator(listSelector)
        .first()
        .waitFor({ state: 'visible', timeout: attempt === 0 ? 8000 : 4000 })
        .catch(() => {});
      available = dedupeEmployerResumes(await listResponseFormResumes(page));
      if (available.length) break;
    }
  }

  if (!available.length) {
    const changeBtn = page.getByRole('button', { name: /изменить резюме|выбрать резюме|другое резюме/i }).first();
    if (await changeBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
      log('[hh-resume] Список пуст — «Изменить резюме»');
      await changeBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
      available = dedupeEmployerResumes(await listResponseFormResumes(page));
    }
  }

  // Compact form: одно уже выбранное резюме без radio-списка (data-qa=resume-title).
  // Важно: не считать «поддержк*» ок для devops — иначе уходит L2/lead вместо DevOps (Ригла 16.07).
  if (!available.length) {
    const idealEntry = cfg.resumes?.[idealRole] || cfg.resumes?.[cfg.defaultRole];
    const curHash = await readCurrentResponseResumeHash(page);
    const curTitle = await readCurrentResponseResumeTitle(page);
    const wantHash = String(opts.resumeHash || idealEntry?.hash || '').trim();
    const wantTitle = String(
      opts.preferredTitle || idealEntry?.titleOnHh || idealEntry?.titleMatch || ''
    ).trim();
    const hashMatched = Boolean(wantHash && curHash && curHash === wantHash);
    const titleMatched = Boolean(
      (wantTitle && titleMatchesPreferred(curTitle, wantTitle)) ||
        (idealEntry &&
          curTitle &&
          resumeEntryMatchesItem(idealEntry, { title: curTitle, hash: '' }))
    );
    // Hash из URL часто не совпадает с тем, что видно в UI (Ригла: hash DevOps + title L2).
    const matchesIdeal = titleMatched || (hashMatched && !curTitle);
    if (hashMatched && curTitle && !titleMatched) {
      log(
        `[hh-resume] Compact: hash совпал, но в UI «${curTitle}» ≠ «${wantTitle || idealRole}» — открываем список`
      );
    }

    if (matchesIdeal) {
      log(`[hh-resume] Compact: уже выбрано «${curTitle}» (без radio-списка)`);
      return {
        ok: true,
        title: curTitle,
        hash: curHash || wantHash || undefined,
        preferred: wantTitle || curTitle,
        idealRole,
        pickedRole: 'compact-preselected',
        availableResumes: [],
      };
    }

    if (curTitle || hashMatched) {
      log(
        `[hh-resume] Compact: в UI «${curTitle || '—'}» ≠ «${wantTitle || idealRole}» — открываем список всех резюме`
      );
      available = await openCompactResumePicker(page, log);
      if (!available.length) {
        available = dedupeEmployerResumes(await listMagritteResumeRadios(page));
      }
      if (!available.length) {
        available = dedupeEmployerResumes(await listResponseFormResumes(page));
      }
    }

    if (!available.length && wantHash && opts.vacancyId) {
      log('[hh-resume] Список пуст — reload формы с resumeId из routing');
      await reloadVacancyResponseWithResume(page, {
        vacancyId: opts.vacancyId,
        resumeHash: wantHash,
        log,
      });
      available = dedupeEmployerResumes(await listResponseFormResumes(page));
      if (!available.length) {
        available = dedupeEmployerResumes(await listMagritteResumeRadios(page));
      }
      if (!available.length) {
        const afterHash = await readCurrentResponseResumeHash(page);
        const afterTitle = await readCurrentResponseResumeTitle(page);
        // URL/hash часто «залипает», а в UI другое резюме (Ригла 16.07: hash DevOps + title L2).
        // Принимаем reload только если title совпал с ideal / wantTitle.
        const titleMatched =
          (wantTitle && titleMatchesPreferred(afterTitle, wantTitle)) ||
          (idealEntry &&
            resumeEntryMatchesItem(idealEntry, {
              title: afterTitle || '',
              hash: afterHash || '',
            }));
        if (titleMatched) {
          log(`[hh-resume] Compact после reload: «${afterTitle}»`);
          return {
            ok: true,
            title: afterTitle,
            hash: afterHash || wantHash,
            preferred: wantTitle || afterTitle,
            idealRole,
            pickedRole: 'compact-reload',
            availableResumes: [],
          };
        }
        if (afterHash === wantHash && afterTitle) {
          log(
            `[hh-resume] Compact после reload: hash ok, но UI «${afterTitle}» ≠ «${wantTitle || idealRole}» — продолжаем открывать список`
          );
        }
      }
    }
  }

  if (available.length) {
    const sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
    log(`[hh-resume] список загружен за ${sec} с (${available.length} резюме)`);
    if (sec > 45) {
      log(`[hh-resume] ⚠ медленная загрузка списка (${sec} с) — проверьте сеть hh.ru`);
    }
  }

  if (!available.length) {
    log('[hh-resume] Список резюме на форме пуст — дождитесь загрузки или откройте «Изменить резюме»');
    return {
      ok: false,
      reason: 'empty-list',
      preferred: opts.preferredTitle || '',
      availableResumes: [],
    };
  }

  const names = available.map((a) => a.title || a.hash.slice(0, 8)).join(' · ');
  log(`[hh-resume] hh.ru предлагает (${available.length}): ${names}`);

  const decision = pickBestFromEmployerList(available, idealRole);
  const minScore = decision.idealInList ? MIN_SCORE : MIN_FALLBACK_SCORE;

  if (!decision.pick || decision.bestScore < minScore) {
    const idealLabel = decision.idealEntry?.titleOnHh || decision.idealRole;
    if (available.length === 1 && available[0].title) {
      const only = available[0];
      const onlyRoleGuess =
        inferRoleFromTitle(only.title, cfg) ||
        (isCrossTrackResumeTitle(only.title, decision.idealRole) ? 'support_lead' : '');
      const cross =
        isCrossTrackResumeTitle(only.title, decision.idealRole) ||
        !resumeRolesCompatible(decision.idealRole, onlyRoleGuess || 'unknown');
      if (cross && !opts.allowWrongResumeFallback) {
        log(
          `[hh-resume] STOP: для «${idealLabel}» hh показывает только «${only.title}» (cross-track). ` +
            'Отправка запрещена — иначе дубль с чужим CV (Альтуэра 16.07).'
        );
        return {
          ok: false,
          reason: 'wrong-resume-only',
          notInEmployerList: true,
          wrongResume: true,
          title: only.title,
          hash: only.hash,
          preferred: idealLabel,
          idealRole: decision.idealRole,
          pickedRole: 'fallback-single-blocked',
          availableResumes: available,
        };
      }
      log(
        `[hh-resume] «${idealLabel}» недоступно — для вакансии единственное резюме на hh.ru: «${only.title}»`
      );
      const picked = await selectResumeRadioFromList(page, only.title, only.hash);
      if (picked || (await currentMatchesTarget(page, only))) {
        return {
          ok: true,
          title: only.title,
          hash: only.hash,
          preferred: idealLabel,
          idealRole: decision.idealRole,
          pickedRole: 'fallback-single',
          fallbackUsed: true,
          availableResumes: available,
        };
      }
    }
    log(
      `[hh-resume] Для вакансии нужно «${idealLabel}», но в списке hh.ru нет подходящего резюме. ` +
        'Пропуск или отклик вручную другим CV.'
    );
    return {
      ok: false,
      notInEmployerList: true,
      title: await readCurrentResponseResumeTitle(page),
      hash: await readCurrentResponseResumeHash(page),
      preferred: decision.idealEntry?.titleOnHh || '',
      idealRole: decision.idealRole,
      availableResumes: available,
    };
  }

  const target = decision.pick;
  const idealLabel = decision.idealEntry?.titleOnHh || decision.idealRole;

  if (
    !decision.idealInList &&
    target.role !== decision.idealRole &&
    !resumeRolesCompatible(decision.idealRole, target.role) &&
    !opts.allowWrongResumeFallback
  ) {
    log(
      `[hh-resume] STOP: «${idealLabel}» нет в списке; ближайшее «${target.title}» (${target.role}) — cross-track, не отправляем`
    );
    return {
      ok: false,
      reason: 'wrong-resume-fallback',
      notInEmployerList: true,
      wrongResume: true,
      title: target.title,
      hash: target.hash,
      preferred: idealLabel,
      idealRole: decision.idealRole,
      pickedRole: target.role,
      availableResumes: available,
    };
  }

  if (!decision.idealInList && target.role !== decision.idealRole) {
    log(
      `[hh-resume] «${idealLabel}» недоступно для этой вакансии на hh.ru → ` +
        `берём из списка: «${target.title}» (${target.label})`
    );
  } else if (!decision.idealInList) {
    log(`[hh-resume] Точного «${idealLabel}» нет; ближайшее в списке: «${target.title}»`);
  }

  if (!(await currentMatchesTarget(page, target))) {
    let picked = await selectResumeRadioFromList(page, target.title, target.hash);
    if (!picked) {
      picked = await selectMagritteResumeByTitle(page, target.title, target.hash);
    }
    // Magritte: клик по видимому тексту названия резюме в списке
    if (!picked && target.title) {
      const byText = page
        .locator('[data-qa="resume-title"], [role="radio"], label')
        .filter({ hasText: new RegExp(target.title.slice(0, 18).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
        .first();
      if (await byText.isVisible({ timeout: 1500 }).catch(() => false)) {
        await byText.click({ force: true });
        await page.waitForTimeout(700);
        picked = await readCurrentResponseResumeTitle(page);
        log(`[hh-resume] Клик по тексту «${target.title}» → «${picked}»`);
      }
    }
    if (!picked) {
      log(`[hh-resume] Не удалось нажать radio для «${target.title}»`);
    }
  }

  let afterTitle = await readCurrentResponseResumeTitle(page);
  let afterHash = await readCurrentResponseResumeHash(page);
  let ok =
    (await currentMatchesTarget(page, target)) ||
    (target.hash && afterHash === target.hash) ||
    (target.title && titleMatchesPreferred(afterTitle, target.title));

  const tryReloadWithHash = async () => {
    if (!opts.vacancyId || !target.hash) return false;
    await reloadVacancyResponseWithResume(page, {
      vacancyId: opts.vacancyId,
      resumeHash: target.hash,
      log,
    });
    available = dedupeEmployerResumes(await listResponseFormResumes(page));
    await selectResumeRadioFromList(page, target.title, target.hash);
    afterTitle = await readCurrentResponseResumeTitle(page);
    afterHash = await readCurrentResponseResumeHash(page);
    return (
      (await currentMatchesTarget(page, target)) ||
      (target.hash && afterHash === target.hash) ||
      titleMatchesPreferred(afterTitle, target.title)
    );
  };

  if (!ok && opts.vacancyId && target.hash) {
    ok = await tryReloadWithHash();
  }

  if (!ok) {
    const legacy = await selectProfileResumeInResponseModal(page, {
      preferredTitle: target.title,
      resumeHash: target.hash,
      forceReselect: true,
    });
    afterTitle = await readCurrentResponseResumeTitle(page);
    afterHash = await readCurrentResponseResumeHash(page);
    if (legacy && titleMatchesPreferred(legacy, target.title)) ok = true;
    if (!ok && target.hash && afterHash === target.hash) ok = true;
  }

  if (!ok && opts.vacancyId && target.hash) {
    ok = await tryReloadWithHash();
  }

  if (ok) {
    const urlMu = page.url().match(/[?&]resumeId=([a-f0-9]{16,})/i);
    const urlHash = urlMu?.[1] || '';
    if (opts.vacancyId && target.hash && urlHash && urlHash !== target.hash) {
      log(
        `[hh-resume] URL resumeId (${urlHash.slice(0, 8)}…) ≠ выбранное (${target.hash.slice(0, 8)}…) — перезагрузка формы`
      );
      await reloadVacancyResponseWithResume(page, {
        vacancyId: opts.vacancyId,
        resumeHash: target.hash,
        log,
      });
      afterHash = target.hash;
    }
    log(`[hh-resume] В форме: «${afterTitle || target.title}» (${target.label}, role=${target.role})`);
    return {
      ok: true,
      title: afterTitle || target.title,
      hash: afterHash || target.hash,
      preferred: idealLabel,
      idealRole: decision.idealRole,
      pickedRole: target.role,
      fallbackUsed: !decision.idealInList,
      availableResumes: available,
    };
  }

  log(
    `[hh-resume] После выбора в форме: «${afterTitle || '—'}», нужно было «${target.title}». ` +
      'Проверьте hash в config/resume-routing.json (npm run devops:list-resumes).'
  );
  return {
    ok: false,
    title: afterTitle,
    hash: afterHash,
    preferred: idealLabel,
    idealRole: decision.idealRole,
    pickedRole: target.role,
    resumeMismatch: true,
    notInEmployerList: !available.some((a) => resumeEntryMatchesItem(decision.idealEntry, a)),
    availableResumes: available,
  };
}

/**
 * @param {string} preferredTitle
 * @param {ReturnType<typeof loadResumeRoutingConfig>} cfg
 */
function inferRoleFromTitle(preferredTitle, cfg) {
  const t = String(preferredTitle || '').toLowerCase();
  for (const [role, entry] of Object.entries(cfg.resumes || {})) {
    if (titleMatchesPreferred(t, entry.titleMatch) || titleMatchesPreferred(t, entry.titleOnHh)) {
      return role;
    }
  }
  return cfg.defaultRole || 'devops';
}
