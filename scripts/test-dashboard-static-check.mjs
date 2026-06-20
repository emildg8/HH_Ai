/**
 * Unit + smoke: lib/dashboard-static-check.mjs и живой репозиторий.
 */
import assert from 'node:assert/strict';
import { join } from 'path';
import { ROOT } from '../lib/paths.mjs';
import {
  DASHBOARD_APP_JS_VERSION,
  DASHBOARD_V4_CSS_VERSION,
  DASHBOARD_UNIFY_CSS_VERSION,
  DASHBOARD_FOCUS_CSS_VERSION,
  DASHBOARD_CONTROLS_POLISH_CSS_VERSION,
  DASHBOARD_DESIGN_FOUNDATION_VERSION,
  DASHBOARD_SETTINGS_CSS_VERSION,
  DASHBOARD_SETTINGS_V5_LAYER_VERSION,
  DASHBOARD_SETTINGS_V6_VERSION,
  DASHBOARD_STYLE_CSS_VERSION,
} from '../lib/dashboard-asset-version.mjs';
import {
  findJsdocBrokenBeforeExport,
  findUnclosedBlockComment,
  findMissingDomIds,
  findAppScriptSrc,
  findAppBundleIssues,
  findCacheBustMismatches,
  findSettingsModalExportIssues,
  findModalLayerIssues,
  MODAL_ROOT_IDS,
  collectDashboardStaticIssues,
} from '../lib/dashboard-static-check.mjs';
import { collectDashboardDesignLintIssues, findRawHexInDashboardCss } from '../lib/dashboard-design-lint.mjs';
import { readFileSync } from 'fs';

assert.equal(findRawHexInDashboardCss('.x { color: #ff00ff; }', 'dashboard-v4.css').length, 1);
assert.equal(findRawHexInDashboardCss('.x { color: #fff; }', 'dashboard-v4.css').length, 0);
assert.equal(findRawHexInDashboardCss('.x { color: color-mix(in srgb, #e85 10%, red); }', 'x.css').length, 0);

assert.equal(findUnclosedBlockComment('const a = 1; /* ok */'), null);
assert.match(findUnclosedBlockComment('const a = 1; /* broken'), /незакрытый/);

assert.equal(findJsdocBrokenBeforeExport('/** @param {number} x\n */\nexport function f() {}'), null);
assert.match(
  findJsdocBrokenBeforeExport('/** @param {{ x: number }} deps\nexport function f() {}'),
  /JSDoc без/
);

const brokenSettingsDoc = `/**
 * @param {{
 *   api: () => Promise<unknown>,
 * }} deps
export function initSettingsModal(deps) {}`;
assert.match(findJsdocBrokenBeforeExport(brokenSettingsDoc), /JSDoc без/);

assert.deepEqual(findMissingDomIds('<div id="foo"></div>', ['foo', 'bar']), ['bar']);

assert.equal(findAppScriptSrc('<script type="module" src="/app.js?v=1"></script>'), '/app.js?v=1');
assert.equal(
  findAppScriptSrc('<script src="/app.js?v=2" type="module"></script>'),
  '/app.js?v=2'
);

assert.equal(
  findAppBundleIssues(
    '/app.js',
    "import { x } from './settings-modal.mjs';\ninitSettingsModal();\nfunction openDashboardSettings(){}"
  ).length,
  0
);
const bustHtml = `<script type="module" src="/app.js?v=${DASHBOARD_APP_JS_VERSION}"></script>
<link href="/style.css?v=${DASHBOARD_STYLE_CSS_VERSION}">
<link href="/dashboard-v4.css?v=${DASHBOARD_V4_CSS_VERSION}">
<link href="/dashboard-settings.css?v=${DASHBOARD_SETTINGS_CSS_VERSION}">
<link href="/dashboard-settings-v5-layer.css?v=${DASHBOARD_SETTINGS_V5_LAYER_VERSION}">
<link href="/dashboard-settings-v6.css?v=${DASHBOARD_SETTINGS_V6_VERSION}">
<link href="/dashboard-unify.css?v=${DASHBOARD_UNIFY_CSS_VERSION}">
<link href="/design-tokens.css?v=${DASHBOARD_UNIFY_CSS_VERSION}">
<link href="/design-foundation.css?v=${DASHBOARD_DESIGN_FOUNDATION_VERSION}">
<link href="/dashboard-focus.css?v=${DASHBOARD_FOCUS_CSS_VERSION}">
<link href="/dashboard-controls-polish.css?v=${DASHBOARD_CONTROLS_POLISH_CSS_VERSION}">`;
assert.equal(findCacheBustMismatches(bustHtml).length, 0);
assert.ok(findCacheBustMismatches('<link href="/dashboard-v4.css?v=old">').length > 0);

assert.equal(findSettingsModalExportIssues('export function initSettingsModal() {}\nexport function focusSettingsField() {}'), null);
assert.match(findSettingsModalExportIssues('export function foo() {}'), /initSettingsModal/);

const publicDir = join(ROOT, 'dashboard', 'public');
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
const appJs = readFileSync(join(publicDir, 'app.js'), 'utf8');
const modalLayout = readFileSync(join(publicDir, 'modal-layout.mjs'), 'utf8');
assert.equal(findModalLayerIssues(html, appJs, modalLayout).length, 0);

const liveIssues = collectDashboardStaticIssues(
  join(ROOT, 'dashboard', 'public'),
  join(ROOT, 'dashboard', 'public', 'index.html')
);
assert.equal(
  liveIssues.length,
  0,
  `collectDashboardStaticIssues на репозитории:\n${liveIssues.join('\n')}`
);

console.log('OK: test-dashboard-static-check.mjs');
