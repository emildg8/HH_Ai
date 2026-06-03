/**
 * API: фильтр авто/ручных отклонённых.
 * Запуск при работающем дашборде (та же очередь, что у dashboard-server).
 */
import assert from 'node:assert/strict';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { isAutoRejectRecord, isManualRejectRecord } from '../lib/reject-source.mjs';

loadEnv();
applyStoredProfile();

const base = process.env.DASHBOARD_URL || `http://127.0.0.1:${process.env.DASHBOARD_PORT || 3849}`;

async function fetchRejected(filter) {
  const url = `${base}/api/vacancies?status=rejected&scoreBand=all&applyView=queue&rejectSource=${filter}`;
  const r = await fetch(url);
  assert.equal(r.status, 200);
  return r.json();
}

const all = await fetchRejected('all');
const auto = await fetchRejected('auto');
const manual = await fetchRejected('manual');

assert.ok(Array.isArray(all.items));
assert.equal(typeof all.counts.rejectedAuto, 'number');
assert.equal(typeof all.counts.rejectedManual, 'number');
for (const item of auto.items) {
  assert.ok(isAutoRejectRecord(item), item.title);
}
for (const item of manual.items) {
  assert.ok(isManualRejectRecord(item), item.title);
}

console.log(
  `test-rejected-filter: ok (auto=${auto.items.length}, manual=${manual.items.length}, counts auto=${auto.counts.rejectedAuto} manual=${auto.counts.rejectedManual})`
);
