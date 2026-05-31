import fs from 'fs';
import { PREFS_FILE } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';
import {
  DEFAULT_UI_PREFS,
  LAYOUT_PRESETS,
  SIDEBAR_PANEL_ORDER_DEFAULT,
  SIDEBAR_PANELS,
  UI_MODES,
  SIDEBAR_LAYOUTS,
  normalizePanelSides,
} from './dashboard-ux.mjs';

/** Поля, которые можно менять из дашборда. */
export const DASHBOARD_PREF_KEYS = [
  'dashboardMinScoreFilter',
  'dashboardBatchSize',
  'hhApplyChatMaxPerHour',
  'hhApplyChatMaxPerDay',
  'hhApplyChatMaxPerMonth',
  'dashboardUiMode',
  'dashboardSidebarLayout',
  'dashboardSidebarPanels',
  'dashboardSidebarPanelOrder',
  'dashboardSidebarPanelSides',
];

/** @type {Record<string, { min: number, max: number }>} */
export const DASHBOARD_PREF_BOUNDS = {
  dashboardMinScoreFilter: { min: 0, max: 100 },
  dashboardBatchSize: { min: 1, max: 1000 },
  hhApplyChatMaxPerHour: { min: 1, max: 200 },
  hhApplyChatMaxPerDay: { min: 1, max: 1000 },
  hhApplyChatMaxPerMonth: { min: 1, max: 10000 },
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
  /** @type {Record<string, number | string | object>} */
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
