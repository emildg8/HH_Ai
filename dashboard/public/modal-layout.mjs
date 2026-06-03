/**
 * Единый слой модалок: список, open/close, Escape и клик по фону.
 */

/** Корневые id модалок (порядок Escape — сверху вниз по приоритету закрытия). */
export const MODAL_ROOT_IDS = [
  'batch-precheck-modal',
  'letter-quality-hub-modal',
  'chat-inbox-modal',
  'settings-modal',
  'shortcuts-modal',
  'batch-report-modal',
  'daily-digest-modal',
  'approved-letter-modal',
  'questionnaire-modal',
  'funnel-modal',
  'apply-log-modal',
  'draft-modal',
  'vacancy-detail-modal',
];

/** @deprecated используйте MODAL_ROOT_IDS */
export const MODAL_IDS = MODAL_ROOT_IDS;

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
