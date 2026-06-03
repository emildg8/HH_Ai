import fs from 'fs';
import path from 'path';
import { PREFS_FILE } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';
import {
  DEFAULT_UI_PREFS,
  DEPRECATED_SIDEBAR_PANEL_IDS,
  LAYOUT_PRESETS,
  SIDEBAR_PANEL_ORDER_DEFAULT,
  SIDEBAR_PANELS,
  UI_MODES,
  SIDEBAR_LAYOUTS,
  normalizePanelSides,
} from './dashboard-ux.mjs';
import { normalizePlaywrightDisplayMode } from './playwright-display-mode.mjs';

/** Поля, которые можно менять из дашборда. */
export const DASHBOARD_PREF_KEYS = [
  'dashboardMinScoreFilter',
  'dashboardBatchSize',
  'hhApplyChatMaxPerHour',
  'hhApplyChatMaxPerDay',
  'hhApplyChatMaxPerMonth',
  'batchRequireRemote',
  'batchAutoPrepareLetters',
  'batchLetterRequireMetric',
  'batchAutoApproveBestLetter',
  'batchFalsePositiveMax',
  'learningAutoApplyPatterns',
  'learningAutoApplyMinCount',
  'dashboardUiMode',
  'dashboardSidebarLayout',
  'dashboardSidebarPanels',
  'dashboardSidebarPanelOrder',
  'dashboardSidebarPanelSides',
  'dashboardPlaywrightDisplayMode',
  // eligibility / harvest targeting (config/preferences.json)
  'requireRemote',
  'allowHybrid',
  'allowOfficeMoscow',
  'hybridMoscowOnly',
  'blockSpokenEnglishRequired',
  'blockNightShiftOnly',
  'allowUnknownSalary',
  'excludeSeniorRoles',
  'exclude1CRoles',
  'excludeDeveloperRoles',
  'excludeIrrelevantTitles',
  'minMonthlyRub',
  'targetMonthlyRub',
  'maxMonthlyRubSearch',
];

/** Булевы prefs: по умолчанию true, если ключ отсутствует. */
const PREF_BOOL_TRUE_DEFAULT = new Set([
  'allowHybrid',
  'allowOfficeMoscow',
  'hybridMoscowOnly',
  'blockSpokenEnglishRequired',
  'blockNightShiftOnly',
  'allowUnknownSalary',
  'excludeSeniorRoles',
  'exclude1CRoles',
  'excludeDeveloperRoles',
  'excludeIrrelevantTitles',
  'batchAutoPrepareLetters',
]);

/** Булевы prefs: по умолчанию false. */
const PREF_BOOL_FALSE_DEFAULT = new Set([
  'requireRemote',
  'batchRequireRemote',
  'batchLetterRequireMetric',
  'batchAutoApproveBestLetter',
  'learningAutoApplyPatterns',
]);

/** @param {string} key @param {unknown} value */
export function normalizeDashboardBoolPref(key, value) {
  if (PREF_BOOL_TRUE_DEFAULT.has(key)) return value !== false;
  if (PREF_BOOL_FALSE_DEFAULT.has(key)) return value === true;
  return Boolean(value);
}

/** @type {Record<string, { min: number, max: number }>} */
export const DASHBOARD_PREF_BOUNDS = {
  dashboardMinScoreFilter: { min: 0, max: 100 },
  dashboardBatchSize: { min: 1, max: 1000 },
  hhApplyChatMaxPerHour: { min: 1, max: 200 },
  hhApplyChatMaxPerDay: { min: 1, max: 1000 },
  hhApplyChatMaxPerMonth: { min: 1, max: 10000 },
  batchFalsePositiveMax: { min: 0, max: 500 },
  learningAutoApplyMinCount: { min: 2, max: 20 },
  minMonthlyRub: { min: 0, max: 2_000_000 },
  targetMonthlyRub: { min: 0, max: 2_000_000 },
  maxMonthlyRubSearch: { min: 0, max: 5_000_000 },
};

/**
 * @param {string} key
 * @param {unknown} value
 */
