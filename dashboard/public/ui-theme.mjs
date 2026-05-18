/** Тема дашборда: тёмная по умолчанию, светлая по выбору. */

const STORAGE_KEY = 'hh-dashboard-theme';
const THEMES = ['dark', 'light'];
const DEFAULT = 'dark';

export function normalizeTheme(value) {
  const v = String(value || '').trim().toLowerCase();
  return THEMES.includes(v) ? v : DEFAULT;
}

export function readTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT;
    return normalizeTheme(raw);
  } catch {
    return DEFAULT;
  }
}

export function writeTheme(theme) {
  const v = normalizeTheme(theme);
  try {
    if (v === DEFAULT) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
  applyTheme(v);
  return v;
}

export function applyTheme(theme) {
  const v = normalizeTheme(theme);
  if (v === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }

  document.querySelectorAll('[data-theme-preset]').forEach((btn) => {
    const p = btn.getAttribute('data-theme-preset');
    btn.classList.toggle('active', p === v);
  });
}

export function initThemeControls() {
  applyTheme(readTheme());

  document.querySelectorAll('[data-theme-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      writeTheme(btn.getAttribute('data-theme-preset'));
    });
  });
}
