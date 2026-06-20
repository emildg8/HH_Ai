import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOfferGuard, isEmployerQuestionPrompt } from '../lib/interview-copilot-offer-guard.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/fixtures/offer-guard-cases.json'), 'utf8')
);

assert.ok(isEmployerQuestionPrompt('Есть вопросы к нам?'));

for (const c of cases) {
  const r = applyOfferGuard(c.script, c.ctx || {});
  for (const f of c.expectFlags || []) {
    assert.ok(
      r.flags.some((x) => x === f || x.startsWith(`${f}:`)),
      `${c.id}: expected flag ${f}, got ${r.flags.join(',')}`
    );
  }
  if (c.expectFlags?.length === 0) {
    assert.equal(r.flags.length, 0, `${c.id}: unexpected flags ${r.flags}`);
  }
  if (c.expectRegen) assert.equal(r.regenerated, true, `${c.id}: expected regen`);
}

console.log(`test-interview-copilot-offer-guard: OK (${cases.length} cases)`);
