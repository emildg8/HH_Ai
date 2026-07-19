/**
 * Видимость резюме на hh.ru (скрыть из поиска).
 */

import { listApplicantResumes } from './hh-resume-editor.mjs';
import { RESUME_LIST_URL } from './hh-resume-selectors.mjs';

const HIDDEN_HINT = /не\s+видно\s+никому|скрыт[оа]?\s*(из\s+поиска)?|доступно\s+только\s+по\s+прямой\s+ссылке/i;
const VISIBLE_HINT = /видно\s+всем\s+работодателям|видно\s+в\s+поиске/i;
/** Magritte 07.2026: qa=clients = «всем работодателям… на hh.ru»; старый текст «компаниям-клиентам». */
const HH_CLIENTS_HINT =
  /видно\s+компаниям[-\s]*клиентам|видно\s+работодателям[-\s]*клиентам|видно\s+всем\s+работодателям,\s*зарегистрированным\s+на\s+hh\.ru/i;

/**
 * @param {import('playwright').Page} page
 */
async function clickSaveIfVisible(page) {
  const save = page
    .getByRole('button', { name: /^(сохранить|подтвердить|готово|да|ок)$/i })
    .first();
  if (await save.isVisible({ timeout: 2500 }).catch(() => false)) {
    await save.click({ force: true });
    await page.waitForTimeout(1800);
    return true;
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} hash
 * @param {{ log?: (msg: string) => void }} [opts]
 */
export async function hideResumeFromSearch(page, hash, opts = {}) {
  const log = opts.log || ((m) => console.log(m));
  const h = String(hash || '').trim();
  if (!h) throw new Error('hideResumeFromSearch: пустой hash');

  await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const card = page
    .locator('[data-qa="resume"]')
    .filter({ has: page.locator(`a[href*="/resume/${h}"], [data-qa="resume-card-link-${h}"]`) })
    .first();

  if (!(await card.isVisible({ timeout: 4000 }).catch(() => false))) {
    return { ok: false, reason: 'not-found', message: `Карточка ${h.slice(0, 8)}… не на странице` };
  }

  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);

  const cardText = ((await card.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
  if (HIDDEN_HINT.test(cardText) && !VISIBLE_HINT.test(cardText)) {
    return { ok: true, already: true, message: 'Уже скрыто из поиска' };
  }

  const menuBtn = card.locator('[data-qa="resume-list-action-more"]').first();
  if (!(await menuBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
    return { ok: false, reason: 'menu-not-found', message: 'Кнопка «⋯» на карточке не найдена' };
  }

  log(`[resume-visibility] Меню карточки: ${h.slice(0, 8)}…`);
  await menuBtn.click({ force: true });
  await page.waitForTimeout(1100);

  const changeVisibility = page
    .getByRole('menuitem', { name: /изменить\s+видимость/i })
    .or(page.locator('[data-qa*="resume-list-action"]').filter({ hasText: /изменить\s+видимость/i }))
    .or(page.locator('button, a, [role="menuitem"]').filter({ hasText: /^изменить\s+видимость$/i }))
    .first();

  if (!(await changeVisibility.isVisible({ timeout: 3000 }).catch(() => false))) {
    const menuDump = await page.evaluate(() =>
      [...document.querySelectorAll('[role="menuitem"], [data-qa*="resume-list-action"], button, a')]
        .map((el) => ({
          qa: el.getAttribute('data-qa'),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        }))
        .filter((x) => x.text.length > 2)
        .slice(0, 25)
    );
    return {
      ok: false,
      reason: 'visibility-menu-not-found',
      message: 'Пункт «Изменить видимость» не найден',
      menuDump,
    };
  }

  await changeVisibility.click({ force: true });
  await page.waitForTimeout(1400);

  const hideOption = page
    .getByRole('radio', { name: /не\s+видно\s+никому/i })
    .or(page.getByLabel(/не\s+видно\s+никому/i))
    .or(page.locator('label, [role="radio"], button, div').filter({ hasText: /не\s+видно\s+никому/i }))
    .first();

  if (await hideOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await hideOption.click({ force: true });
    await page.waitForTimeout(700);
  } else {
    const hideBtn = page
      .getByRole('button', { name: /просто\s+скрыть\s+от\s+всех|скрыть\s+от\s+всех/i })
      .or(page.locator('button, a').filter({ hasText: /просто\s+скрыть\s+от\s+всех|скрыть\s+от\s+всех/i }))
      .first();
    if (await hideBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await hideBtn.click({ force: true });
      await page.waitForTimeout(1200);
    } else {
      return { ok: false, reason: 'hide-option-not-found', message: 'Вариант «Не видно никому» не найден' };
    }
  }

  await clickSaveIfVisible(page);

  await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1200);
  const listed = await listApplicantResumes(page);
  const row = listed.find((r) => r.hash === h);
  return { ok: true, method: 'change-visibility', title: row?.title || '' };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} hash
 * @param {string} verifyVacancyId
 */
async function verifyClientsVisibilityOnResponseForm(page, hash, verifyVacancyId) {
  const vid = String(verifyVacancyId || '').trim();
  const h = String(hash || '').trim();
  if (!vid || !h) return null;
  const verifyUrl = `https://hh.ru/applicant/vacancy_response?vacancyId=${encodeURIComponent(vid)}&resumeId=${encodeURIComponent(h)}&hhtmFrom=vacancy`;
  await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(2500);
  return detectResumeVisibilityBlockOnResponseForm(page);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} hash
 * @param {{ log?: (msg: string) => void, verifyVacancyId?: string }} [opts]
 */
async function showResumeVisibleToHhClientsViaEditPage(page, hash, opts = {}) {
  const log = opts.log || ((m) => console.log(m));
  await page.goto(`https://hh.ru/resume/${hash}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1500);

  const body = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
  if (HH_CLIENTS_HINT.test(body)) {
    const verifyVid = String(opts.verifyVacancyId || process.env.HH_VERIFY_VACANCY_ID || '').trim();
    if (verifyVid) {
      const formBlock = await verifyClientsVisibilityOnResponseForm(page, hash, verifyVid);
      if (formBlock?.blocked) {
        return {
          ok: false,
          already: true,
          reason: 'false_positive_already',
          message:
            'Страница резюме говорит «клиентам HH», но форма отклика всё ещё требует сменить видимость (Magritte)',
          formBlock,
        };
      }
    }
    return { ok: true, already: true, message: 'Уже видно компаниям-клиентам HH' };
  }

  const visBtn = page
    .getByRole('button', { name: /видимост/i })
    .or(page.locator('button, a').filter({ hasText: /изменить\s+видимость|настройки\s+видимости|видимость\s+резюме/i }))
    .or(page.locator('[data-qa*="visibility"]'))
    .first();
  if (await visBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    log(`[resume-visibility] Страница резюме → видимость: ${hash.slice(0, 8)}…`);
    await visBtn.click({ force: true });
    await page.waitForTimeout(1200);
  } else {
    const more = page.locator('[data-qa="resume-list-action-more"], [data-qa*="action-more"]').first();
    if (await more.isVisible({ timeout: 2000 }).catch(() => false)) {
      await more.click({ force: true });
      await page.waitForTimeout(900);
      const changeVis = page
        .getByRole('menuitem', { name: /изменить\s+видимость/i })
        .or(page.locator('button, a, [role="menuitem"]').filter({ hasText: /изменить\s+видимость/i }))
        .first();
      if (await changeVis.isVisible({ timeout: 2000 }).catch(() => false)) {
        await changeVis.click({ force: true });
        await page.waitForTimeout(1200);
      }
    }
  }

  const hhClientsOption = page
    .getByRole('radio', { name: /компаниям[-\s]*клиентам/i })
    .or(page.getByLabel(/компаниям[-\s]*клиентам/i))
    .or(page.locator('label, [role="radio"], button, div').filter({ hasText: /компаниям[-\s]*клиентам/i }))
    .first();
  if (await hhClientsOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await hhClientsOption.click({ force: true });
    await page.waitForTimeout(700);
  } else {
    const visibleAll = page
      .getByRole('radio', { name: /видно\s+всем\s+работодателям|видно\s+в\s+поиске/i })
      .or(page.locator('label, [role="radio"], button, div').filter({ hasText: /видно\s+всем\s+работодателям|видно\s+в\s+поиске/i }))
      .first();
    if (await visibleAll.isVisible({ timeout: 2500 }).catch(() => false)) {
      await visibleAll.click({ force: true });
      await page.waitForTimeout(700);
    } else {
      return {
        ok: false,
        reason: 'hh-clients-option-not-found',
        message: 'Вариант видимости на странице резюме не найден',
      };
    }
  }

  await clickSaveIfVisible(page);

  if (opts.verifyVacancyId) {
    const verifyUrl = `https://hh.ru/applicant/vacancy_response?vacancyId=${opts.verifyVacancyId}&resumeId=${hash}&hhtmFrom=vacancy`;
    await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2000);
    const bodyAfter = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    const submitDisabled = await page
      .locator('[data-qa="vacancy-response-submit-popup"]')
      .isDisabled()
      .catch(() => true);
    if (/поменяйте видимость резюме/i.test(bodyAfter) || submitDisabled) {
      const options = await page.evaluate(() =>
        [...document.querySelectorAll('label, [role="radio"], button')]
          .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
          .filter((t) => t.length > 3 && /видно|скрыт|компаниям/i.test(t))
          .slice(0, 12)
      );
      return {
        ok: false,
        reason: 'verify-failed',
        message: 'После смены видимости форма отклика всё ещё блокирует отправку',
        submitDisabled,
        options,
      };
    }
  }

  return { ok: true, method: 'resume-edit-page', title: hash.slice(0, 8) };
}

/**
 * Видимость «Видно компаниям-клиентам HeadHunter» — нужна для части вакансий на отклик.
 * @param {import('playwright').Page} page
 * @param {string} hash
 * @param {{ log?: (msg: string) => void }} [opts]
 */
export async function showResumeVisibleToHhClients(page, hash, opts = {}) {
  const log = opts.log || ((m) => console.log(m));
  const h = String(hash || '').trim();
  if (!h) throw new Error('showResumeVisibleToHhClients: пустой hash');

  await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const card = page
    .locator('[data-qa="resume"]')
    .filter({ has: page.locator(`a[href*="/resume/${h}"], [data-qa="resume-card-link-${h}"]`) })
    .first();

  if (!(await card.isVisible({ timeout: 4000 }).catch(() => false))) {
    return { ok: false, reason: 'not-found', message: `Карточка ${h.slice(0, 8)}… не на странице` };
  }

  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);

  const cardText = ((await card.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
  if (HH_CLIENTS_HINT.test(cardText)) {
    const verifyVid = String(opts.verifyVacancyId || process.env.HH_VERIFY_VACANCY_ID || '').trim();
    if (verifyVid) {
      const formBlock = await verifyClientsVisibilityOnResponseForm(page, h, verifyVid);
      if (formBlock?.blocked) {
        return {
          ok: false,
          already: true,
          reason: 'false_positive_already',
          message:
            'Список резюме говорит «клиентам HH», но форма отклика всё ещё требует сменить видимость (Magritte)',
          formBlock,
        };
      }
    }
    return { ok: true, already: true, message: 'Уже видно компаниям-клиентам HH' };
  }

  const menuBtn = card.locator('[data-qa="resume-list-action-more"]').first();
  if (!(await menuBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
    return showResumeVisibleToHhClientsViaEditPage(page, h, opts);
  }

  log(`[resume-visibility] Включаю видимость HH-клиентам: ${h.slice(0, 8)}…`);
  await menuBtn.click({ force: true });
  await page.waitForTimeout(1100);

  const changeVisibility = page
    .getByRole('menuitem', { name: /изменить\s+видимость/i })
    .or(page.locator('[data-qa*="resume-list-action"]').filter({ hasText: /изменить\s+видимость/i }))
    .or(page.locator('button, a, [role="menuitem"]').filter({ hasText: /^изменить\s+видимость$/i }))
    .first();

  if (!(await changeVisibility.isVisible({ timeout: 3000 }).catch(() => false))) {
    return { ok: false, reason: 'visibility-menu-not-found', message: 'Пункт «Изменить видимость» не найден' };
  }

  await changeVisibility.click({ force: true });
  await page.waitForTimeout(1400);

  // Magritte: qa=clients (= «всем работодателям… на hh.ru»), не старый текст «компаниям-клиентам».
  const hhClientsOption = page
    .locator('[data-qa="resume-visibility-card-access-type-clients"]')
    .or(page.getByRole('radio', { name: /компаниям[-\s]*клиентам|всем\s+работодателям,\s*зарегистрированным/i }))
    .or(
      page
        .locator('label, [role="radio"], button, div')
        .filter({ hasText: /компаниям[-\s]*клиентам|всем\s+работодателям,\s*зарегистрированным\s+на\s+hh\.ru/i })
    )
    .first();

  if (await hhClientsOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await hhClientsOption.click({ force: true });
    await page.waitForTimeout(700);
  } else {
    return {
      ok: false,
      reason: 'hh-clients-option-not-found',
      message: 'Вариант visibility clients (data-qa) не найден',
    };
  }

  await clickSaveIfVisible(page);

  await page.goto(RESUME_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1200);
  const listed = await listApplicantResumes(page);
  const row = listed.find((r) => r.hash === h);
  const verifyVid = String(opts.verifyVacancyId || process.env.HH_VERIFY_VACANCY_ID || '').trim();
  if (verifyVid) {
    const formBlock = await verifyClientsVisibilityOnResponseForm(page, h, verifyVid);
    if (formBlock?.blocked) {
      return {
        ok: false,
        method: 'show-hh-clients',
        reason: 'verify-failed',
        message:
          'После смены видимости форма отклика всё ещё требует «компаниям-клиентам HH» (Magritte)',
        formBlock,
        title: row?.title || '',
      };
    }
  }
  return { ok: true, method: 'show-hh-clients', title: row?.title || '' };
}

/**
 * На /vacancy_response: баннер «поменяйте видимость резюме…».
 * @param {import('playwright').Page} page
 */
export async function detectResumeVisibilityBlockOnResponseForm(page) {
  const url = String(page.url() || '');
  if (!/vacancy_response/i.test(url)) return null;
  const blob = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
  if (!/поменяйте\s+видимост/i.test(blob) && !/видимост\w*\s+резюме\s+на\s+[«"]?Видно\s+компаниям/i.test(blob)) {
    return null;
  }
  return {
    blocked: true,
    reason: 'resume_visibility',
    message: 'На форме требуется видимость «Видно компаниям-клиентам HeadHunter»',
  };
}
