/**
 * PATCH настроек: вложенный applyIntelligence → dot-path.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenSettingsPatch, patchSettings } from '../lib/settings-store.mjs';
import { CONVERSION_PRESETS } from '../lib/conversion-presets.mjs';

const flat = flattenSettingsPatch({
  applyIntelligence: { enabled: true, minGateScore: 70, minGateScoreDream: 55 },
  dashboardMinScoreFilter: 55,
});
assert.equal(flat['applyIntelligence.enabled'], true);
assert.equal(flat['applyIntelligence.minGateScore'], 70);
assert.equal(flat.dashboardMinScoreFilter, 55);

const nested = {
  applyIntelligence: { enabled: true, minGateScore: 70 },
  batchLetterMinScore10: 8,
};
const fromUi = flattenSettingsPatch(nested);
assert.equal(fromUi['applyIntelligence.minGateScore'], 70);
assert.equal(fromUi.batchLetterMinScore10, 8);

const qualityNested = {};
for (const [k, v] of Object.entries(CONVERSION_PRESETS.quality.patch)) {
  if (k.includes('.')) {
    const parts = k.split('.');
    let cur = qualityNested;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  } else {
    qualityNested[k] = v;
  }
}
const qualityFlat = flattenSettingsPatch(qualityNested);
assert.equal(qualityFlat['applyIntelligence.minGateScore'], 70);
assert.equal(qualityFlat.batchLetterMinScore10, 8);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefsPath = path.join(root, 'config', 'preferences.json');
const backup = fs.readFileSync(prefsPath, 'utf8');

try {
  const { preferences } = patchSettings({
    'applyIntelligence.minGateScore': 61,
    'applyIntelligence.enabled': true,
  });
  assert.equal(preferences.applyIntelligence?.minGateScore, 61);
} finally {
  fs.writeFileSync(prefsPath, backup, 'utf8');
}

console.log('test-settings-patch-flatten: OK');
