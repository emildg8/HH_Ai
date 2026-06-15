/**
 * Бейджи источника, tier и режима отклика (multi-source UX v4).
 */

import { SOURCE_UI_LABELS, tierShortLabel, tierClassLabel } from './dashboard-copy-ru.mjs';

/** @type {Record<string, string>} */
export const SOURCE_LABELS = {
  ...SOURCE_UI_LABELS,
};

/** @type {Record<string, string>} */
export const APPLY_MODE_LABELS = {
  hh_auto: 'авто hh',
  manual_link: 'ручной',
  ats_form: 'форма на сайте',
};

/** @param {string | undefined | null} source */
export function normalizeSourceKey(source) {
  const s = String(source || 'hh').toLowerCase();
  return SOURCE_LABELS[s] ? s : 'hh';
}

/** @param {string | undefined | null} source */
export function sourceBadgeClass(source) {
  return `source-badge source-badge--${normalizeSourceKey(source)}`;
}

/** @param {string | undefined | null} tier */
export function tierBadgeClass(tier) {
  const t = String(tier || '').toUpperCase();
  return t ? `tier-badge tier-badge--${t}` : 'tier-badge tier-badge--unknown';
}

/** @param {string | undefined | null} mode */
export function applyModeChipClass(mode) {
  if (mode === 'ats_form') return 'apply-mode apply-mode--ats';
  if (mode === 'manual_link') return 'apply-mode apply-mode--manual';
  return 'apply-mode apply-mode--auto';
}

/** @param {string | undefined | null} source */
export function formatSourceOpenLabel(source) {
  const key = normalizeSourceKey(source);
  return `Открыть на ${SOURCE_LABELS[key] || key}`;
}

/** @param {number | null | undefined} freshnessHours */
export function formatFreshnessBadge(freshnessHours) {
  const h = Number(freshnessHours);
  if (!Number.isFinite(h)) return '';
  if (h < 72) return `<72ч`;
  if (h < 168) return `${Math.round(h / 24)}д`;
  return `${Math.round(h / 24)}д`;
}

/**
 * @param {string} source
 * @param {string} [tier]
 * @returns {HTMLElement}
 */
export function createSourceBadgeEl(source, tier) {
  const span = document.createElement('span');
  const key = normalizeSourceKey(source);
  span.className = `hh-badge ${sourceBadgeClass(key)}`;
  span.textContent = SOURCE_LABELS[key] || key;
  if (tier) {
    const tierEl = document.createElement('span');
    tierEl.className = `hh-badge ${tierBadgeClass(tier)}`;
    tierEl.textContent = tierShortLabel(tier);
    tierEl.title = tierClassLabel(tier);
    const wrap = document.createElement('span');
    wrap.className = 'source-badge-row';
    wrap.append(span, tierEl);
    return wrap;
  }
  return span;
}

/**
 * @param {object} item
 * @returns {DocumentFragment}
 */
export function buildSourceBadgeFragment(item) {
  const frag = document.createDocumentFragment();
  const row = document.createElement('span');
  row.className = 'source-badge-row';
  row.appendChild(createSourceBadgeEl(item?.source, item?.sourceQualityTier));
  if (item?.applyMode && item.applyMode !== 'hh_auto') {
    const mode = document.createElement('span');
    mode.className = applyModeChipClass(item.applyMode);
    mode.textContent = APPLY_MODE_LABELS[item.applyMode] || item.applyMode;
    row.appendChild(mode);
  }
  const fresh = formatFreshnessBadge(item?.freshnessHours);
  if (fresh) {
    const f = document.createElement('span');
    f.className = 'freshness-badge';
    f.textContent = fresh;
    f.title = 'Свежесть вакансии';
    row.appendChild(f);
  }
  frag.appendChild(row);
  return frag;
}
