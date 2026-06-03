/**
 * Smoke: пресеты и порядок панелей sidebar builder.
 *   node scripts/test-sidebar-builder.mjs
 */

import assert from 'node:assert/strict';
import { migrateLegacySidebarPrefs } from '../lib/dashboard-preferences.mjs';
import { DEPRECATED_SIDEBAR_PANEL_IDS } from '../lib/dashboard-ux.mjs';
import {
  LAYOUT_PRESETS,
  LAYOUT_PRESET_KEYS,
  detectLayoutPreset,
  normalizePanelOrder,
  SIDEBAR_BUILDER_PANEL_IDS,
} from '../dashboard/public/dashboard-ux.mjs';
import { buildPanelOrderFromColumns, panelHostSlot, orderedSlotsForSide } from '../dashboard/public/sidebar-layout.mjs';

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
assert.ok(SIDEBAR_BUILDER_PANEL_IDS.includes('syncExtended'));
assert.ok(SIDEBAR_BUILDER_PANEL_IDS.includes('resumeRaise'));

const stdPanels = LAYOUT_PRESETS.standard.panels;
assert.equal(stdPanels.syncExtended, true);
assert.equal(stdPanels.resumeRaise, true);

const left = ['status', 'actionsPrimary', 'nav', 'filters'];
const right = ['resumeRaise', 'kpi', 'syncExtended', 'jobFooter'];
const merged = buildPanelOrderFromColumns(left, right);
assert.equal(merged.indexOf('resumeRaise') < merged.indexOf('kpi'), true);
assert.equal(merged.indexOf('kpi') < merged.indexOf('jobFooter'), true);
assert.ok(merged.indexOf('status') < merged.indexOf('resumeRaise'));

assert.equal(panelHostSlot('harvestPeriod'), 'harvest');
assert.equal(panelHostSlot('syncExtended'), 'syncExtended');

const uiSides = {
  panelOrder: buildPanelOrderFromColumns(['status', 'nav'], ['resumeRaise', 'kpi', 'syncExtended']),
  panelSides: {
    status: 'left',
    nav: 'left',
    resumeRaise: 'right',
    kpi: 'right',
    syncExtended: 'right',
  },
  panels: {},
};
const rightSlots = orderedSlotsForSide(uiSides, 'right');
assert.ok(rightSlots.indexOf('resumeRaise') < rightSlots.indexOf('kpi'));
assert.ok(rightSlots.indexOf('kpi') < rightSlots.indexOf('syncExtended'));

const legacyPrefs = {
  dashboardSidebarPanels: { quickSync: false, serviceLink: true, status: true },
  dashboardSidebarPanelOrder: ['status', 'quickSync', 'nav', 'serviceLink'],
  dashboardSidebarPanelSides: { quickSync: 'right', serviceLink: 'left', status: 'left' },
};
assert.equal(migrateLegacySidebarPrefs(legacyPrefs), true);
for (const id of DEPRECATED_SIDEBAR_PANEL_IDS) {
  assert.equal(id in (legacyPrefs.dashboardSidebarPanels || {}), false);
  assert.equal(legacyPrefs.dashboardSidebarPanelOrder.includes(id), false);
  assert.equal(id in (legacyPrefs.dashboardSidebarPanelSides || {}), false);
}

console.log('test-sidebar-builder: OK');
