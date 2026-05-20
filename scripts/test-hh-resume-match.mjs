import assert from 'node:assert/strict';

function titleMatchesPreferred(title, preferredRaw) {
  const t = String(title || '').toLowerCase();
  const p = String(preferredRaw || '').toLowerCase().trim();
  if (!p || !t) return false;
  if (t.includes(p)) return true;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
}

const support =
  'Специалист технической поддержки L2, L3. Руководитель службы поддержки';
assert.equal(titleMatchesPreferred(support, 'DevOps'), false);
assert.equal(titleMatchesPreferred('DevOps-инженер', 'DevOps'), true);
assert.equal(titleMatchesPreferred('Middle DevOps engineer', 'DevOps'), true);
console.log('test-hh-resume-match: OK');
