/**
 * Статические проверки исходников дашборда (без браузера).
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DASHBOARD_CACHE_BUST_CHECKS } from './dashboard-asset-version.mjs';
import { collectDashboardDesignLintIssues } from './dashboard-design-lint.mjs';

/** ID и селекторы, от которых зависит модалка настроек. */
export const SETTINGS_DOM_CONTRACT = [
  'btn-open-settings',
  'settings-modal',
  'settings-layout-bar',
  'settings-layout-presets-group',
  'settings-save-hint',
  'btn-settings-save-now',
  'settings-panel-system',
  'settings-panel-harvest',
  'settings-panel-targeting',
  'settings-panel-apply',
  'settings-panel-letters',
  'settings-panel-teleprompter',
  'settings-panel-appearance',
  'settings-panel-services',
  'settings-panel-expert',
  'settings-letters-group',
  'batch-false-positive-max',
  'pref-min-monthly-rub',
  'settings-limits-hh',
  'settings-zone-back',
  'settings-mic-manual',
];

export const SETTINGS_TAB_IDS = [
  'system',
  'harvest',
  'targeting',
  'apply',
  'letters',
  'teleprompter',
  'appearance',
  'services',
  'expert',
];

/** @deprecated используйте SETTINGS_TAB_IDS */
export const SETTINGS_ZONE_IDS = SETTINGS_TAB_IDS;

/** Синхронизировать с dashboard/public/modal-layout.mjs → MODAL_ROOT_IDS */
export const MODAL_ROOT_IDS = [
  'batch-precheck-modal',
  'letter-quality-hub-modal',
  'settings-modal',
  'shortcuts-modal',
  'batch-report-modal',
  'daily-digest-modal',
  'approved-letter-modal',
  'questionnaire-modal',
  'funnel-modal',
  'apply-log-modal',
  'draft-modal',
  'vacancy-detail-modal',
];

export const BATCH_FLOW_DOM_CONTRACT = [
  'batch-precheck-modal',
  'batch-precheck-prefs-diff',
  'batch-precheck-start',
  'batch-report-modal',
  'batch-report-actions',
  'letter-quality-hub-modal',
  'btn-batch-report',
];

/** @param {string} src @param {number} index */
function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

/** @param {string} src @returns {string | null} */
export function findUnclosedBlockComment(src) {
  let i = 0;
  let inStr = false;
  let q = '';
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === q) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = true;
      q = c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      i = src.indexOf('\n', i);
      if (i === -1) break;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      const close = src.indexOf('*/', i + 2);
      if (close === -1) {
        return `незакрытый block-комментарий (строка ${lineAt(src, i)})`;
      }
      i = close + 2;
      continue;
    }
    i++;
  }
  return null;
}

/** @param {string} src @returns {string | null} — JSDoc без закрывающего комментария перед export */
export function findJsdocBrokenBeforeExport(src) {
  let pos = 0;
  while (pos < src.length) {
    const docStart = src.indexOf('/**', pos);
    if (docStart === -1) break;
    const close = src.indexOf('*/', docStart + 3);
    const exportAt = src.indexOf('\nexport ', docStart);
    if (exportAt !== -1 && (close === -1 || exportAt < close)) {
      return `JSDoc без */ перед export (строка ${lineAt(src, docStart)})`;
    }
    pos = close === -1 ? docStart + 3 : close + 2;
  }
  return null;
}

/**
 * @param {string} html
 * @param {string[]} ids
 * @returns {string[]}
 */
export function findMissingDomIds(html, ids) {
  const missing = [];
  for (const id of ids) {
    const re = new RegExp(`\\bid=["']${id}["']`);
    if (!re.test(html)) missing.push(id);
  }
  return missing;
}

