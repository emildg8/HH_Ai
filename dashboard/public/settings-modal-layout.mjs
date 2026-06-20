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

export const SETTINGS_DIALOG_DEFAULT = { w: 1120, h: 860 };
export const SETTINGS_DIALOG_MIN = { w: 840, h: 560 };
export const SETTINGS_DIALOG_MAX_W = 1152;
export const SETTINGS_SIZE_SCHEMA_VERSION = 4;

/** @type {Record<string, { label: string, w?: number, h?: number, reset?: boolean, fullscreen?: boolean }>} */
export const SETTINGS_LAYOUT_PRESETS = {
  compact: { label: 'Компакт', w: 900, h: 680 },
  standard: { label: 'Стандарт', w: 1120, h: 860 },
  wide: { label: 'Широкое', w: 1152, h: 800 },
  fullscreen: { label: 'На весь экран', fullscreen: true },
};

let settingsModalFullscreen = false;
let suppressSettingsSizePersist = 0;
let suppressSettingsDialogLayoutSync = 0;
let settingsBodyScrollLockDepth = 0;
/** @type {((msg: string, variant?: string) => void) | null} */
let settingsLayoutToast = null;

/** @returns {HTMLElement | null} */
export function getSettingsDialogEl() {
  return document.querySelector('#settings-modal .settings-dialog--v5, #settings-modal .settings-dialog--v4');
}

/** @param {number} w @param {number} h */
export function clampSettingsDialogSize(w, h) {
  const maxW = Math.min(
    SETTINGS_DIALOG_MAX_W,
    Math.max(SETTINGS_DIALOG_MIN.w, Math.floor(window.innerWidth - 16))
  );
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
    const raw = localStorage.getItem(SETTINGS_SIZE_STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      const w = Number(o?.w);
      const h = Number(o?.h);
      if (Number.isFinite(w) && Number.isFinite(h)) {
        localStorage.setItem(SETTINGS_SIZE_STORAGE_KEY, JSON.stringify(clampSettingsDialogSize(w, h)));
      } else {
        localStorage.removeItem(SETTINGS_SIZE_STORAGE_KEY);
      }
    }
    if (v < 3) localStorage.removeItem(SETTINGS_LAYOUT_PRESET_STORAGE_KEY);
    localStorage.setItem(SETTINGS_SIZE_SCHEMA_STORAGE_KEY, String(SETTINGS_SIZE_SCHEMA_VERSION));
  } catch {
    /* ignore */
  }
}

/** @param {HTMLElement} dlg @param {number} w @param {number} h */
function paintSettingsDialogSize(dlg, w, h) {
  const { w: cw, h: ch } = clampSettingsDialogSize(w, h);
  dlg.style.removeProperty('width');
  dlg.style.removeProperty('height');
  dlg.style.removeProperty('max-width');
  dlg.style.removeProperty('max-height');
  dlg.style.setProperty('--hh-settings-dialog-w', `${cw}px`);
  dlg.style.setProperty('--hh-settings-dialog-h', `${ch}px`);
  dlg.classList.add('settings-dialog--user-sized');
}

/** @param {HTMLElement} dlg */
function clearSettingsDialogInlineSize(dlg) {
  dlg.style.removeProperty('width');
  dlg.style.removeProperty('height');
  dlg.style.removeProperty('max-width');
  dlg.style.removeProperty('max-height');
  dlg.style.removeProperty('--hh-settings-dialog-w');
  dlg.style.removeProperty('--hh-settings-dialog-h');
  dlg.classList.remove('settings-dialog--user-sized');
}

/** Поджать фактический размер диалога к лимитам (resize / устаревший localStorage). */
export function enforceSettingsDialogBounds() {
  if (settingsModalFullscreen) return;
  const dlg = getSettingsDialogEl();
  if (!dlg) return;
  const rect = dlg.getBoundingClientRect();
  const cssW = Number.parseInt(getComputedStyle(dlg).getPropertyValue('--hh-settings-dialog-w'), 10);
  const needsClamp =
    Math.round(rect.width) > SETTINGS_DIALOG_MAX_W + 2 ||
    (Number.isFinite(cssW) && cssW > SETTINGS_DIALOG_MAX_W);
  if (!needsClamp) return;
  const { w, h } = readDialogSizeForPersist(dlg);
  paintSettingsDialogSize(dlg, w, h);
}

