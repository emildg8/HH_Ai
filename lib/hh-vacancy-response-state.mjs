/**
 * Статус отклика на странице вакансии hh.ru (до повторного отклика).
 * invited / declined / already_applied — батч и авто-отклик пропускают.
 */

/** @typedef {'none' | 'already_applied' | 'invited' | 'declined' | 'archived' | 'unavailable' | 'viewed' | 'awaiting'} HhSiteState */

export const HH_SITE_STATES = {
  NONE: 'none',
  ALREADY_APPLIED: 'already_applied',
  INVITED: 'invited',
  DECLINED: 'declined',
  ARCHIVED: 'archived',
  UNAVAILABLE: 'unavailable',
  VIEWED: 'viewed',
  AWAITING: 'awaiting',
};

const BLOCKS_APPLY = new Set([
  HH_SITE_STATES.ALREADY_APPLIED,
  HH_SITE_STATES.INVITED,
  HH_SITE_STATES.DECLINED,
  HH_SITE_STATES.ARCHIVED,
  HH_SITE_STATES.UNAVAILABLE,
]);

/**
 * @param {string} [state]
 */
export function hhSiteStateBlocksApply(state) {
  return BLOCKS_APPLY.has(String(state || ''));
}

/**
 * @param {string} [state]
 */
export function hhSiteStateLabel(state) {
  switch (state) {
    case HH_SITE_STATES.INVITED:
      return 'Приглашение на hh.ru';
    case HH_SITE_STATES.DECLINED:
      return 'Отказ на hh.ru';
    case HH_SITE_STATES.ALREADY_APPLIED:
      return 'Отклик уже отправлен на hh.ru';
    case HH_SITE_STATES.ARCHIVED:
      return 'Вакансия в архиве';
    case HH_SITE_STATES.UNAVAILABLE:
      return 'Отклик недоступен';
    case HH_SITE_STATES.VIEWED:
    case 'viewed':
      return 'Резюме просмотрели';
    case HH_SITE_STATES.AWAITING:
    case 'awaiting':
      return 'Ждём ответа работодателя';
    default:
      return '';
  }
}

/**
 * @param {string} [state]
 */
export function hhSiteStateSkipReason(state) {
  switch (state) {
    case HH_SITE_STATES.INVITED:
      return 'приглашение на hh.ru';
    case HH_SITE_STATES.DECLINED:
      return 'отказ на hh.ru';
    case HH_SITE_STATES.ALREADY_APPLIED:
      return 'уже отклик на hh.ru';
    case HH_SITE_STATES.ARCHIVED:
      return 'вакансия в архиве';
    case HH_SITE_STATES.UNAVAILABLE:
      return 'отклик недоступен на hh.ru';
    default:
      return 'статус hh.ru: повторный отклик не нужен';
  }
}

/**
 * @param {import('playwright').Page} page
 */
async function bodyText(page) {
  return ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
}

/**
 * @param {import('playwright').Page} page
 * @param {RegExp[]} patterns
 */
async function textVisible(page, patterns) {
  for (const re of patterns) {
    const el = page.getByText(re).first();
    if (await el.isVisible({ timeout: 400 }).catch(() => false)) return true;
  }
  const blob = (await bodyText(page)).toLowerCase();
  return patterns.some((re) => re.test(blob));
}

/**
 * Прочитать баннер / статус на странице вакансии (не на форме vacancy_response).
 * @param {import('playwright').Page} page
 * @returns {Promise<{ state: HhSiteState, label: string, canApply: boolean, source?: string }>}
 */
/**
 * Страница /applicant/vacancy_response после отправки отклика (не мастер нового отклика).
 * @param {import('playwright').Page} page
 */
async function detectResponsePageAlreadyApplied(page) {
  if (!/applicant\/vacancy_response/i.test(page.url())) return null;

  if (
    await textVisible(page, [
      /вы откликнулись/i,
      /вы уже откликнулись/i,
      /ваш отклик отправлен/i,
      /отклик отправлен/i,
      /отклик доставлен/i,
      /жд[её]м ответа работодателя/i,
    ])
  ) {
    return {
      state: HH_SITE_STATES.ALREADY_APPLIED,
      label: hhSiteStateLabel(HH_SITE_STATES.ALREADY_APPLIED),
      canApply: false,
      source: 'response-page-applied',
    };
  }

  const goVacancy = page.getByRole('link', { name: /перейти к вакансии/i }).first();
  const submitBtn = page.getByRole('button', { name: /отправить отклик/i }).first();
  const hasGoVacancy = await goVacancy.isVisible({ timeout: 400 }).catch(() => false);
  const hasSubmit = await submitBtn.isVisible({ timeout: 400 }).catch(() => false);
  if (hasGoVacancy && !hasSubmit) {
    return {
      state: HH_SITE_STATES.ALREADY_APPLIED,
      label: hhSiteStateLabel(HH_SITE_STATES.ALREADY_APPLIED),
      canApply: false,
      source: 'response-page-go-vacancy',
    };
  }

  return null;
}

