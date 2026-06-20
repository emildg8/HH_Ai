/**
 * Единый слой модалок: список, open/close, Escape и клик по фону.
 */

/** Корневые id модалок (порядок Escape — сверху вниз по приоритету закрытия). */
export const MODAL_ROOT_IDS = [
  'batch-precheck-modal',
  'letter-issues-modal',
  'letter-quality-hub-modal',
  'chat-inbox-modal',
  'settings-modal',
  'shortcuts-modal',
  'ingest-url-modal',
  'intelligence-digest-modal',
  'batch-report-modal',
  'daily-digest-modal',
  'approved-letter-modal',
  'questionnaire-modal',
  'funnel-modal',
  'interview-prompt-modal',
  'interview-hub-modal',
  'apply-log-modal',
  'draft-modal',
  'vacancy-detail-modal',
];

/** @deprecated используйте MODAL_ROOT_IDS */
export const MODAL_IDS = MODAL_ROOT_IDS;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** @param {string} id */
export function getModalEl(id) {
  return document.getElementById(id);
}

/** @returns {string[]} */
export function getOpenModalIds() {
  return MODAL_ROOT_IDS.filter((id) => {
    const m = getModalEl(id);
    return m && !m.hidden;
  });
}

export function anyModalOpen() {
  return getOpenModalIds().length > 0;
}

/**
 * @param {HTMLElement} dialog
 * @returns {HTMLElement[]}
 */
function getFocusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
    return el.offsetParent !== null || dialog === el.offsetParent;
  });
}

/**
 * Focus trap для модалки настроек: Tab внутри dialog, inert на shell.
 * @param {HTMLElement | null | undefined} modal
 * @returns {() => void}
 */
export function installModalFocusTrap(modal) {
  if (!modal) return () => {};
  const dialog = modal.querySelector('.modal-dialog');
  if (!(dialog instanceof HTMLElement)) return () => {};

  const shell = document.getElementById('app-shell');
  const previousFocus = document.activeElement;
  if (shell) shell.setAttribute('aria-hidden', 'true');

  const onKeydown = (e) => {
    if (e.key !== 'Tab' || modal.hidden) return;
    const focusables = getFocusableElements(dialog);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeydown);

  return () => {
    document.removeEventListener('keydown', onKeydown);
    if (shell) shell.removeAttribute('aria-hidden');
    if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  };
}

/**
 * @param {HTMLElement | null | undefined} modal
 */
export function openModalEl(modal) {
  if (!modal) return;
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('modal--open'));
  const dialog = modal.querySelector('.modal-dialog');
  dialog?.focus?.();
}

/**
 * @param {HTMLElement | null | undefined} modal
 */
export function closeModalEl(modal) {
  if (!modal) return;
  modal.classList.remove('modal--open');
  modal.hidden = true;
}

/**
 * @param {Element | null} target
 */
function isModalDismissClick(target) {
  if (!(target instanceof Element)) return false;
  if (target.classList?.contains('modal-backdrop')) return true;
  if (target.classList?.contains('modal-close')) return true;
  if (target.hasAttribute?.('data-close-modal')) return true;
  if (target.hasAttribute?.('data-close-funnel')) return true;
  if (target.hasAttribute?.('data-close-settings')) return true;
  if (target.hasAttribute?.('data-close-shortcuts')) return true;
  if (target.hasAttribute?.('data-close-vacancy-detail')) return true;
  return false;
}

/**
 * @param {{ onEscape?: (modalId?: string) => boolean | void }} [opts]
 */
export function initModalLayer({ onEscape } = {}) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (onEscape?.()) {
      e.preventDefault();
    }
  });

  for (const id of MODAL_ROOT_IDS) {
    const modal = getModalEl(id);
    if (!modal) continue;
    modal.addEventListener('click', (e) => {
      if (!isModalDismissClick(e.target)) return;
      e.preventDefault();
      onEscape?.(id);
    });
  }
}
