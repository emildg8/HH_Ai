/**
 * Unit-тесты UX-модулей (без браузера).
 *   node scripts/test-list-breadcrumbs.mjs
 */

import assert from 'node:assert/strict';
import {
  buildListBreadcrumbItems,
  renderListBreadcrumbsHtml,
} from '../dashboard/public/list-breadcrumbs.mjs';

const queueItems = buildListBreadcrumbItems({
  applyView: 'queue',
  scoreBand: 'high',
  status: 'pending',
  count: 12,
  total: 12,
  threshold: 50,
});
assert.ok(queueItems.some((x) => x.label.includes('Очередь')));
assert.ok(queueItems.some((x) => x.label.includes('Авто')));
assert.ok(queueItems.some((x) => x.label.includes('12 карточек')));

const appliedItems = buildListBreadcrumbItems({
  applyView: 'applied',
  scoreBand: 'all',
  status: 'approved',
  count: 3,
  appliedFunnel: 'invited',
});
assert.ok(appliedItems.some((x) => x.label === 'Приглашения'));

const rejectedItems = buildListBreadcrumbItems({
  applyView: 'queue',
  scoreBand: 'all',
  status: 'rejected',
  count: 2,
  rejectedSource: 'auto',
});
assert.ok(rejectedItems.some((x) => x.label === 'Авто'));

const html = renderListBreadcrumbsHtml(queueItems);
assert.match(html, /list-breadcrumbs/);
assert.match(html, /12 карточек/);

console.log('test-list-breadcrumbs: OK');
