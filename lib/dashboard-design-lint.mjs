/**
 * Статический lint CSS дашборда: сырые hex вне design-tokens.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Файлы, где hex разрешён (источник палитры). */
export const DASHBOARD_HEX_ALLOW_FILES = new Set([
  'design-tokens.css',
  'style.css',
  'design-components.css',
]);

/** @type {ReadonlySet<string>} */
const HEX_ALLOW_IN_VALUE = new Set([
  '#fff',
  '#ffffff',
  '#000',
  '#000000',
  '#6366f1',
]);

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

/**
 * @param {string} css
 * @param {string} file
 * @returns {string[]}
 */
export function findRawHexInDashboardCss(css, file) {
  if (DASHBOARD_HEX_ALLOW_FILES.has(file)) return [];
  const issues = [];
  let m;
  while ((m = HEX_RE.exec(css)) !== null) {
    const hex = m[0].toLowerCase();
    if (HEX_ALLOW_IN_VALUE.has(hex)) continue;
    const before = css.slice(Math.max(0, m.index - 48), m.index);
    if (before.includes('color-mix(')) continue;
    if (/var\([^)]*,\s*$/.test(before) || /,\s*$/.test(before)) continue;
    const line = css.slice(0, m.index).split('\n').length;
    issues.push(`${file}:${line}: сырой hex ${hex} (используйте var(--ds-*) / var(--hh-*))`);
  }
  return issues;
}

/**
 * @param {string} publicDir dashboard/public
 * @returns {string[]}
 */
export function collectDashboardDesignLintIssues(publicDir) {
  const issues = [];
  const files = readdirSync(publicDir)
    .filter((n) => n.endsWith('.css'))
    .sort();
  for (const name of files) {
    const src = readFileSync(join(publicDir, name), 'utf8');
    issues.push(...findRawHexInDashboardCss(src, name));
  }
  const tokens = readFileSync(join(publicDir, 'design-tokens.css'), 'utf8');
  if (!tokens.includes('--hh-accent:')) {
    issues.push('design-tokens.css: нет --hh-accent (канонические токены chrome)');
  }
  if (!tokens.includes('--cq-surface:')) {
    issues.push('design-tokens.css: нет --cq-surface');
  }
  if (!tokens.includes('--ds-root-size:')) {
    issues.push('design-tokens.css: нет --ds-root-size (единая типографика)');
  }
  if (!tokens.includes('--font-weight-semibold:')) {
    issues.push('design-tokens.css: нет --font-weight-semibold');
  }
  return issues;
}
