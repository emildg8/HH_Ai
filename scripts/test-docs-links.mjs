/**
 * Внутренние ссылки в docs из docs-manifest.json.
 *   node scripts/test-docs-links.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const manifestPath = path.join(ROOT, 'docs/docs-manifest.json');
assert.ok(fs.existsSync(manifestPath), 'docs/docs-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
const errors = [];

for (const entry of manifest.documents) {
  const docPath = path.join(ROOT, entry.path);
  if (!fs.existsSync(docPath)) {
    errors.push(`manifest file missing: ${entry.path}`);
    continue;
  }
  if (entry.status === 'archive') continue;
  if (entry.audience === 'maintainer') continue;
  const text = fs.readFileSync(docPath, 'utf8');
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const target = m[1].trim();
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) continue;
    const clean = target.split('#')[0];
    if (!clean) continue;
    const resolved = path.normalize(path.join(path.dirname(docPath), clean));
    if (!resolved.startsWith(ROOT)) continue;
    if (!fs.existsSync(resolved)) {
      errors.push(`${entry.path}: broken link → ${target}`);
    }
  }
}

if (errors.length) {
  console.error('test-docs-links: FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log('test-docs-links: OK');