/** Восстановить нормальный размер, если диалог схлопнулся до открытия/анимации. */
function ensureSettingsDialogLayout() {
  if (settingsModalFullscreen) return;
  const dlg = getSettingsDialogEl();
  if (!dlg) return;
  const fix = () => {
    const rect = dlg.getBoundingClientRect();
    const w = Math.round(rect.width);
    const offscreen = rect.left < -4 || rect.right > window.innerWidth + 4;
    if (offscreen || w < SETTINGS_DIALOG_MIN.w) {
      const stored = readStoredSettingsDialogSize();
      if (stored) {
        paintSettingsDialogSize(dlg, stored.w, stored.h);
      } else {
        paintSettingsDialogSize(dlg, SETTINGS_DIALOG_DEFAULT.w, SETTINGS_DIALOG_DEFAULT.h);
      }
    }
    enforceSettingsDialogBounds();
  };
  fix();
  requestAnimationFrame(() => requestAnimationFrame(fix));
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

/** @returns {number} */
export function getSettingsDialogWidth() {
  const dlg = getSettingsDialogEl();
  return dlg ? dlg.getBoundingClientRect().width : 0;
}

/** @returns {boolean} */
export function isSettingsDialogNarrow() {
  const w = getSettingsDialogWidth();
  if (w > 0) return w <= 640;
  return window.matchMedia('(max-width: 640px)').matches;
}

export function syncSettingsDialogResizeChrome() {
  const dlg = getSettingsDialogEl();
  if (!dlg) return;
  const resizable = !settingsModalFullscreen && !isSettingsDialogNarrow();
  dlg.classList.toggle('settings-dialog--resizable', resizable);
}

/** @param {() => void} fn @param {number} [holdMs] */
export function runWithSuppressedSettingsSizePersist(fn, holdMs = 450) {
  suppressSettingsSizePersist += 1;
  try {
    fn();
  } finally {
    window.setTimeout(() => {
      suppressSettingsSizePersist = Math.max(0, suppressSettingsSizePersist - 1);
    }, holdMs);
  }
}

/** @returns {boolean} */
export function isSettingsDialogLayoutSyncSuppressed() {
  return suppressSettingsDialogLayoutSync > 0;
}

/** @param {() => void} fn @param {number} [holdMs] */
export function runWithSuppressedSettingsDialogLayoutSync(fn, holdMs = 450) {
  suppressSettingsDialogLayoutSync += 1;
  try {
    fn();
  } finally {
    window.setTimeout(() => {
      suppressSettingsDialogLayoutSync = Math.max(0, suppressSettingsDialogLayoutSync - 1);
    }, holdMs);
  }
}

/** Без persist размера и без пересчёта shell при смене контента внутри модалки. */
export function runWithStableSettingsDialogLayout(fn, holdMs = 450) {
  suppressSettingsSizePersist += 1;
  suppressSettingsDialogLayoutSync += 1;
  try {
    fn();
  } finally {
    window.setTimeout(() => {
      suppressSettingsSizePersist = Math.max(0, suppressSettingsSizePersist - 1);
      suppressSettingsDialogLayoutSync = Math.max(0, suppressSettingsDialogLayoutSync - 1);
    }, holdMs);
  }
}

export function lockBodyScrollForSettings() {
  if (settingsBodyScrollLockDepth === 0) {
    document.documentElement.classList.add('hh-settings-modal-open');
    document.body.classList.add('hh-settings-modal-open');
    document.getElementById('app-shell')?.classList.add('hh-settings-modal-open');
  }
  settingsBodyScrollLockDepth += 1;
}

export function unlockBodyScrollForSettings() {
  if (settingsBodyScrollLockDepth <= 0) return;
  settingsBodyScrollLockDepth -= 1;
  if (settingsBodyScrollLockDepth === 0) {
    document.documentElement.classList.remove('hh-settings-modal-open');
    document.body.classList.remove('hh-settings-modal-open');
    document.getElementById('app-shell')?.classList.remove('hh-settings-modal-open');
  }
}

function bindSettingsDialogUserResizePersist(dlg) {
  const HANDLE_PX = 18;
  let userResizing = false;
  dlg.addEventListener(
    'pointerdown',
    (e) => {
      if (!dlg.classList.contains('settings-dialog--resizable')) return;
      const r = dlg.getBoundingClientRect();
      if (e.clientX >= r.right - HANDLE_PX && e.clientY >= r.bottom - HANDLE_PX) {
        userResizing = true;
      }
    },
    true
  );
  window.addEventListener('pointerup', () => {
    if (!userResizing) return;
    userResizing = false;
    const dlg = getSettingsDialogEl();
    if (dlg) {
      const { w, h } = readDialogSizeForPersist(dlg);
      runWithSuppressedSettingsSizePersist(() => paintSettingsDialogSize(dlg, w, h));
    }
    persistSettingsDialogSize();
    window.dispatchEvent(new CustomEvent('hh-settings-dialog-resize'));
  });
}

function applyStoredSettingsDialogSize() {
  if (settingsModalFullscreen) return;
  const dlg = getSettingsDialogEl();
  const size = readStoredSettingsDialogSize();
  if (!dlg || !size) return;
  runWithSuppressedSettingsSizePersist(() => paintSettingsDialogSize(dlg, size.w, size.h));
}

function readDialogSizeForPersist(dlg) {
  const rect = dlg.getBoundingClientRect();
  const cssW = Number.parseInt(getComputedStyle(dlg).getPropertyValue('--hh-settings-dialog-w'), 10);
  const cssH = Number.parseInt(getComputedStyle(dlg).getPropertyValue('--hh-settings-dialog-h'), 10);
  const styledW = Number.parseInt(dlg.style.width, 10);
  const styledH = Number.parseInt(dlg.style.height, 10);
  let w = Number.isFinite(cssW) && cssW > 0 ? cssW : styledW;
  let h = Number.isFinite(cssH) && cssH > 0 ? cssH : styledH;
  if (!dlg.classList.contains('settings-dialog--user-sized') || !Number.isFinite(w) || w <= 0) {
    w = Math.round(rect.width);
  }
  if (!dlg.classList.contains('settings-dialog--user-sized') || !Number.isFinite(h) || h <= 0) {
    h = Math.round(rect.height);
  }
  if (!Number.isFinite(w) || w < SETTINGS_DIALOG_MIN.w) {
    w = SETTINGS_DIALOG_DEFAULT.w;
  }
  if (!Number.isFinite(h) || h < SETTINGS_DIALOG_MIN.h) {
    h = SETTINGS_DIALOG_DEFAULT.h;
  }
  return clampSettingsDialogSize(w, h);
}

function persistSettingsDialogSize() {
  if (suppressSettingsSizePersist > 0 || settingsModalFullscreen) return;
  if (isSettingsDialogNarrow()) return;
  const dlg = getSettingsDialogEl();
  if (!dlg) return;
  const { w, h } = readDialogSizeForPersist(dlg);
  runWithSuppressedSettingsSizePersist(() => paintSettingsDialogSize(dlg, w, h));
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
    if (dlg) clearSettingsDialogInlineSize(dlg);
    if (dlg) paintSettingsDialogSize(dlg, SETTINGS_DIALOG_DEFAULT.w, SETTINGS_DIALOG_DEFAULT.h);
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
    if (dlg) clearSettingsDialogInlineSize(dlg);
    if (dlg) paintSettingsDialogSize(dlg, SETTINGS_DIALOG_DEFAULT.w, SETTINGS_DIALOG_DEFAULT.h);
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
    if (dlg) clearSettingsDialogInlineSize(dlg);
    persistLayoutPresetId('fullscreen');
  } else {
    const stored = readStoredSettingsDialogSize();
    if (stored) applyStoredSettingsDialogSize();
    else if (!readStoredLayoutPresetId()) persistLayoutPresetId('standard');
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
      if (dlg) paintSettingsDialogSize(dlg, w, h);
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
  window.dispatchEvent(new CustomEvent('hh-settings-dialog-resize'));
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
  const storedSize = readStoredSettingsDialogSize();
  if (storedSize) {
    applyStoredSettingsDialogSize();
  } else {
    applySettingsLayoutPreset('standard', { persist: false, toast: false });
  }
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
  if (dlg && stored) {
    const curW = Math.round(dlg.getBoundingClientRect().width);
    const curH = Math.round(dlg.getBoundingClientRect().height);
    if (Math.abs(curW - stored.w) > 2 || Math.abs(curH - stored.h) > 2) {
      applyStoredSettingsDialogSize();
    }
  }
  ensureSettingsDialogLayout();
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

let settingsLayoutPresetControlsBound = false;

function initSettingsLayoutPresetControls() {
  if (settingsLayoutPresetControlsBound) return;
  settingsLayoutPresetControlsBound = true;
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
  if (dlg) {
    const legacyW = Number.parseInt(dlg.style.width, 10);
    const legacyH = Number.parseInt(dlg.style.height, 10);
    if (Number.isFinite(legacyW) && legacyW > 0 && Number.isFinite(legacyH) && legacyH > 0) {
      paintSettingsDialogSize(dlg, legacyW, legacyH);
    }
    bindSettingsDialogUserResizePersist(dlg);
  }

  window.addEventListener('resize', () => {
    const modal = document.getElementById('settings-modal');
    if (!modal || modal.hidden) return;
    if (settingsModalFullscreen) return;
    const size = readStoredSettingsDialogSize();
    if (size) applyStoredSettingsDialogSize();
    enforceSettingsDialogBounds();
    syncSettingsDialogResizeChrome();
    syncSettingsLayoutPresetUi();
    window.dispatchEvent(new CustomEvent('hh-settings-dialog-resize'));
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
  window.hhEnforceSettingsDialogBounds = enforceSettingsDialogBounds;
}
