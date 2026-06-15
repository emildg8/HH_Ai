/**
 * Раскладка модалки «Настройки»: пресеты размера, полноэкран, localStorage.
 */

import { syncFullscreenIcon } from './apply-copy-dom.mjs';

export const SETTINGS_FULLSCREEN_STORAGE_KEY = 'hh-settings-modal-fullscreen';
export const SETTINGS_SIZE_STORAGE_KEY = 'hh-settings-modal-size';
export const SETTINGS_SIZE_SCHEMA_STORAGE_KEY = 'hh-settings-modal-size-version';
export const SETTINGS_LAYOUT_PRESET_STORAGE_KEY = 'hh-settings-modal-layout-preset';
export const SETTINGS_OPEN_FULLSCREEN_STORAGE_KEY = 'hh-settings-modal-open-fullscreen';

/** Краткая подсказка для футера модалки (десктоп). */
export const SETTINGS_LAYOUT_FOOTER_SUFFIX = ' · Alt+1–4 разделы · Alt+F экран';

/** @typedef {'compact' | 'standard' | 'wide' | 'fullscreen' | 'custom'} SettingsLayoutPresetId */

export const SETTINGS_DIALOG_DEFAULT = { w: 960, h: 840 };
export const SETTINGS_DIALOG_MIN = { w: 720, h: 520 };
export const SETTINGS_SIZE_SCHEMA_VERSION = 2;

/** @type {Record<string, { label: string, w?: number, h?: number, reset?: boolean, fullscreen?: boolean }>} */
export const SETTINGS_LAYOUT_PRESETS = {
  compact: { label: 'Компакт', w: 760, h: 600 },
  standard: { label: 'Стандарт', w: 960, h: 840 },
  wide: { label: 'Широкое', w: 960, h: 720 },
  fullscreen: { label: 'На весь экран', fullscreen: true },
};

let settingsModalFullscreen = false;
let suppressSettingsSizePersist = 0;
/** @type {((msg: string, variant?: string) => void) | null} */
let settingsLayoutToast = null;

/** @returns {HTMLElement | null} */
export function getSettingsDialogEl() {
  return document.querySelector('#settings-modal .settings-dialog--v5, #settings-modal .settings-dialog--v4');
}

/** @param {number} w @param {number} h */
export function clampSettingsDialogSize(w, h) {
  const maxW = Math.max(SETTINGS_DIALOG_MIN.w, Math.floor(window.innerWidth - 16));
  const maxH = Math.max(SETTINGS_DIALOG_MIN.h, Math.floor(window.innerHeight - 16));
  const minW = Math.min(SETTINGS_DIALOG_MIN.w, maxW);
  const minH = Math.min(SETTINGS_DIALOG_MIN.h, maxH);
  return {
    w: Math.max(minW, Math.min(w, maxW)),
    h: Math.max(minH, Math.min(h, maxH)),
  };
}

/** Сброс устаревшего размера окна после смены дефолта. */
export function migrateSettingsDialogSizeSchema() {
  try {
    const v = Number(localStorage.getItem(SETTINGS_SIZE_SCHEMA_STORAGE_KEY) || 0);
    if (v >= SETTINGS_SIZE_SCHEMA_VERSION) return;
    localStorage.removeItem(SETTINGS_SIZE_STORAGE_KEY);
    localStorage.setItem(SETTINGS_SIZE_SCHEMA_STORAGE_KEY, String(SETTINGS_SIZE_SCHEMA_VERSION));
  } catch {
    /* ignore */
  }
}

