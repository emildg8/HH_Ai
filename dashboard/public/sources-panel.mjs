/**
 * Панель «Источники»: hh harvest, внешние, ingest, top tier A/B.
 */

import { createSourceBadgeEl } from './source-badges.mjs';

const SIDEBAR_PREVIEW = 3;

/** @param {number | null | undefined} hours */
function formatAge(hours) {
  const h = Number(hours);
  if (!Number.isFinite(h)) return '';
  if (h < 1) return 'только что';
  if (h < 24) return `${Math.round(h)} ч назад`;
  const days = Math.round(h / 24);
  return `${days} дн. назад`;
}

/** @param {{ title?: string, company?: string, url?: string, id?: string }} it */
function topTierDisplayTitle(it) {
  if (it.title?.trim()) return it.title.trim();
  if (it.company?.trim()) return it.company.trim();
  try {
    if (it.url) {
      const host = new URL(it.url).hostname.replace(/^www\./, '');
      if (host) return host;
    }
  } catch {
    /* ignore */
  }
  if (it.id) {
    const id = String(it.id);
    return id.length > 28 ? `${id.slice(0, 25)}…` : id;
  }
  return 'Без названия';
}

/** @type {Array<object>} */
let topTierCache = [];
let topTierExpanded = false;

/**
 * @param {{
 *   onFilterTier?: (tier: string) => void,
 *   onFocusVacancy?: (id: string) => void,
 * }} hooks
 * @param {Array<object>} items
 */
function renderTopTierItems(hooks, items) {
  const listEl = document.getElementById('sources-top-tier-list');
  const moreBtn = document.getElementById('btn-sources-top-tier-more');
  if (!listEl) return;
  const visible = topTierExpanded ? items : items.slice(0, SIDEBAR_PREVIEW);
  if (moreBtn) {
    moreBtn.hidden = items.length <= SIDEBAR_PREVIEW;
    moreBtn.textContent = topTierExpanded
      ? 'Свернуть список'
      : `Показать все (${items.length})`;
  }
  listEl.replaceChildren(
    ...visible.map((it) => {
      const li = document.createElement('li');
      li.className = 'sources-top-tier__item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sources-top-tier__btn';
      const title = document.createElement('span');
      title.className = 'sources-top-tier__title';
      const displayTitle = topTierDisplayTitle(it);
      title.textContent = displayTitle;
      if (!it.title && it.id) title.title = String(it.id);
      const sub = document.createElement('span');
      sub.className = 'sources-top-tier__sub';
      const parts = [];
      if (it.company && it.company.trim() !== displayTitle) parts.push(it.company.trim());
      const age = formatAge(it.freshnessHours);
      if (age) parts.push(age);
      if (it.scoreOverall != null && Number.isFinite(Number(it.scoreOverall))) {
        parts.push(`${Math.round(Number(it.scoreOverall))} баллов`);
      }
      sub.textContent = parts.join(' · ');
      const badges = createSourceBadgeEl(it.source, it.sourceQualityTier);
      btn.append(title, sub, badges);
      const tip = [displayTitle, it.company, it.url].filter(Boolean).join(' · ');
      btn.title = tip;
      btn.addEventListener('click', (ev) => {
        if (ev.shiftKey && it.url) {
          window.open(it.url, '_blank', 'noopener');
          return;
        }
        if (it.id) hooks.onFocusVacancy?.(String(it.id));
        else if (it.sourceQualityTier) hooks.onFilterTier?.(String(it.sourceQualityTier));
      });
      li.appendChild(btn);
      return li;
    })
  );
}

/**
 * @param {{
 *   api: (path: string, opts?: object) => Promise<any>,
 *   showToast: (msg: string, kind?: string) => void,
 *   onFilterTier?: (tier: string) => void,
 *   onFocusVacancy?: (id: string) => void,
 *   onOpenIngest?: () => void,
 * }} hooks
 */
export function initSourcesPanel(hooks) {
  const externalSelect = document.getElementById('sources-external-target');
  const btnExternal = document.getElementById('btn-sources-external-run');

  document.getElementById('btn-ingest-url')?.addEventListener('click', (e) => {
    e.preventDefault();
    hooks.onOpenIngest?.();
  });

  btnExternal?.addEventListener('click', async () => {
    const target = externalSelect?.value || 'all';
    btnExternal.disabled = true;
    try {
      const res = await hooks.api('/api/run-external-harvest', {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      hooks.showToast(`Сбор внешних источников (${target}) — pid ${res.pid}`, 'good');
    } catch (err) {
      hooks.showToast(err?.message || String(err), 'bad');
    } finally {
      btnExternal.disabled = false;
    }
  });

  document.getElementById('btn-review-tier-a')?.addEventListener('click', () => {
    hooks.onFilterTier?.('A');
  });

  document.getElementById('btn-sources-top-tier-more')?.addEventListener('click', () => {
    topTierExpanded = !topTierExpanded;
    renderTopTierItems(hooks, topTierCache);
  });

  void refreshTopTierList(hooks);
}

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any>, onFilterTier?: (tier: string) => void, onFocusVacancy?: (id: string) => void }} hooks
 */
export async function refreshTopTierList(hooks) {
  const listEl = document.getElementById('sources-top-tier-list');
  const metaEl = document.getElementById('sources-top-tier-meta');
  if (!listEl) return;
  try {
    const data = await hooks.api('/api/top-tier?limit=20');
    const items = data.items || [];
    topTierCache = items;
    if (items.length <= SIDEBAR_PREVIEW) topTierExpanded = false;
    if (metaEl) {
      metaEl.textContent = items.length
        ? `Лучшие A/B в очереди · ${items.length}`
        : 'Нет вакансий класса A или B';
    }
    if (!items.length) {
      listEl.innerHTML =
        '<li class="sources-top-tier__empty">Запустите сбор или вставьте ссылку на вакансию</li>';
      const moreBtn = document.getElementById('btn-sources-top-tier-more');
      if (moreBtn) moreBtn.hidden = true;
      return;
    }
    renderTopTierItems(hooks, items);
  } catch {
    if (metaEl) metaEl.textContent = 'Не удалось загрузить';
    listEl.innerHTML = '<li class="sources-top-tier__empty">Ошибка загрузки</li>';
  }
}
