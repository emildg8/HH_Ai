/**
 * Навигация j/k по карточкам списка (roving focus).
 */

/** @type {HTMLElement | null} */
let listRoot = null;
/** @type {() => HTMLElement[]} */
let getFocusables = () => [];

/**
 * @param {HTMLElement} listEl
 * @param {() => HTMLElement[]} focusableProvider
 */
export function initListKeyboardNav(listEl, focusableProvider) {
  listRoot = listEl;
  getFocusables = focusableProvider;
  if (listRoot.dataset.kbNavBound === '1') return;
  listRoot.dataset.kbNavBound = '1';
  listRoot.addEventListener('keydown', onListKeydown);
  document.addEventListener('keydown', onGlobalKeydown);
}

function isTypingContext() {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.closest('.command-palette, .modal:not([hidden])')) return true;
  return false;
}

/** @param {KeyboardEvent} e */
function onGlobalKeydown(e) {
  if (isTypingContext()) return;
  if (e.key !== 'j' && e.key !== 'k') return;
  const items = getFocusables().filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  e.preventDefault();
  const idx = items.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
  const next =
    e.key === 'j'
      ? items[Math.min(items.length - 1, idx < 0 ? 0 : idx + 1)]
      : items[Math.max(0, idx <= 0 ? items.length - 1 : idx - 1)];
  next?.focus({ preventScroll: false });
  next?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** @param {KeyboardEvent} e */
function onListKeydown(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = getFocusables().filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  e.preventDefault();
  const idx = items.indexOf(document.activeElement);
  const next =
    e.key === 'ArrowDown'
      ? items[Math.min(items.length - 1, idx + 1)]
      : items[Math.max(0, idx - 1)];
  next?.focus({ preventScroll: false });
}
