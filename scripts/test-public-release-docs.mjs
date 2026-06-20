/**
 * Проверка обязательных docs для handoff / public release.
 *   node scripts/test-public-release-docs.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const REQUIRED = [
  'docs/PUBLIC-RELEASE.md',
  'docs/QUICKSTART.md',
  'docs/FIRST-RUN.md',
  'docs/BETA-TESTER-GUIDE.md',
  'docs/CONFIG-GUIDE.md',
  'docs/README.md',
  'docs/demo/vacancies-demo.json',
  'data/vacancies-queue.example.json',
];

for (const rel of REQUIRED) {
  const p = path.join(ROOT, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  if (rel.endsWith('.md')) {
    const text = fs.readFileSync(p, 'utf8').trim();
    assert.ok(text.length > 100, `${rel} слишком короткий`);
  }
}

const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/demo/vacancies-demo.json'), 'utf8'));
assert.ok(Array.isArray(demo) && demo.length >= 5, 'vacancies-demo.json: нужно ≥5 записей');

const example = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vacancies-queue.example.json'), 'utf8'));
assert.ok(Array.isArray(example) && example.length >= 5, 'vacancies-queue.example.json: нужно ≥5 записей');

console.log('test-public-release-docs: OK');
