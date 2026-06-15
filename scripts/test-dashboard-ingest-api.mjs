/**
 * Smoke API для multi-source ingest (без Playwright UI).
 *   node scripts/test-dashboard-ingest-api.mjs
 * Требует запущенный дашборд: npm run dashboard
 */
import assert from 'node:assert/strict';

const BASE = process.env.DASHBOARD_URL || 'http://127.0.0.1:3849';

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  const health = await api('/api/queue-meta');
  assert.equal(health.status, 200, 'dashboard must be running on ' + BASE);

  const parse = await api('/api/parse-url?url=' + encodeURIComponent('https://career.habr.com/vacancies/42'));
  assert.equal(parse.status, 200);
  assert.equal(parse.body.source, 'habr');
  assert.equal(parse.body.applyMode, 'manual_link');

  const top = await api('/api/top-tier?limit=5');
  assert.equal(top.status, 200);
  assert.ok(Array.isArray(top.body.items), 'top-tier items');

  const digest = await api('/api/intelligence-digest');
  assert.equal(digest.status, 200);
  assert.ok(digest.body.bySource != null || digest.body.buckets != null, 'digest shape');

  const vacancies = await api('/api/vacancies?status=pending&scoreBand=all&applyView=queue&tier=A');
  assert.equal(vacancies.status, 200);
  assert.ok(Array.isArray(vacancies.body.items), 'vacancies with tier filter');

  const ingest = await api('/api/ingest-url', {
    method: 'POST',
    body: JSON.stringify({
      url: `https://career.habr.com/vacancies/99999-test-${Date.now()}`,
    }),
  });
  assert.ok([200, 409].includes(ingest.status), 'ingest-url responds');

  console.log('test-dashboard-ingest-api: OK');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
