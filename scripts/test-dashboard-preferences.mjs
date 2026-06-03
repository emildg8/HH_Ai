import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clampDashboardPref,
  patchDashboardPreferences,
  getDashboardBatchSizeCap,
  getDashboardUiConfig,
  applyLayoutPreset,
  normalizeUiMode,
} from '../lib/dashboard-preferences.mjs';
import { applyRateLimitsSnapshot } from '../lib/hh-apply-rate.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefsPath = path.join(root, 'config', 'preferences.json');
const backup = fs.readFileSync(prefsPath, 'utf8');

try {
  assert.equal(clampDashboardPref('hhApplyChatMaxPerDay', 5000), 1000);
  assert.equal(clampDashboardPref('dashboardMinScoreFilter', 75), 75);

  patchDashboardPreferences({
    dashboardMinScoreFilter: 62,
    hhApplyChatMaxPerDay: 800,
    dashboardBatchSize: 25,
    hhApplyChatMaxPerMonth: 4000,
    batchRequireRemote: false,
    batchAutoPrepareLetters: true,
    batchLetterRequireMetric: true,
    requireRemote: true,
    minMonthlyRub: 160000,
    dashboardPlaywrightDisplayMode: 'visible',
  });
  assert.equal(getDashboardBatchSizeCap(), 25);
  const snap = applyRateLimitsSnapshot();
  assert.ok('lastMonth' in snap && 'maxPerMonth' in snap);

  const ui = getDashboardUiConfig();
  assert.equal(normalizeUiMode('expert'), 'expert');
  assert.equal(normalizeUiMode('simple'), 'simple');
  assert.ok(ui.panels.actionsPrimary);
  const persisted = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
  assert.equal(persisted.batchRequireRemote, false);
  assert.equal(persisted.batchAutoPrepareLetters, true);
  assert.equal(persisted.batchLetterRequireMetric, true);
  assert.equal(persisted.requireRemote, true);
  assert.equal(persisted.minMonthlyRub, 160000);
  assert.equal(persisted.dashboardPlaywrightDisplayMode, 'visible');

  applyLayoutPreset('simple');
  const uiSimple = getDashboardUiConfig();
  assert.equal(uiSimple.uiMode, 'simple');
  assert.equal(uiSimple.panels.kpi, true);

  console.log('test-dashboard-preferences: OK');
} finally {
  fs.writeFileSync(prefsPath, backup, 'utf8');
}
