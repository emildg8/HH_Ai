/**
 * Мобильная адаптация v4: узкий экран → список на весь экран, панели в bottom sheet.
 */

export const MOBILE_BREAKPOINT_PX = 1024;

/** @type {'left'|'right'|null} */
let openSheet = null;

export function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT_PX;
}

function shellEl() {
  return document.getElementById('app-shell');
}

function backdropEl() {
  return document.getElementById('mobile-sheet-backdrop');
}

function mobileBarEl() {
  return document.getElementById('mobile-bar');
}

export function closeMobileSheets() {
  openSheet = null;
  document.body.classList.remove('mobile-sheet-open');
  const backdrop = backdropEl();
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
  }
  for (const side of /** @type {const} */ (['left', 'right'])) {
    const dock = document.getElementById(`dock-${side}`);
    dock?.classList.remove('mobile-sheet--open');
    dock?.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('[data-mobile-sheet]').forEach((btn) => {
    btn.classList.remove('mobile-bar__btn--active');
    btn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * @param {'left'|'right'} side
 */
export function openMobileSheet(side) {
  if (!isMobileViewport()) return;
  if (openSheet === side) {
    closeMobileSheets();
    return;
  }
  closeMobileSheets();
  const dock = document.getElementById(`dock-${side}`);
  const backdrop = backdropEl();
  if (!dock || !backdrop) return;
  openSheet = side;
  dock.classList.add('mobile-sheet--open');
  dock.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('mobile-sheet-open');
  const btn = document.querySelector(`[data-mobile-sheet="${side}"]`);
  btn?.classList.add('mobile-bar__btn--active');
  btn?.setAttribute('aria-expanded', 'true');
  dock.querySelector('.dock__body')?.scrollTo?.(0, 0);
}

/** Перестроить сетку: на мобильном только центр в потоке. */
export function applyMobileStageLayout() {
  const stage = document.querySelector('.workspace-stage');
  if (!stage) return;
  if (isMobileViewport()) {
    stage.style.gridTemplateColumns = 'minmax(0, 1fr)';
    const leftSplit = document.getElementById('splitter-left');
    const rightSplit = document.getElementById('splitter-right');
    if (leftSplit) leftSplit.style.display = 'none';
    if (rightSplit) rightSplit.style.display = 'none';
  } else {
    stage.style.removeProperty('grid-template-columns');
    window.dispatchEvent(new CustomEvent('hh-docks-refresh'));
  }
}

export function syncMobileShell() {
  const shell = shellEl();
  const mobile = isMobileViewport();
  shell?.classList.toggle('workspace-shell--mobile', mobile);
  const bar = mobileBarEl();
  if (bar) {
    bar.hidden = !mobile;
    bar.setAttribute('aria-hidden', mobile ? 'false' : 'true');
  }
  if (!mobile) closeMobileSheets();
  for (const side of /** @type {const} */ (['left', 'right'])) {
    document.getElementById(`dock-${side}`)?.classList.toggle('dock--mobile-overlay', mobile);
  }
  applyMobileStageLayout();
}

/**
 * @param {{ onDesktopRefresh?: () => void }} [opts]
 */
export function initMobileShell(opts = {}) {
  syncMobileShell();
  document.querySelectorAll('[data-mobile-sheet]').forEach((btn) => {
    const side = btn.getAttribute('data-mobile-sheet');
    if (side !== 'left' && side !== 'right') return;
    btn.addEventListener('click', () => openMobileSheet(side));
  });
  document.querySelector('[data-mobile-center]')?.addEventListener('click', () => {
    closeMobileSheets();
    document.getElementById('list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('[data-mobile-settings]')?.addEventListener('click', () => {
    closeMobileSheets();
    document.getElementById('btn-open-settings')?.click();
  });
  backdropEl()?.addEventListener('click', closeMobileSheets);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openSheet) closeMobileSheets();
  });
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const wasMobile = document.body.classList.contains('mobile-sheet-open');
      syncMobileShell();
      if (!isMobileViewport() && wasMobile) opts.onDesktopRefresh?.();
    }, 120);
  });
}
