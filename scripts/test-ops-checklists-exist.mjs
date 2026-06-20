/**
 * OPS чеклисты на диске.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const CHECKLISTS = [
  'docs/ops/checklists/interview-before.md',
  'docs/ops/checklists/offer-review.md',
  'docs/ops/checklists/weekly-patterns.md',
];

for (const rel of CHECKLISTS) {
  const p = path.join(ROOT, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  const text = fs.readFileSync(p, 'utf8');
  assert.ok(text.includes('- [ ]'), `${rel}: нужны чекбоксы`);
}

console.log('test-ops-checklists-exist: OK');
