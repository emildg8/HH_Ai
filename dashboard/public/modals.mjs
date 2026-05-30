/** Закрытие модалок: Escape, клик по фону, стек. */

const MODAL_IDS = [
  'vacancy-detail-modal',
  'draft-modal',
  'apply-log-modal',
  'approved-letter-modal',
  'questionnaire-modal',
  'funnel-modal',
  'settings-modal',
  'shortcuts-modal',
];

export function anyModalOpen() {
  return MODAL_IDS.some((id) => {
    const m = document.getElementById(id);
    return m && !m.hidden;
  });
}

export function initModalLayer({ onEscape } = {}) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (onEscape?.()) {
      e.preventDefault();
    }
  });

  for (const id of MODAL_IDS) {
    const modal = document.getElementById(id);
    if (!modal) continue;
    modal.addEventListener('click', (e) => {
      const t = e.target;
      if (
        t.classList?.contains('modal-backdrop') ||
        t.hasAttribute?.('data-close-modal') ||
        t.hasAttribute?.('data-close-funnel') ||
        t.hasAttribute?.('data-close-settings') ||
        t.hasAttribute?.('data-close-shortcuts') ||
        t.hasAttribute?.('data-close-vacancy-detail')
      ) {
        e.preventDefault();
        onEscape?.(id);
      }
    });
    modal.querySelector('.modal-close')?.addEventListener('click', () => onEscape?.(id));
  }
}

export function openModalEl(modal) {
  if (!modal) return;
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('modal--open'));
  const dialog = modal.querySelector('.modal-dialog');
  dialog?.focus?.();
}

export function closeModalEl(modal) {
  if (!modal) return;
  modal.classList.remove('modal--open');
  modal.hidden = true;
}
