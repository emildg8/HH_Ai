/**
 * Вкладка «Отлож.» и breadcrumbs.
 *   node scripts/test-apply-view-deferred.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildListBreadcrumbItems } from '../dashboard/public/list-breadcrumbs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard', 'public', 'index.html'), 'utf8');
assert.match(html, /data-apply-view="deferred"/);

const appJs = fs.readFileSync(path.join(__dirname, '..', 'dashboard', 'public', 'app.js'), 'utf8');
assert.match(appJs, /view === 'deferred'/);
assert.match(appJs, /updateApplyViewTabCounts/);

const crumbs = buildListBreadcrumbItems({
  applyView: 'deferred',
  scoreBand: 'all',
  status: 'pending',
  count: 2,
});
assert.ok(crumbs.some((c) => /Отложенные/i.test(c.label)));

console.log('test-apply-view-deferred: OK');
