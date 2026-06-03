/**
 * Подстановка подписей COPY в разметку ([data-copy], [data-copy-title]).
 */

import { COPY } from './dashboard-ux.mjs';

/** @param {string} key */
function copyText(key) {
  const v = COPY[key];
  return typeof v === 'string' ? v : '';
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
    if (t) el.title = t;
  });
  document.querySelectorAll('[data-copy-aria]').forEach((el) => {
    const t = copyText(el.getAttribute('data-copy-aria') || '');
    if (t) el.setAttribute('aria-label', t);
  });
}

/** Переключить иконку expand/compress на кнопке полноэкранного режима. */
export function syncFullscreenIcon(btn, isFullscreen) {
  const icon = btn?.querySelector('.ui-icon');
  if (!icon) return;
  icon.classList.toggle('ui-icon--expand', !isFullscreen);
  icon.classList.toggle('ui-icon--compress', Boolean(isFullscreen));
}
