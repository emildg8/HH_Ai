/**
 * Smoke: пресеты и порядок панелей sidebar builder.
 *   node scripts/test-sidebar-builder.mjs
 */

import assert from 'node:assert/strict';
import {
  LAYOUT_PRESETS,
  LAYOUT_PRESET_KEYS,
  detectLayoutPreset,
  normalizePanelOrder,
  SIDEBAR_BUILDER_PANEL_IDS,
} from '../dashboard/public/dashboard-ux.mjs';

assert.equal(LAYOUT_PRESET_KEYS.length, 3);
for (const key of LAYOUT_PRESET_KEYS) {
  const p = LAYOUT_PRESETS[key];
  assert.ok(p.panelOrder?.length >= 3, `${key} panelOrder`);
  assert.ok(p.panels, `${key} panels`);
  assert.ok(p.hint, `${key} hint`);
}

const standardUi = {
  uiMode: LAYOUT_PRESETS.standard.uiMode,
  sidebarMode: LAYOUT_PRESETS.standard.sidebarMode,
  panels: { ...LAYOUT_PRESETS.standard.panels },
  panelOrder: [...LAYOUT_PRESETS.standard.panelOrder],
};
assert.equal(detectLayoutPreset(standardUi), 'standard');

const custom = {
  ...standardUi,
  panels: { ...standardUi.panels, kpi: false },
};
assert.equal(detectLayoutPreset(custom), null);

const order = normalizePanelOrder(['nav', 'status']);
assert.ok(order.includes('nav'));
assert.ok(order.includes('status'));
assert.equal(SIDEBAR_BUILDER_PANEL_IDS.includes('brand'), false);

console.log('test-sidebar-builder: OK');
