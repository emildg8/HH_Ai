/**
 * Baseline: example в git или локальный снимок.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { INTELLIGENCE_BASELINE_FILE } from '../lib/intelligence-loop.mjs';

const EXAMPLE = path.join(ROOT, 'data', 'intelligence-baseline.example.json');

assert.ok(
  fs.existsSync(INTELLIGENCE_BASELINE_FILE) || fs.existsSync(EXAMPLE),
  'нужен data/intelligence-baseline.json или intelligence-baseline.example.json'
);

const src = fs.existsSync(INTELLIGENCE_BASELINE_FILE) ? INTELLIGENCE_BASELINE_FILE : EXAMPLE;
const baseline = JSON.parse(fs.readFileSync(src, 'utf8'));

assert.ok(baseline.at, 'baseline.at');
assert.ok(baseline.buckets && typeof baseline.buckets === 'object', 'baseline.buckets');
assert.ok(baseline.rates && typeof baseline.rates === 'object', 'baseline.rates');
assert.ok(baseline.conversion && typeof baseline.conversion === 'object', 'baseline.conversion');

console.log('test-ops-baseline-exists: OK');
