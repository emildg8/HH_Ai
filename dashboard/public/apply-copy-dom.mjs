/**
 * Подстановка подписей COPY в разметку ([data-copy], [data-copy-title]).
 */

import { COPY } from './dashboard-ux.mjs';
import { TIER_CLASS_LABEL } from './dashboard-copy-ru.mjs';

/** @param {string} key */
function copyText(key) {
  const v = COPY[key];
  return typeof v === 'string' ? v : '';
}

/** Подписи оценок в селектах фильтра. */
export function syncTierSelectLabels() {
  const sel = document.getElementById('sidebar-filter-tier');
  if (!sel) return;
  for (const opt of sel.options) {
    const label = TIER_CLASS_LABEL[opt.value];
    if (label) opt.textContent = label;
  }
}

/** Применить COPY к статическим элементам DOM. */
export function applyCopyToDom() {
  document.querySelectorAll('[data-copy]').forEach((el) => {
    if (el.dataset.applyView || el.dataset.rejectedSource || el.dataset.status) return;
    const t = copyText(el.getAttribute('data-copy') || '');
    if (t) el.textContent = t;
  });
  document.querySelectorAll('[data-copy-title]').forEach((el) => {
    const t = copyText(el.getAttribute('data-copy-title') || '');
    if (t) {
      el.title = t;
      if (!el.dataset.tip) el.dataset.tip = t;
    }
  });
  document.querySelectorAll('[data-copy-aria]').forEach((el) => {
    const t = copyText(el.getAttribute('data-copy-aria') || '');
    if (t) el.setAttribute('aria-label', t);
  });
  syncTierSelectLabels();
}

/** Переключить иконку expand/compress на кнопке полноэкранного режима. */
export function syncFullscreenIcon(btn, isFullscreen) {
  const icon = btn?.querySelector('.ui-icon');
  if (!icon) return;
  icon.classList.toggle('ui-icon--expand', !isFullscreen);
  icon.classList.toggle('ui-icon--compress', Boolean(isFullscreen));
}
