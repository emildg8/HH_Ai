/** Масштаб интерфейса дашборда (окно / Full HD / ультраширокий). */

const STORAGE_KEY = 'hh-dashboard-ui-scale';
const MIN = 0.8;
const MAX = 1.25;
const DEFAULT = 1;

export function clampUiScale(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT;
  return Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100));
}

export function readUiScale() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT;
    return clampUiScale(parseFloat(raw, 10));
  } catch {
    return DEFAULT;
  }
}

export function writeUiScale(scale) {
  const v = clampUiScale(scale);
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
  applyUiScale(v);
  return v;
}

export function applyUiScale(scale) {
  const v = clampUiScale(scale);
  document.documentElement.style.setProperty('--ui-scale', String(v));
  document.documentElement.dataset.uiScale = String(Math.round(v * 100));

  const range = document.getElementById('ui-scale-range');
  const label = document.getElementById('ui-scale-value');
  if (range) range.value = String(Math.round(v * 100));
  if (label) label.textContent = `${Math.round(v * 100)}%`;

  document.querySelectorAll('[data-ui-scale-preset]').forEach((btn) => {
    const p = Number(btn.getAttribute('data-ui-scale-preset'));
    btn.classList.toggle('active', Math.abs(p - v) < 0.01);
  });
}

export function initUiScaleControls() {
  applyUiScale(readUiScale());

  const range = document.getElementById('ui-scale-range');
  range?.addEventListener('input', () => {
    writeUiScale(Number(range.value) / 100);
  });

  document.querySelectorAll('[data-ui-scale-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = Number(btn.getAttribute('data-ui-scale-preset'));
      writeUiScale(v);
    });
  });
}
