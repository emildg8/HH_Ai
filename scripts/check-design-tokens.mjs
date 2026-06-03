/**
 * Проверка дизайн-токенов и CSS lint дашборда.
 *   npm run check:design-tokens
 */
import { join } from 'path';
import { ROOT } from '../lib/paths.mjs';
import { collectDashboardDesignLintIssues } from '../lib/dashboard-design-lint.mjs';
import { DASHBOARD_STYLE_VERSION } from '../lib/dashboard-asset-version.mjs';

const publicDir = join(ROOT, 'dashboard', 'public');
const issues = collectDashboardDesignLintIssues(publicDir);

if (issues.length) {
  for (const msg of issues) console.error(`FAIL: ${msg}`);
  process.exit(1);
}
console.log(`OK design tokens (style ${DASHBOARD_STYLE_VERSION}, ${issues.length} issues)`);
