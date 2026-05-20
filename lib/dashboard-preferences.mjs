import fs from 'fs';
import { PREFS_FILE } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';

/** Поля, которые можно менять из дашборда. */
export const DASHBOARD_PREF_KEYS = [
  'dashboardMinScoreFilter',
  'dashboardBatchSize',
  'hhApplyChatMaxPerHour',
  'hhApplyChatMaxPerDay',
  'hhApplyChatMaxPerMonth',
];

/** @type {Record<string, { min: number, max: number }>} */
export const DASHBOARD_PREF_BOUNDS = {
  dashboardMinScoreFilter: { min: 0, max: 100 },
  dashboardBatchSize: { min: 1, max: 100 },
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

/**
 * @param {Record<string, unknown>} patch
 */
export function patchDashboardPreferences(patch) {
  const prefs = loadPreferences();
  /** @type {Record<string, number>} */
  const updated = {};
  for (const key of DASHBOARD_PREF_KEYS) {
    if (!(key in patch)) continue;
    const clamped = clampDashboardPref(key, patch[key]);
    if (clamped === undefined) continue;
    prefs[key] = clamped;
    updated[key] = clamped;
  }
  fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
  return { preferences: prefs, updated };
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
