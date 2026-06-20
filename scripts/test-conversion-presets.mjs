/**
 * Пресеты конверсии: валидные patch для settings-registry.
 */
import assert from 'node:assert/strict';
import { CONVERSION_PRESETS, listConversionPresetsForClient } from '../lib/conversion-presets.mjs';
import { validateSettingsPatch } from '../lib/settings-registry.mjs';

const list = listConversionPresetsForClient();
assert.ok(list.length >= 3, 'presets');

for (const p of list) {
  const v = validateSettingsPatch(p.patch);
  assert.equal(v.ok, true, `${p.id}: ${v.errors?.join('; ')}`);
}

assert.ok(CONVERSION_PRESETS.balanced.patch['applyIntelligence.minGateScore'] === 60);
assert.ok(CONVERSION_PRESETS.quality.patch['applyIntelligence.minGateScore'] === 70);

console.log(`test-conversion-presets: OK (${list.length} presets)`);
