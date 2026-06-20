/**
 * docs-manifest.json — все canonical docs существуют.
 *   node scripts/test-docs-inventory.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const manifestPath = path.join(ROOT, 'docs/docs-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.ok(Array.isArray(manifest.documents) && manifest.documents.length > 0);

const errors = [];
for (const entry of manifest.documents) {
  if (!entry.path || !entry.status) {
    errors.push(`invalid entry: ${JSON.stringify(entry)}`);
    continue;
  }
  const p = path.join(ROOT, entry.path);
  if (!fs.existsSync(p)) {
    errors.push(`missing: ${entry.path} (${entry.status})`);
  }
}

if (errors.length) {
  console.error('test-docs-inventory: FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log(`test-docs-inventory: OK (${manifest.documents.length} docs)`);
