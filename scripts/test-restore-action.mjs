import assert from 'node:assert/strict';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';

loadEnv();
applyStoredProfile();

import { loadQueue, updateVacancyRecord, getVacancyRecord } from '../lib/store.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { recordIsHiddenByRoleFilters } from '../lib/filters.mjs';

const base = `http://127.0.0.1:${process.env.DASHBOARD_PORT || 3849}`;

async function postAction(body) {
  const r = await fetch(`${base}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

const prefs = loadPreferences();
const hidden = loadQueue().find(
  (x) => x.status === 'pending' && recordIsHiddenByRoleFilters(x, prefs)
);
const rejected = loadQueue().find((x) => x.status === 'rejected');

if (hidden) {
  const id = hidden.id;
  const { status, data } = await postAction({ id, action: 'restore' });
  if (status === 404) {
    console.log('test-restore-action: skip unhide (запись не на сервере дашборда)');
  } else {
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.roleFilterBypass, true);
    const updated = getVacancyRecord(id);
    assert.equal(updated.roleFilterBypass, true);
    updateVacancyRecord(id, {
      roleFilterBypass: false,
      roleFilterBypassAt: null,
      roleFilterBypassReasons: null,
    });
  }
}

  if (rejected) {
  const id = rejected.id;
  const reason = rejected.feedbackReason || 'test';
  const hadSource = rejected.rejectSource || null;
  const { status, data } = await postAction({ id, action: 'restore' });
  assert.equal(status, 200, JSON.stringify(data));
  assert.equal(data.status, 'pending');
  const updated = getVacancyRecord(id);
  assert.equal(updated.rejectSource, undefined);
  updateVacancyRecord(id, {
    status: 'rejected',
    feedbackReason: reason,
    ...(hadSource ? { rejectSource: hadSource } : {}),
  });
}

const bad = await postAction({ id: 'missing-id', action: 'restore' });
assert.equal(bad.status, 404);

console.log('test-restore-action: ok');
