/** Объём текста в карточках вакансий: compact | medium | full (размер карточки не меняется). */

const STORAGE_KEY = 'hh-dashboard-card-density';
const DENSITIES = ['compact', 'medium', 'full'];
const DEFAULT = 'medium';

export function normalizeCardDensity(value) {
  const v = String(value || '').trim().toLowerCase();
  return DENSITIES.includes(v) ? v : DEFAULT;
}

export function readCardDensity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT;
    return normalizeCardDensity(raw);
  } catch {
    return DEFAULT;
  }
}

export function writeCardDensity(density) {
  const v = normalizeCardDensity(density);
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
  applyCardDensity(v);
  window.dispatchEvent(new CustomEvent('hh-card-density-change', { detail: { density: v } }));
  return v;
}

export function applyCardDensity(density) {
  const v = normalizeCardDensity(density);
  document.documentElement.dataset.cardDensity = v;
  const list = document.getElementById('list');
  if (list) list.dataset.cardDensity = v;

  document.querySelectorAll('[data-card-density-preset]').forEach((btn) => {
    const p = btn.getAttribute('data-card-density-preset');
    btn.classList.toggle('active', p === v);
  });
}

export function initCardDensityControls() {
  applyCardDensity(readCardDensity());

  document.querySelectorAll('[data-card-density-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      writeCardDensity(btn.getAttribute('data-card-density-preset'));
    });
  });
}