/** @returns {{ w: number, h: number } | null} */
export function readStoredSettingsDialogSize() {
  try {
    const raw = localStorage.getItem(SETTINGS_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const w = Number(o?.w);
    const h = Number(o?.h);
    if (Number.isFinite(w) && Number.isFinite(h) && w >= SETTINGS_DIALOG_MIN.w && h >= SETTINGS_DIALOG_MIN.h) {
      return clampSettingsDialogSize(w, h);
    }
    if (Number.isFinite(w) && Number.isFinite(h)) {
      try {
        localStorage.removeItem(SETTINGS_SIZE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistLayoutPresetId(id) {
  try {
    if (id === 'custom') localStorage.setItem(SETTINGS_LAYOUT_PRESET_STORAGE_KEY, 'custom');
    else if (SETTINGS_LAYOUT_PRESETS[id]) localStorage.setItem(SETTINGS_LAYOUT_PRESET_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function readStoredLayoutPresetId() {
  try {
    const id = localStorage.getItem(SETTINGS_LAYOUT_PRESET_STORAGE_KEY);
    if (id && (id === 'custom' || SETTINGS_LAYOUT_PRESETS[id])) return id;
  } catch {
    /* ignore */
  }
  return null;
}

export function syncSettingsDialogResizeChrome() {
  const dlg = getSettingsDialogEl();
  if (!dlg) return;
  const resizable = !settingsModalFullscreen && !window.matchMedia('(max-width: 640px)').matches;
  dlg.classList.toggle('settings-dialog--resizable', resizable);
}

function runWithSuppressedSettingsSizePersist(fn) {
  suppressSettingsSizePersist += 1;
  try {
    fn();
  } finally {
    requestAnimationFrame(() => {
      suppressSettingsSizePersist = Math.max(0, suppressSettingsSizePersist - 1);
    });
  }
}

function applyStoredSettingsDialogSize() {
  if (settingsModalFullscreen) return;
  const dlg = getSettingsDialogEl();
  const size = readStoredSettingsDialogSize();
  if (!dlg || !size) {
    dlg?.classList.remove('settings-dialog--user-sized');
    return;
  }
  runWithSuppressedSettingsSizePersist(() => {
    dlg.style.width = `${size.w}px`;
    dlg.style.height = `${size.h}px`;
    dlg.classList.add('settings-dialog--user-sized');
  });
}

function readDialogSizeForPersist(dlg) {
  const rect = dlg.getBoundingClientRect();
  const styledW = Number.parseInt(dlg.style.width, 10);
  const styledH = Number.parseInt(dlg.style.height, 10);
  const w =
    dlg.classList.contains('settings-dialog--user-sized') && Number.isFinite(styledW) && styledW > 0
      ? styledW
      : Math.round(rect.width);
  const h =
    dlg.classList.contains('settings-dialog--user-sized') && Number.isFinite(styledH) && styledH > 0
      ? styledH
      : Math.round(rect.height);
  return clampSettingsDialogSize(w, h);
}

function persistSettingsDialogSize() {
  if (suppressSettingsSizePersist > 0 || settingsModalFullscreen) return;
  if (window.matchMedia('(max-width: 640px)').matches) return;
  const dlg = getSettingsDialogEl();
  if (!dlg) return;
  const { w, h } = readDialogSizeForPersist(dlg);
  dlg.classList.add('settings-dialog--user-sized');
  try {
    localStorage.setItem(SETTINGS_SIZE_STORAGE_KEY, JSON.stringify({ w, h }));
  } catch {
    /* ignore */
  }
  const detected = detectSettingsLayoutPreset();
  persistLayoutPresetId(detected);
  syncSettingsLayoutPresetUi();
}

/** @returns {SettingsLayoutPresetId} */
export function detectSettingsLayoutPreset() {
  if (settingsModalFullscreen) return 'fullscreen';
  const size = readStoredSettingsDialogSize();
  const storedId = readStoredLayoutPresetId();
  if (size && storedId && storedId !== 'custom' && SETTINGS_LAYOUT_PRESETS[storedId]?.w) {
    const preset = SETTINGS_LAYOUT_PRESETS[storedId];
    if (
      preset.w &&
      preset.h &&
      Math.abs(size.w - preset.w) <= 36 &&
      Math.abs(size.h - preset.h) <= 56
    ) {
      return /** @type {SettingsLayoutPresetId} */ (storedId);
    }
  }
  if (!size) return 'standard';
  for (const [id, preset] of Object.entries(SETTINGS_LAYOUT_PRESETS)) {
    if (!preset.w || !preset.h) continue;
    if (Math.abs(size.w - preset.w) <= 28 && Math.abs(size.h - preset.h) <= 36) {
      return /** @type {SettingsLayoutPresetId} */ (id);
    }
  }
  return 'custom';
}

/** Подсветка активного пресета во всех сегментах. */
export function syncSettingsLayoutPresetUi() {
  const active = detectSettingsLayoutPreset();
  document.querySelectorAll('[data-settings-layout-preset]').forEach((btn) => {
    const id = btn.getAttribute('data-settings-layout-preset');
    const on = id === active;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const bar = document.getElementById('settings-layout-bar');
  bar?.classList.toggle('settings-layout-bar--custom', active === 'custom');
  const customHint = document.getElementById('settings-layout-custom-hint');
  if (customHint) customHint.hidden = active !== 'custom';
}

/** Прокрутить к пресетам окна и кратко подсветить панель. */
export function focusSettingsLayoutBar() {
  const bar = document.getElementById('settings-layout-presets-group') || document.getElementById('settings-layout-bar');
  if (!bar) {
    settingsLayoutToast?.('Пресеты окна — в разделе «Интерфейс»', 'neutral');
    return;
  }
  bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  bar.classList.remove('settings-layout-bar--pulse');
  void bar.offsetWidth;
  bar.classList.add('settings-layout-bar--pulse');
  window.setTimeout(() => bar.classList.remove('settings-layout-bar--pulse'), 900);
}

/** Полный сброс раскладки окна (размер, пресет, полноэкран, «открывать на весь экран»). */
export function resetSettingsModalLayout() {
  try {
    localStorage.removeItem(SETTINGS_SIZE_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_LAYOUT_PRESET_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_FULLSCREEN_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_OPEN_FULLSCREEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  setSettingsModalFullscreen(false);
  const dlg = getSettingsDialogEl();
  runWithSuppressedSettingsSizePersist(() => {
    dlg?.style.removeProperty('width');
    dlg?.style.removeProperty('height');
    dlg?.classList.remove('settings-dialog--user-sized');
  });
  persistLayoutPresetId('standard');
  syncSettingsDialogResizeChrome();
  syncSettingsLayoutPresetUi();
  const cb = document.getElementById('settings-modal-open-fullscreen');
  if (cb) cb.checked = false;
}

/** Сброс пользовательского размера окна настроек. */
export function resetSettingsDialogSize() {
  const dlg = getSettingsDialogEl();
  runWithSuppressedSettingsSizePersist(() => {
    dlg?.style.removeProperty('width');
    dlg?.style.removeProperty('height');
    dlg?.classList.remove('settings-dialog--user-sized');
  });
  try {
    localStorage.removeItem(SETTINGS_SIZE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  persistLayoutPresetId('standard');
  syncSettingsDialogResizeChrome();
  syncSettingsLayoutPresetUi();
}

/** @param {boolean} on */
export function setSettingsModalFullscreen(on) {
  settingsModalFullscreen = Boolean(on);
  const modal = document.getElementById('settings-modal');
  modal?.classList.toggle('modal--fullscreen', settingsModalFullscreen);
  const btn = modal?.querySelector('.btn-settings-fullscreen');
  if (btn) {
    syncFullscreenIcon(btn, settingsModalFullscreen);
    const label = settingsModalFullscreen ? 'Обычный размер (Alt+F)' : 'Полноэкранный режим (Alt+F)';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  const dlg = getSettingsDialogEl();
  if (settingsModalFullscreen) {
    dlg?.style.removeProperty('width');
    dlg?.style.removeProperty('height');
    persistLayoutPresetId('fullscreen');
  } else {
    applyStoredSettingsDialogSize();
    if (!readStoredSettingsDialogSize()) persistLayoutPresetId('standard');
  }
  syncSettingsDialogResizeChrome();
  syncSettingsLayoutPresetUi();
  try {
    localStorage.setItem(SETTINGS_FULLSCREEN_STORAGE_KEY, settingsModalFullscreen ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Переключить полноэкранный режим модалки настроек. */
export function toggleSettingsModalFullscreen() {
  const on = !document.getElementById('settings-modal')?.classList.contains('modal--fullscreen');
  setSettingsModalFullscreen(on);
}

/**
 * Применить пресет раскладки окна настроек.
 * @param {string} presetId
 * @param {{ persist?: boolean, toast?: boolean }} [opts]
 */
export function applySettingsLayoutPreset(presetId, opts = {}) {
  const { persist = true, toast = true } = opts;
  const preset = SETTINGS_LAYOUT_PRESETS[presetId];
  if (!preset) return;

  if (preset.fullscreen) {
    setSettingsModalFullscreen(true);
    if (persist) persistLayoutPresetId('fullscreen');
    syncSettingsLayoutPresetUi();
    if (toast) settingsLayoutToast?.('Окно на весь экран', 'neutral');
    return;
  }

  setSettingsModalFullscreen(false);

  if (preset.reset) {
    resetSettingsDialogSize();
  } else if (preset.w && preset.h) {
    const { w, h } = clampSettingsDialogSize(preset.w, preset.h);
    const dlg = getSettingsDialogEl();
    runWithSuppressedSettingsSizePersist(() => {
      if (dlg) {
        dlg.style.width = `${w}px`;
        dlg.style.height = `${h}px`;
        dlg.classList.add('settings-dialog--user-sized');
      }
    });
    try {
      localStorage.setItem(SETTINGS_SIZE_STORAGE_KEY, JSON.stringify({ w, h }));
    } catch {
      /* ignore */
    }
    if (persist) persistLayoutPresetId(presetId);
  }

  syncSettingsDialogResizeChrome();
  syncSettingsLayoutPresetUi();
  if (toast && presetId !== 'standard') {
    settingsLayoutToast?.(`Окно: ${preset.label}`, 'neutral');
  }
}

/**
 * Раскладка при открытии модалки (явный layout, «открывать на весь экран», сохранённый пресет).
 * @param {string} [explicitLayout]
 */
export function applySettingsOpenLayout(explicitLayout) {
  if (explicitLayout && SETTINGS_LAYOUT_PRESETS[explicitLayout]) {
    applySettingsLayoutPreset(explicitLayout, { toast: false });
    return;
  }
  try {
    if (localStorage.getItem(SETTINGS_OPEN_FULLSCREEN_STORAGE_KEY) === '1') {
      setSettingsModalFullscreen(true);
      return;
    }
  } catch {
    /* ignore */
  }
  let preferFullscreen = false;
  try {
    preferFullscreen = localStorage.getItem(SETTINGS_FULLSCREEN_STORAGE_KEY) === '1';
  } catch {
    /* ignore */
  }
  const stored = readStoredLayoutPresetId();
  if (preferFullscreen || stored === 'fullscreen') {
    setSettingsModalFullscreen(true);
    return;
  }
  if (stored && stored !== 'custom' && SETTINGS_LAYOUT_PRESETS[stored]?.w) {
    applySettingsLayoutPreset(stored, { toast: false });
    return;
  }
  applyStoredSettingsDialogSize();
  syncSettingsDialogResizeChrome();
  syncSettingsLayoutPresetUi();
}

/** Подогнать размер к viewport при открытии / изменении окна браузера. */
export function syncSettingsDialogLayoutOnOpen() {
  if (settingsModalFullscreen) {
    syncSettingsDialogResizeChrome();
    syncSettingsLayoutPresetUi();
    return;
  }
  const dlg = getSettingsDialogEl();
  const stored = readStoredSettingsDialogSize();
  if (!dlg || !stored) {
    syncSettingsDialogResizeChrome();
    syncSettingsLayoutPresetUi();
    return;
  }
  const curW = Math.round(dlg.getBoundingClientRect().width);
  const curH = Math.round(dlg.getBoundingClientRect().height);
  if (Math.abs(curW - stored.w) > 2 || Math.abs(curH - stored.h) > 2) {
    applyStoredSettingsDialogSize();
  }
  syncSettingsDialogResizeChrome();
  syncSettingsLayoutPresetUi();
}

function syncOpenFullscreenCheckbox() {
  const cb = document.getElementById('settings-modal-open-fullscreen');
  if (!cb) return;
  try {
    cb.checked = localStorage.getItem(SETTINGS_OPEN_FULLSCREEN_STORAGE_KEY) === '1';
  } catch {
    cb.checked = false;
  }
}

function initSettingsLayoutPresetControls() {
  document.querySelectorAll('[data-settings-layout-preset]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-settings-layout-preset');
      if (id) applySettingsLayoutPreset(id);
    });
  });

  const openFs = document.getElementById('settings-modal-open-fullscreen');
  openFs?.addEventListener('change', () => {
    try {
      localStorage.setItem(SETTINGS_OPEN_FULLSCREEN_STORAGE_KEY, openFs.checked ? '1' : '0');
    } catch {
      /* ignore */
    }
    settingsLayoutToast?.(
      openFs.checked ? 'Настройки будут открываться на весь экран' : 'Обычный размер при открытии',
      'good'
    );
  });
  syncOpenFullscreenCheckbox();
}

/**
 * @param {{ showToast?: (msg: string, variant?: string) => void }} [deps]
 */
export function initSettingsDialogLayout(deps) {
  settingsLayoutToast = deps?.showToast || null;

  migrateSettingsDialogSizeSchema();

  try {
    settingsModalFullscreen = localStorage.getItem(SETTINGS_FULLSCREEN_STORAGE_KEY) === '1';
  } catch {
    /* ignore */
  }

  const dlg = getSettingsDialogEl();
  if (dlg && typeof ResizeObserver !== 'undefined') {
    let persistTimer = 0;
    const ro = new ResizeObserver(() => {
      if (settingsModalFullscreen) return;
      clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => persistSettingsDialogSize(), 120);
    });
    ro.observe(dlg);
  }

  window.addEventListener('resize', () => {
    const modal = document.getElementById('settings-modal');
    if (!modal || modal.hidden) return;
    if (settingsModalFullscreen) return;
    const size = readStoredSettingsDialogSize();
    if (size) applyStoredSettingsDialogSize();
    syncSettingsDialogResizeChrome();
    syncSettingsLayoutPresetUi();
  });

  document.querySelector('.btn-settings-fullscreen')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSettingsModalFullscreen();
  });

  document.querySelector('.btn-settings-reset-size')?.addEventListener('click', (e) => {
    e.preventDefault();
    const wasFullscreen = document
      .getElementById('settings-modal')
      ?.classList.contains('modal--fullscreen');
    applySettingsLayoutPreset('standard', { toast: false });
    if (wasFullscreen) setSettingsModalFullscreen(true);
    settingsLayoutToast?.('Размер окна сброшен', 'good');
  });

  document
    .querySelector('#settings-modal .settings-dialog__head')
    ?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, textarea, [role="tab"]')) return;
      toggleSettingsModalFullscreen();
    });

  initSettingsLayoutPresetControls();
  applySettingsOpenLayout();
  syncSettingsLayoutPresetUi();
}