export function clampDashboardPref(key, value) {
  const bounds = DASHBOARD_PREF_BOUNDS[key];
  if (!bounds) return undefined;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

/** @param {unknown} raw */
export function normalizeUiMode(raw) {
  const s = String(raw || '').trim();
  return s === UI_MODES.expert ? UI_MODES.expert : UI_MODES.simple;
}

/** @param {unknown} raw */
export function normalizeSidebarLayout(raw) {
  const s = String(raw || '').trim();
  return s === SIDEBAR_LAYOUTS.full ? SIDEBAR_LAYOUTS.full : SIDEBAR_LAYOUTS.compact;
}

/** @param {unknown} raw */
export function normalizeSidebarPanels(raw) {
  const base = { ...DEFAULT_UI_PREFS.panels };
  if (!raw || typeof raw !== 'object') return base;
  for (const id of Object.keys(SIDEBAR_PANELS)) {
    if (typeof raw[id] === 'boolean') base[id] = raw[id];
  }
  return base;
}

/** @param {Record<string, unknown>} prefs */
export function migrateLegacySidebarPrefs(prefs) {
  let migrated = false;
  const deprecated = new Set(DEPRECATED_SIDEBAR_PANEL_IDS);

  if (prefs.dashboardSidebarPanels && typeof prefs.dashboardSidebarPanels === 'object') {
    for (const id of deprecated) {
      if (id in prefs.dashboardSidebarPanels) {
        delete prefs.dashboardSidebarPanels[id];
        migrated = true;
      }
    }
  }

  if (Array.isArray(prefs.dashboardSidebarPanelOrder)) {
    const next = prefs.dashboardSidebarPanelOrder.filter((id) => !deprecated.has(String(id)));
    if (next.length !== prefs.dashboardSidebarPanelOrder.length) {
      prefs.dashboardSidebarPanelOrder = next;
      migrated = true;
    }
  }

  if (prefs.dashboardSidebarPanelSides && typeof prefs.dashboardSidebarPanelSides === 'object') {
    for (const id of deprecated) {
      if (id in prefs.dashboardSidebarPanelSides) {
        delete prefs.dashboardSidebarPanelSides[id];
        migrated = true;
      }
    }
  }

  return migrated;
}

/** @param {Record<string, unknown>} [prefs] */
export function ensureLegacySidebarPrefsMigrated(prefs = loadPreferences()) {
  if (!migrateLegacySidebarPrefs(prefs)) return prefs;
  fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
  return prefs;
}

/** @param {unknown} raw */
export function normalizePanelOrder(raw) {
  const allowed = new Set(Object.keys(SIDEBAR_PANELS));
  const order = Array.isArray(raw)
    ? raw.map((x) => String(x)).filter((id) => allowed.has(id))
    : [];
  const seen = new Set(order);
  for (const id of SIDEBAR_PANEL_ORDER_DEFAULT) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

/** @returns {import('./dashboard-ux.mjs').DEFAULT_UI_PREFS & Record<string, unknown>} */
export function getDashboardUiConfig(prefs = loadPreferences()) {
  return {
    uiMode: normalizeUiMode(prefs.dashboardUiMode ?? DEFAULT_UI_PREFS.uiMode),
    sidebarMode: normalizeSidebarLayout(
      prefs.dashboardSidebarLayout ?? DEFAULT_UI_PREFS.sidebarMode
    ),
    panels: normalizeSidebarPanels(prefs.dashboardSidebarPanels),
    panelOrder: normalizePanelOrder(
      prefs.dashboardSidebarPanelOrder ?? DEFAULT_UI_PREFS.panelOrder
    ),
    panelSides: normalizePanelSides(prefs.dashboardSidebarPanelSides),
  };
}

/** @param {string} name */
export function applyLayoutPreset(name) {
  const preset = LAYOUT_PRESETS[name];
  if (!preset) return null;
  return patchDashboardPreferences({
    dashboardUiMode: preset.uiMode,
    dashboardSidebarLayout: preset.sidebarMode,
    dashboardSidebarPanels: preset.panels,
    dashboardSidebarPanelOrder: SIDEBAR_PANEL_ORDER_DEFAULT,
  });
}

/**
 * @param {Record<string, unknown>} patch
 */
export function patchDashboardPreferences(patch) {
  const prefs = loadPreferences();
  /** @type {Record<string, number | string | boolean | object>} */
  const updated = {};

  for (const key of DASHBOARD_PREF_KEYS) {
    if (!(key in patch)) continue;

    if (key === 'dashboardUiMode') {
      const v = normalizeUiMode(patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }
    if (key === 'dashboardSidebarLayout') {
      const v = normalizeSidebarLayout(patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }
    if (key === 'dashboardSidebarPanels') {
      const v = normalizeSidebarPanels(patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }
    if (key === 'dashboardSidebarPanelOrder') {
      const v = normalizePanelOrder(patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }
    if (key === 'dashboardSidebarPanelSides') {
      const v = normalizePanelSides(patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }
    if (key === 'dashboardPlaywrightDisplayMode') {
      const v = normalizePlaywrightDisplayMode(patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }
    if (
      PREF_BOOL_TRUE_DEFAULT.has(key) ||
      PREF_BOOL_FALSE_DEFAULT.has(key)
    ) {
      const v = normalizeDashboardBoolPref(key, patch[key]);
      prefs[key] = v;
      updated[key] = v;
      continue;
    }

    const clamped = clampDashboardPref(key, patch[key]);
    if (clamped === undefined) continue;
    prefs[key] = clamped;
    updated[key] = clamped;
  }

  fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
  return { preferences: prefs, updated, ui: getDashboardUiConfig(prefs) };
}

export function getDashboardBatchSizeCap() {
  try {
    const n = clampDashboardPref('dashboardBatchSize', loadPreferences().dashboardBatchSize);
    if (n !== undefined) return n;
  } catch {
    /* ignore */
  }
  return 10;
}

/** @param {Record<string, unknown>} [prefs] */
/** Копия preferences.json перед деструктивным импортом. @returns {string|null} путь к бэкапу */
export function backupPreferencesFile() {
  if (!fs.existsSync(PREFS_FILE)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(path.dirname(PREFS_FILE), `preferences.backup.${stamp}.json`);
  fs.copyFileSync(PREFS_FILE, dest);
  return dest;
}

/** @param {Record<string, unknown>} [prefs] */
export function pickDashboardPrefsExport(prefs = loadPreferences()) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const key of DASHBOARD_PREF_KEYS) {
    if (key in prefs) patch[key] = prefs[key];
  }
  return patch;
}

/**
 * Оставляет только разрешённые ключи дашборда (для импорта из JSON).
 * @param {unknown} raw
 */
export function sanitizeDashboardPrefsImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = /** @type {Record<string, unknown>} */ (raw);
  const nested =
    src.patch && typeof src.patch === 'object' && !Array.isArray(src.patch)
      ? /** @type {Record<string, unknown>} */ (src.patch)
      : src.preferences && typeof src.preferences === 'object'
        ? /** @type {Record<string, unknown>} */ (src.preferences)
        : src;
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const key of DASHBOARD_PREF_KEYS) {
    if (key in nested) patch[key] = nested[key];
  }
  return Object.keys(patch).length ? patch : null;
}
