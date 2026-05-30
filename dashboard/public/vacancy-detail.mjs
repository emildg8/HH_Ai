/** Модалка с полной карточкой вакансии (действия, описание, отклик). */

import { openModalEl, closeModalEl } from './modals.mjs';
import { syncFullscreenIcon } from './apply-copy-dom.mjs';

let currentId = null;
/** @type {() => object[]} */
let getNavItems = () => [];
/** @type {(item: object, opts?: object) => HTMLElement} */
let renderFullCard = null;

let wheelCooldown = 0;
const WHEEL_GAP_MS = 320;
const FULLSCREEN_STORAGE_KEY = 'hh-vacancy-detail-fullscreen';

let vacancyDetailFullscreen = false;
try {
  vacancyDetailFullscreen = localStorage.getItem(FULLSCREEN_STORAGE_KEY) === '1';
} catch {
  /* ignore */
}

function setVacancyDetailFullscreen(on) {
  vacancyDetailFullscreen = Boolean(on);
  const modal = document.getElementById('vacancy-detail-modal');
  modal?.classList.toggle('modal--fullscreen', vacancyDetailFullscreen);
  const btn = modal?.querySelector('.btn-vacancy-detail-fullscreen');
  if (btn) {
    syncFullscreenIcon(btn, vacancyDetailFullscreen);
    const label = vacancyDetailFullscreen ? 'Обычный размер' : 'Полноэкранный режим';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  try {
    localStorage.setItem(FULLSCREEN_STORAGE_KEY, vacancyDetailFullscreen ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function getVacancyDetailId() {
  return currentId;
}

export function configureVacancyDetailNav({ getItems, renderCard }) {
  if (typeof getItems === 'function') getNavItems = getItems;
  if (typeof renderCard === 'function') renderFullCard = renderCard;
}

function navItems() {
  try {
    return getNavItems() || [];
  } catch {
    return [];
  }
}

function currentIndex(items) {
  if (!currentId) return -1;
  return items.findIndex((x) => x.id === currentId);
}

function syncNavCounter(items, index) {
  const el = document.getElementById('vacancy-detail-counter');
  if (!el) return;
  if (items.length <= 1 || index < 0) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = `${index + 1} / ${items.length}`;
}

function scrollListItemIntoView(id) {
  if (!id) return;
  const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(id)) : String(id);
  document
    .querySelector(`#list [data-record-id="${esc}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * @param {number} delta -1 | 1
 */
export function navigateVacancyDetail(delta) {
  const items = navItems();
  if (!items.length || !renderFullCard || !currentId) return false;
  const i = currentIndex(items);
  if (i < 0) return false;
  const j = i + delta;
  if (j < 0 || j >= items.length) return false;
  openVacancyDetail(items[j], renderFullCard, { preserveModal: true });
  return true;
}

function shouldWheelSwitchCard(e) {
  const body = document.getElementById('vacancy-detail-body');
  if (!body) return true;
  const dy = e.deltaY;
  if (Math.abs(dy) < 2) return false;
  const scrollable = body.scrollHeight > body.clientHeight + 2;
  if (!scrollable) return true;
  const atTop = body.scrollTop <= 4;
  const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
  if (dy > 0) return atBottom;
  return atTop;
}

function onDetailWheel(e) {
  const modal = document.getElementById('vacancy-detail-modal');
  if (!modal || modal.hidden || !currentId) return;
  if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
  if (!shouldWheelSwitchCard(e)) return;

  const now = Date.now();
  if (now - wheelCooldown < WHEEL_GAP_MS) {
    e.preventDefault();
    return;
  }

  const delta = e.deltaY > 0 ? 1 : -1;
  if (navigateVacancyDetail(delta)) {
    wheelCooldown = now;
    e.preventDefault();
  }
}

function onDetailKeydown(e) {
  const modal = document.getElementById('vacancy-detail-modal');
  if (!modal || modal.hidden || !currentId) return;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    if (navigateVacancyDetail(1)) e.preventDefault();
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    if (navigateVacancyDetail(-1)) e.preventDefault();
  }
}

/**
 * @param {object} item
 * @param {(item: object, opts?: { inModal?: boolean }) => HTMLElement} renderCard
 * @param {{ preserveModal?: boolean }} [opts]
 */
export function openVacancyDetail(item, renderCard, opts = {}) {
  const modal = document.getElementById('vacancy-detail-modal');
  const body = document.getElementById('vacancy-detail-body');
  const titleEl = document.getElementById('vacancy-detail-title');
  const metaEl = document.getElementById('vacancy-detail-meta');
  if (!modal || !body || !item) return;

  currentId = item.id;
  const items = navItems();
  const idx = currentIndex(items);
  syncNavCounter(items, idx);

  if (titleEl) titleEl.textContent = item.title || item.url || 'Вакансия';
  if (metaEl) {
    const parts = [item.company, item.searchQuery ? `поиск: ${item.searchQuery}` : '']
      .filter(Boolean)
      .join(' · ');
    metaEl.textContent = parts;
    metaEl.hidden = !parts;
  }

  body.replaceChildren();
  const card = renderCard(item, { inModal: true, forceDensity: 'full' });
  card.classList.add('card--in-modal');
  body.appendChild(card);
  body.scrollTop = 0;

  const hhLink = document.getElementById('vacancy-detail-open-hh');
  if (hhLink && item.url) {
    hhLink.href = item.url;
    hhLink.hidden = false;
  } else if (hhLink) {
    hhLink.hidden = true;
  }

  setVacancyDetailFullscreen(vacancyDetailFullscreen);

  const firstOpen = !opts.preserveModal;
  if (firstOpen) openModalEl(modal);
  scrollListItemIntoView(item.id);
  card.querySelector('.title-link')?.focus({ preventScroll: true });
}

export function closeVacancyDetail() {
  const modal = document.getElementById('vacancy-detail-modal');
  if (!modal) return;
  closeModalEl(modal);
  document.getElementById('vacancy-detail-body')?.replaceChildren();
  syncNavCounter([], -1);
  currentId = null;
}

export function initVacancyDetailModal({ onClose } = {}) {
  const modal = document.getElementById('vacancy-detail-modal');
  if (!modal) return;

  modal.querySelector('[data-close-vacancy-detail]')?.addEventListener('click', () => {
    closeVacancyDetail();
    onClose?.();
  });
  modal.querySelector('.modal-close')?.addEventListener('click', () => {
    closeVacancyDetail();
    onClose?.();
  });
  modal.querySelector('.btn-vacancy-detail-fullscreen')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setVacancyDetailFullscreen(!vacancyDetailFullscreen);
  });
  setVacancyDetailFullscreen(vacancyDetailFullscreen);

  modal.addEventListener('wheel', onDetailWheel, { passive: false, capture: true });
  document.addEventListener('keydown', onDetailKeydown);
}
