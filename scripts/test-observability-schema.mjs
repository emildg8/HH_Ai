/**
 * JSON Schema v1 — обязательные поля строки observability.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateObsEventRow, OBS_EVENT_SCHEMA_VERSION } from '../lib/observability.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'observability', 'conversion-event-example.jsonl');

assert.equal(OBS_EVENT_SCHEMA_VERSION, 1);

const line = fs.readFileSync(FIXTURE, 'utf8').trim().split(/\n/)[0];
const row = JSON.parse(line);
assert.deepEqual(validateObsEventRow(row), [], 'fixture valid');

assert.deepEqual(validateObsEventRow({ v: 2 }), ['v', 'ts', 'type', 'correlationId', 'payload']);
assert.deepEqual(validateObsEventRow({ v: 1, ts: 'x', type: 't', correlationId: 'c' }), ['ts', 'payload']);

console.log('test-observability-schema: OK');
