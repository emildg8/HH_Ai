/**
 * Активный профиль HH (DevOps, custom, …) в preferences.json + применение env.
 */

import fs from 'fs';
import { PREFS_FILE } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';
import { loadProfile, listProfiles, resolveProfileId } from './load-profile.mjs';

export const PROFILE_PREF_KEY = 'hhActiveProfile';

/** @returns {string} */
export function getStoredProfileId() {
  try {
    const p = loadPreferences();
    const fromPrefs = String(p[PROFILE_PREF_KEY] || '').trim();
    if (fromPrefs) return fromPrefs;
  } catch {
    /* ignore */
  }
  return resolveProfileId();
}

/**
 * @param {string} profileId
 */
export function saveStoredProfileId(profileId) {
  const id = String(profileId || '').trim();
  if (!id) throw new Error('profileId пустой');
  const prefs = loadPreferences();
  prefs[PROFILE_PREF_KEY] = id;
  fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
}

/** @returns {{ id: string, envPath: string | null }} */
export function applyStoredProfile() {
  const id = getStoredProfileId();
  return loadProfile(id);
}

export { listProfiles };
