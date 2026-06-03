/**
 * Статика дашборда: синтаксис ESM, JSDoc, DOM-контракт, версия app.js.
 *   npm run check:dashboard
 */
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { ROOT } from '../lib/paths.mjs';
import { DASHBOARD_CACHE_BUST_CHECKS } from '../lib/dashboard-asset-version.mjs';
import {
  SETTINGS_DOM_CONTRACT,
  collectDashboardStaticIssues,
} from '../lib/dashboard-static-check.mjs';
import { collectDashboardImportGraphIssues } from '../lib/dashboard-import-graph.mjs';

const publicDir = join(ROOT, 'dashboard', 'public');
const indexHtml = join(publicDir, 'index.html');
const files = readdirSync(publicDir)
  .filter((name) => name.endsWith('.mjs'))
  .sort();

let failed = false;

for (const name of files) {
  const file = join(publicDir, name);
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed = true;
    if (r.stderr) process.stderr.write(r.stderr);
    console.error(`FAIL syntax: dashboard/public/${name}`);
  }
}

const staticIssues = collectDashboardStaticIssues(publicDir, indexHtml);
for (const msg of staticIssues) {
  failed = true;
  console.error(`FAIL static: ${msg}`);
}

for (const msg of collectDashboardImportGraphIssues(publicDir)) {
  failed = true;
  console.error(`FAIL imports: ${msg}`);
}

const unit = spawnSync(process.execPath, ['scripts/test-dashboard-static-check.mjs'], {
  encoding: 'utf8',
  cwd: ROOT,
});
if (unit.stdout) process.stdout.write(unit.stdout);
if (unit.stderr) process.stderr.write(unit.stderr);
if (unit.status !== 0) {
  failed = true;
  console.error('FAIL unit: test-dashboard-static-check.mjs');
}

if (failed) {
  process.exit(1);
}
console.log(
  `OK dashboard (${files.length} modules, cache: ${DASHBOARD_CACHE_BUST_CHECKS.map((c) => c.file).join('+')}, ${SETTINGS_DOM_CONTRACT.length} ids)`
);
