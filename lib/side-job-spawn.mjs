/**
 * Параметры spawn фоновых задач из preferences.json.
 */

import { loadPreferences } from './preferences.mjs';

/** @param {Record<string, unknown>} [prefs] */
export function hideSideJobConsole(prefs) {
  const p = prefs ?? safeLoadPrefs();
  return p.hideSideJobConsole !== false;
}

/** @param {Record<string, unknown>} [prefs] */
export function sideJobsHeadless(prefs) {
  const p = prefs ?? safeLoadPrefs();
  return p.sideJobsHeadless !== false;
}

function safeLoadPrefs() {
  try {
    return loadPreferences();
  } catch {
    return {};
  }
}

/** @param {Record<string, unknown>} [prefs] @param {Record<string, string>} [envPatch] */
export function sideJobHeadlessEnv(prefs, envPatch = {}) {
  const headless = sideJobsHeadless(prefs);
  return {
    ...process.env,
    HH_HEADLESS: headless ? '1' : '0',
    ...envPatch,
  };
}