/** @param {string} html @returns {string | null} */
export function findAppScriptSrc(html) {
  const scripts = html.matchAll(/<script\b[^>]*>/gi);
  for (const m of scripts) {
    const tag = m[0];
    if (!/\btype=["']module["']/i.test(tag)) continue;
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src?.includes('app.js')) return src;
  }
  return null;
}

/**
 * @param {string} html
 * @param {ReadonlyArray<{ file: string, version: string }>} checks
 * @returns {string[]}
 */
export function findCacheBustMismatches(html, checks = DASHBOARD_CACHE_BUST_CHECKS) {
  const issues = [];
  for (const { file, version } of checks) {
    const re = new RegExp(`${file.replace('.', '\\.')}\\?v=${version}`);
    if (!re.test(html)) {
      issues.push(`index.html: ожидается ${file}?v=${version} (см. lib/dashboard-asset-version.mjs)`);
    }
  }
  return issues;
}

/** @param {string} appSrc @param {string} appJs */
export function findAppBundleIssues(appSrc, appJs) {
  const issues = [];
  if (!appSrc) {
    issues.push('index.html: нет <script type="module" src="...app.js...">');
  }
  if (!appJs.includes("from './settings-modal.mjs'")) {
    issues.push('app.js: нет import settings-modal.mjs');
  }
  if (!appJs.includes('initSettingsModal')) {
    issues.push('app.js: нет initSettingsModal');
  }
  if (!appJs.includes('openDashboardSettings')) {
    issues.push('app.js: нет openDashboardSettings');
  }
  return issues;
}

/** @param {string} src @returns {string | null} */
export function findSettingsModalExportIssues(src) {
  if (!src.includes('export function initSettingsModal')) {
    return 'settings-modal.mjs: нет export function initSettingsModal';
  }
  if (!src.includes('export function focusSettingsField')) {
    return 'settings-modal.mjs: нет export function focusSettingsField';
  }
  return null;
}

/**
 * @param {string} html
 * @param {string} appJs
 * @param {string} modalLayoutSrc
 * @returns {string[]}
 */
export function findModalLayerIssues(html, appJs, modalLayoutSrc) {
  const issues = [];
  for (const id of MODAL_ROOT_IDS) {
    if (!new RegExp(`\\bid=["']${id}["']`).test(html)) {
      issues.push(`index.html: нет модалки #${id}`);
    }
  }
  for (const id of BATCH_FLOW_DOM_CONTRACT) {
    if (!new RegExp(`\\bid=["']${id}["']`).test(html)) {
      issues.push(`index.html: нет batch/letter id #${id}`);
    }
  }
  if (!html.includes('data-batch-report-settings')) {
    issues.push('index.html: нет кнопок data-batch-report-settings');
  }
  if (!appJs.includes("from './modal-layout.mjs'")) {
    issues.push('app.js: нет import modal-layout.mjs');
  }
  if (!appJs.includes('initBatchReportSettingsLinks')) {
    issues.push('app.js: нет initBatchReportSettingsLinks');
  }
  for (const id of MODAL_ROOT_IDS) {
    if (!modalLayoutSrc.includes(`'${id}'`)) {
      issues.push(`modal-layout.mjs: нет '${id}' в MODAL_ROOT_IDS`);
    }
  }
  return issues;
}

/**
 * @param {string} publicDir dashboard/public
 * @param {string} indexHtml
 * @returns {string[]}
 */
export function collectDashboardStaticIssues(publicDir, indexHtml) {
  const issues = [];
  const html = readFileSync(indexHtml, 'utf8');

  const missing = findMissingDomIds(html, SETTINGS_DOM_CONTRACT);
  if (missing.length) {
    issues.push(`index.html: нет id: ${missing.join(', ')}`);
  }

  for (const name of SETTINGS_TAB_IDS) {
    if (!html.includes(`data-settings-tab="${name}"`)) {
      issues.push(`index.html: нет вкладки data-settings-tab="${name}"`);
    }
  }

  issues.push(...findCacheBustMismatches(html));

  const settingsCssPath = join(publicDir, 'dashboard-settings.css');
  const settingsCss = readFileSync(settingsCssPath, 'utf8');
  if (!settingsCss.includes('grid-template-columns: 14rem minmax(0, 1fr)')) {
    issues.push('dashboard-settings.css: нет сетки sidebar 14rem + content');
  }
  if (!settingsCss.includes('grid-column: 2')) {
    issues.push('dashboard-settings.css: нет явного grid-column: 2 для content');
  }
  if (!settingsCss.includes('settings-shell--wide')) {
    issues.push('dashboard-settings.css: нет класса settings-shell--wide');
  }
  if (settingsCss.length < 11_000) {
    issues.push('dashboard-settings.css: файл слишком мал — layout v9 не влит?');
  }
  if (html.includes('dashboard-settings-v7-layout.css')) {
    issues.push('index.html: устаревший link на dashboard-settings-v7-layout.css');
  }
  if (!settingsCss.includes('min(72rem')) {
    issues.push('dashboard-settings.css: нет потолка ширины 72rem');
  }
  if (settingsCss.includes('container-name: settings-dialog')) {
    issues.push('dashboard-settings.css: устаревший container-name на dialog (ломает layout)');
  }

  const appSrc = findAppScriptSrc(html);
  const appJs = readFileSync(join(publicDir, 'app.js'), 'utf8');
  const modalLayoutSrc = readFileSync(join(publicDir, 'modal-layout.mjs'), 'utf8');
  issues.push(...findAppBundleIssues(appSrc, appJs));
  issues.push(...findModalLayerIssues(html, appJs, modalLayoutSrc));

  const settingsModalPath = join(publicDir, 'settings-modal.mjs');
  const smIssue = findSettingsModalExportIssues(readFileSync(settingsModalPath, 'utf8'));
  if (smIssue) issues.push(smIssue);

  const files = readdirSync(publicDir)
    .filter((n) => n.endsWith('.mjs'))
    .sort();

  for (const name of files) {
    const src = readFileSync(join(publicDir, name), 'utf8');
    const u = findUnclosedBlockComment(src);
    if (u) issues.push(`${name}: ${u}`);
    const j = findJsdocBrokenBeforeExport(src);
    if (j) issues.push(`${name}: ${j}`);
  }

  for (const msg of collectDashboardDesignLintIssues(publicDir)) {
    issues.push(`design: ${msg}`);
  }

  return issues;
}