export async function detectHhVacancySiteState(page) {
  const onResponseApplied = await detectResponsePageAlreadyApplied(page);
  if (onResponseApplied) return onResponseApplied;

  if (
    await textVisible(page, [
      /вакансия в архиве/i,
      /вакансия снята/i,
      /снята с публикации/i,
      /больше не актуальн/i,
      /вакансия не найдена/i,
    ])
  ) {
    return {
      state: HH_SITE_STATES.ARCHIVED,
      label: hhSiteStateLabel(HH_SITE_STATES.ARCHIVED),
      canApply: false,
      source: 'archived',
    };
  }

  if (
    await textVisible(page, [
      /вы приглашены/i,
      /приглашение от работодателя/i,
      /приглашение на собеседование/i,
      /вас пригласили/i,
      /получено приглашение/i,
      /жд[её]м вашего решения/i,
    ])
  ) {
    return {
      state: HH_SITE_STATES.INVITED,
      label: hhSiteStateLabel(HH_SITE_STATES.INVITED),
      canApply: false,
      source: 'invited-banner',
    };
  }

  if (
    await textVisible(page, [
      /вам отказали/i,
      /отказ работодателя/i,
      /работодатель отклонил/i,
      /не готовы продолжить/i,
      /к сожалению.*отказ/i,
      /отклонил ваш отклик/i,
      /отклонила ваш отклик/i,
      /не подходит.*отклик/i,
      /отказ по вакансии/i,
    ])
  ) {
    return {
      state: HH_SITE_STATES.DECLINED,
      label: hhSiteStateLabel(HH_SITE_STATES.DECLINED),
      canApply: false,
      source: 'declined-banner',
    };
  }

  const appliedHints = [
    page.getByText(/вы уже откликнулись|откликнулись на вакансию|ваш отклик отправлен|отклик отправлен/i),
    page.getByText(/жд[её]м ответа работодателя|отклик доставлен|вы откликнулись/i),
    page.getByRole('button', { name: /вы откликнулись|отклик отправлен/i }),
    page.locator('[data-qa="vacancy-response-link-top"][disabled], [data-qa="vacancy-response-link"][disabled]'),
    page.getByRole('link', { name: /перейти в переписку|отклик и переписка/i }),
  ];

  for (const h of appliedHints) {
    if (await h.first().isVisible({ timeout: 350 }).catch(() => false)) {
      return {
        state: HH_SITE_STATES.ALREADY_APPLIED,
        label: hhSiteStateLabel(HH_SITE_STATES.ALREADY_APPLIED),
        canApply: false,
        source: 'already-applied-ui',
      };
    }
  }

  const responseBtn = page
    .locator('a[data-qa="vacancy-response-link-top"], a[data-qa="vacancy-response-link"], button[data-qa="vacancy-response-link-top"]')
    .first();
  if (await responseBtn.isVisible({ timeout: 400 }).catch(() => false)) {
    if (await responseBtn.isDisabled().catch(() => false)) {
      return {
        state: HH_SITE_STATES.ALREADY_APPLIED,
        label: hhSiteStateLabel(HH_SITE_STATES.ALREADY_APPLIED),
        canApply: false,
        source: 'response-button-disabled',
      };
    }
  } else if (
    await textVisible(page, [/откликнуться недоступен/i, /нельзя откликнуться/i, /отклик закрыт/i])
  ) {
    return {
      state: HH_SITE_STATES.UNAVAILABLE,
      label: hhSiteStateLabel(HH_SITE_STATES.UNAVAILABLE),
      canApply: false,
      source: 'no-response-button',
    };
  }

  return { state: HH_SITE_STATES.NONE, label: '', canApply: true, source: 'ok' };
}

/**
 * @param {object} [prevHh]
 * @param {{ state: string, label?: string, source?: string }} detection
 */
export function buildHhApplySiteStatePatch(prevHh = {}, detection) {
  const state = String(detection.state || HH_SITE_STATES.NONE);
  const label = String(detection.label || hhSiteStateLabel(state)).trim();
  const patch = {
    ...prevHh,
    hhSiteState: state,
    hhSiteStateAt: new Date().toISOString(),
    hhSiteStateLabel: label || undefined,
    hhSiteStateSource: detection.source || undefined,
  };
  if (state === HH_SITE_STATES.ALREADY_APPLIED && !prevHh.responseSubmitted) {
    patch.responseSubmitted = true;
    patch.hhDetectedOnly = true;
  }
  return patch;
}
