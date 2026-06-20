/**
 * Серверное хранилище настроек.
 */

import fs from 'fs';
import { loadPreferences } from './preferences.mjs';
import { PREFS_FILE } from './paths.mjs';
import {
  patchDashboardPreferences,
  getDashboardUiConfig,
  DASHBOARD_PREF_BOUNDS,
  ensureLegacySidebarPrefsMigrated,
} from './dashboard-preferences.mjs';
import { expandDotPatch, flattenObjectPaths, getAtPath } from './settings-paths.mjs';
import { validateSettingsPatch, getRegistryMetaForClient } from './settings-registry.mjs';
import { listConversionPresetsForClient } from './conversion-presets.mjs';
import { applyRateLimitsSnapshot } from './hh-apply-rate.mjs';
import { getStoredProfileId, listProfiles } from './profile-prefs.mjs';
import { getSystemSetupStatus } from './system-setup-status.mjs';
import {
  normalizePlaywrightDisplayMode,
  PLAYWRIGHT_DISPLAY_MODE_OPTIONS,
} from './playwright-display-mode.mjs';

const EXTRA_NUMERIC_KEYS = new Set([
  'batchLetterMinScore10',
  'batchLetterMaxAiScore',
  'ingestMaxTierCPerDay',
  'minKeywordGapScore',
  'resumeEditMaxPerDay',
]);

const EXTRA_NUMERIC_BOUNDS = {
  batchLetterMinScore10: { min: 1, max: 10 },
  batchLetterMaxAiScore: { min: 0, max: 100 },
  ingestMaxTierCPerDay: { min: 0, max: 500 },
  minKeywordGapScore: { min: 0, max: 100 },
  resumeEditMaxPerDay: { min: 0, max: 100 },
};

const PATTERN_ARRAY_KEYS = new Set([
  'remotePositivePatterns',
  'hybridPatterns',
  'officeOnlyPatterns',
  'excludeSeniorRolePatterns',
  'exclude1CRolePatterns',
  'excludeDeveloperRolePatterns',
  'excludeIrrelevantTitlePatterns',
]);

const EXTRA_BOOL_KEYS = new Set(['letterHumanizeTwoPass', 'marketSkillsEnabled']);

export function normalizeSettingsPatchInput(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const src = /** @type {Record<string, unknown>} */ (raw);
  if (src.patch && typeof src.patch === 'object' && !Array.isArray(src.patch)) {
    return { ...src.patch };
  }
  return { ...src };
}

function applyExtraPreferenceKeys(nested, prefs, updated) {
  for (const key of EXTRA_BOOL_KEYS) {
    if (!(key in nested)) continue;
    prefs[key] = nested[key] === true;
    updated[key] = prefs[key];
  }
  for (const key of EXTRA_NUMERIC_KEYS) {
    if (!(key in nested)) continue;
    const bounds = EXTRA_NUMERIC_BOUNDS[key];
    const n = Math.floor(Number(nested[key]));
    if (!Number.isFinite(n) || !bounds) continue;
    const v = Math.min(bounds.max, Math.max(bounds.min, n));
    prefs[key] = v;
    updated[key] = v;
  }
  for (const key of PATTERN_ARRAY_KEYS) {
    if (!(key in nested)) continue;
    const arr = nested[key];
    if (!Array.isArray(arr)) continue;
    const v = arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    prefs[key] = v;
    updated[key] = v;
  }
  if (nested.llmScoreWeights && typeof nested.llmScoreWeights === 'object') {
    const w = nested.llmScoreWeights;
    const vacancy = Number(w.vacancy);
    const cvMatch = Number(w.cvMatch);
    if (Number.isFinite(vacancy) && Number.isFinite(cvMatch)) {
      const sum = vacancy + cvMatch;
      const norm =
        sum > 0
          ? { vacancy: vacancy / sum, cvMatch: cvMatch / sum }
          : { vacancy: 0.45, cvMatch: 0.55 };
      prefs.llmScoreWeights = norm;
      updated.llmScoreWeights = norm;
    }
  }
}

function applyConversionPreferenceKeys(nested, prefs, updated) {
  if ('conversionGlueEnabled' in nested) {
    prefs.conversionGlueEnabled = nested.conversionGlueEnabled !== false;
    updated.conversionGlueEnabled = prefs.conversionGlueEnabled;
  }
  if (nested.observability && typeof nested.observability === 'object') {
    prefs.observability = { ...(prefs.observability || {}), ...nested.observability };
    updated.observability = prefs.observability;
  }
  if (nested.applyIntelligence && typeof nested.applyIntelligence === 'object') {
    const ai = { ...(prefs.applyIntelligence || {}), ...nested.applyIntelligence };
    if (nested.applyIntelligence.weights && typeof nested.applyIntelligence.weights === 'object') {
      ai.weights = { ...(prefs.applyIntelligence?.weights || {}), ...nested.applyIntelligence.weights };
    }
    if (Array.isArray(nested.applyIntelligence.dreamEmployers)) {
      ai.dreamEmployers = nested.applyIntelligence.dreamEmployers
        .map((x) => String(x).trim())
        .filter(Boolean);
    }
    prefs.applyIntelligence = ai;
    updated.applyIntelligence = ai;
  }
}

/**
 * Вложенный patch из UI → плоские dot-path для registry.
 * @param {Record<string, unknown>} raw
 */
export function flattenSettingsPatch(raw) {
  /** @type {Record<string, unknown>} */
  const flat = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      const paths = flattenObjectPaths(v, k);
      if (paths.some((p) => p.includes('.'))) {
        for (const p of paths) {
          flat[p] = getAtPath(raw, p);
        }
        continue;
      }
    }
    flat[k] = v;
  }
  return flat;
}

export function patchSettings(patch) {
  const raw = normalizeSettingsPatchInput(patch);
  const flat = flattenSettingsPatch(raw);
  const validation = validateSettingsPatch(flat);
  if (!validation.ok) throw new Error(validation.errors.join('; '));

  const nested = expandDotPatch(flat);
  const { preferences, updated, ui } = patchDashboardPreferences(nested);
  applyExtraPreferenceKeys(nested, preferences, updated);
  applyConversionPreferenceKeys(nested, preferences, updated);

  if (Object.keys(updated).length > 0) {
    fs.writeFileSync(PREFS_FILE, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
  }

  return { preferences, updated, ui: ui || getDashboardUiConfig(preferences) };
}

export function getSettingsSnapshot() {
  const p = ensureLegacySidebarPrefsMigrated(loadPreferences());
  return {
    preferences: p,
    bounds: DASHBOARD_PREF_BOUNDS,
    registry: getRegistryMetaForClient(),
    ui: getDashboardUiConfig(p),
    applyRates: applyRateLimitsSnapshot(),
    activeProfile: getStoredProfileId(),
    profiles: listProfiles(),
    queuePath: process.env.HH_VACANCIES_QUEUE_FILE || 'data/vacancies-devops.json',
    playwrightDisplay: {
      mode: normalizePlaywrightDisplayMode(p.dashboardPlaywrightDisplayMode),
      options: PLAYWRIGHT_DISPLAY_MODE_OPTIONS,
    },
    systemStatus: getSystemSetupStatus(),
    conversionPresets: listConversionPresetsForClient(),
    apiFeatures: { preferencesSave: true, profileSelect: true, settingsApi: true },
  };
}
