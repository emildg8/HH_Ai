/**
 *   node scripts/test-settings-registry.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coverageReportForPreferences,
  getAllSettingEntries,
  getExportableFilePaths,
  getSettingMeta,
  isAcceptableMissingPath,
  loadCanonicalPreferencePaths,
  normalizeSettingsZone,
  SETTINGS_ZONE_IDS,
  validateSettingsPatch,
} from '../lib/settings-registry.mjs';
import { patchSettings } from '../lib/settings-store.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefsPath = path.join(root, 'config', 'preferences.json');
const backup = fs.readFileSync(prefsPath, 'utf8');

assert.ok(SETTINGS_ZONE_IDS.includes('teleprompter'));
assert.equal(normalizeSettingsZone('copilot'), 'teleprompter');

const paths = loadCanonicalPreferencePaths();
const report = coverageReportForPreferences(JSON.parse(backup));
const unregistered = report.missing.filter((p) => !isAcceptableMissingPath(p));
assert.equal(unregistered.length, 0, `Без реестра: ${unregistered.join(', ')}`);

assert.equal(getSettingMeta('interviewCopilot.micDevice')?.zone, 'teleprompter');
assert.equal(validateSettingsPatch({ 'interviewCopilot.micDevice': 'audio=Test' }).ok, true);
assert.ok(getExportableFilePaths().some((p) => p.startsWith('interviewCopilot.')));
assert.ok(getAllSettingEntries().length >= 55);

try {
  const { preferences } = patchSettings({ 'interviewCopilot.micDevice': 'audio=RegistryTest' });
  assert.equal(preferences.interviewCopilot?.micDevice, 'audio=RegistryTest');
} finally {
  fs.writeFileSync(prefsPath, backup, 'utf8');
}

console.log(`OK: test-settings-registry (${paths.length} JSON, ${getAllSettingEntries().length} реестр)`);
