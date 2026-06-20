/**
 * JSON schema weekly patterns (упрощённая проверка).
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'ops-patterns-example.json');

const sample = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
assert.match(sample.week, /^\d{4}-W\d{2}$/);
assert.ok(Array.isArray(sample.wins) && sample.wins.length >= 1);
assert.ok(Array.isArray(sample.losses) && sample.losses.length >= 1);
assert.ok(Array.isArray(sample.actions) && sample.actions.length >= 1);

console.log('test-ops-patterns-schema: OK');
