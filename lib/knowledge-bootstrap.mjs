/**
 * Старт Knowledge Store при включённой настройке (без dual-write).
 */

import { loadPreferences } from './preferences.mjs';
import { initKnowledgeStore } from './knowledge-store.mjs';
import { getStoredProfileId } from './profile-prefs.mjs';

/** @returns {{ schemaVersion: number, dbPath: string | null } | null} */
export function bootstrapKnowledgeStoreIfEnabled() {
  try {
    const prefs = loadPreferences();
    if (!prefs?.applyIntelligence?.knowledgeStoreEnabled) return null;
    const profileId = getStoredProfileId();
    return initKnowledgeStore({ profileId: profileId || undefined });
  } catch (e) {
    console.warn('[knowledge] init skipped:', e instanceof Error ? e.message : e);
    return null;
  }
}
