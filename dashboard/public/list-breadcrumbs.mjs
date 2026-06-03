/**
 * Хлебные крошки контекста списка вакансий.
 */

/** @type {Record<string, string>} */
const VIEW_LABELS = {
  queue: 'Очередь',
  noQuestionnaire: 'Без анкет',
  questionnaire: 'Анкета',
  applied: 'Отклики',
  hidden: 'Скрытые',
  deferred: 'Отложенные',
};

/** @type {Record<string, string>} */
const STATUS_LABELS = {
  pending: 'На проверке',
  approved: 'Подходят',
  rejected: 'Отклонены',
};

/** @type {Record<string, string>} */
const FUNNEL_LABELS = {
  all: 'Все',
  invited: 'Приглашения',
  viewed: 'Просмотр',
  awaiting: 'Ждём',
  stale: '7+ дней',
  declined: 'Отказы',
};

/** @type {Record<string, string>} */
const REJECTED_SOURCE_LABELS = {
  all: 'Все',
  auto: 'Авто',
  manual: 'Вручную',
};

/**
 * @param {{
 *   applyView: string,
 *   scoreBand: string,
 *   status: string,
 *   count: number,
 *   total?: number,
 *   threshold?: number,
 *   appliedFunnel?: string,
 *   rejectedSource?: string,
 *   hasLocalFilter?: boolean,
 * }} ctx
 * @returns {Array<{ label: string, current?: boolean }>}
 */
export function buildListBreadcrumbItems(ctx) {
  const items = [{ label: VIEW_LABELS[ctx.applyView] || ctx.applyView }];

  if (ctx.applyView === 'queue' || ctx.applyView === 'noQuestionnaire') {
    const t = Number(ctx.threshold) || 50;
    if (ctx.scoreBand === 'high') items.push({ label: `Авто ≥${t}` });
    else if (ctx.scoreBand === 'low') items.push({ label: `Ручной <${t}` });
    else items.push({ label: 'Все баллы' });
    items.push({ label: STATUS_LABELS[ctx.status] || ctx.status });
    if (ctx.status === 'rejected' && ctx.rejectedSource && ctx.rejectedSource !== 'all') {
      items.push({ label: REJECTED_SOURCE_LABELS[ctx.rejectedSource] || ctx.rejectedSource });
    }
  }

  if (ctx.applyView === 'applied' && ctx.appliedFunnel && ctx.appliedFunnel !== 'all') {
    items.push({ label: FUNNEL_LABELS[ctx.appliedFunnel] || ctx.appliedFunnel });
  }

  const shown = Number(ctx.count) || 0;
  const total = ctx.total != null ? Number(ctx.total) : shown;
  const countLabel =
    ctx.hasLocalFilter && total !== shown
      ? `${shown} из ${total}`
      : shown === 1
        ? '1 карточка'
        : `${shown} карточек`;
  items.push({ label: countLabel, current: true });

  return items;
}

/**
 * @param {Array<{ label: string, current?: boolean }>} items
 * @returns {string}
 */
export function renderListBreadcrumbsHtml(items) {
  if (!items.length) return '';
  const parts = items.map((it, i) => {
    const sep = i > 0 ? `<span class="list-breadcrumbs__sep" aria-hidden="true">›</span>` : '';
    const cls = it.current ? 'list-breadcrumbs__item list-breadcrumbs__item--current' : 'list-breadcrumbs__item';
    return `${sep}<span class="${cls}">${escapeHtml(it.label)}</span>`;
  });
  return `<nav class="list-breadcrumbs" aria-label="Контекст списка"><span class="list-breadcrumbs__trail">${parts.join('')}</span></nav>`;
}

/** @param {HTMLElement | null} host @param {ReturnType<typeof buildListBreadcrumbItems>} items */
export function mountListBreadcrumbs(host, items) {
  if (!host) return;
  host.innerHTML = renderListBreadcrumbsHtml(items);
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
