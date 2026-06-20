/**
 * Реестр наблюдаемости: каждый glue-модуль зарегистрирован.
 */
import assert from 'node:assert/strict';
import { OBSERVABILITY_REGISTRY, listRegisteredEventTypes } from '../lib/observability-registry.mjs';
import { GLUE_PHASES } from '../lib/conversion-glue.mjs';

assert.ok(OBSERVABILITY_REGISTRY.length >= 2, 'registry not empty');

const modules = new Set(OBSERVABILITY_REGISTRY.map((r) => r.module));
assert.ok(modules.has('vacancy-ingest'), 'vacancy-ingest');
assert.ok(modules.has('hh-apply-batch'), 'hh-apply-batch');

for (const row of OBSERVABILITY_REGISTRY) {
  assert.ok(row.module, 'module id');
  assert.ok(Array.isArray(row.events) && row.events.length > 0, `${row.module}: events`);
  assert.ok(row.file, `${row.module}: file`);
  for (const ev of row.events) {
    assert.match(ev, /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, `${row.module}: event name ${ev}`);
  }
}

const types = listRegisteredEventTypes();
assert.ok(types.includes('vacancy.ingested'), 'vacancy.ingested registered');
assert.ok(types.includes('apply.batch.started'), 'apply.batch.started registered');

// Фазы glue из каркаса — имена согласованы с dot-notation
for (const phase of ['vacancy.ingested', 'apply.started', 'apply.finished']) {
  assert.ok(GLUE_PHASES.includes(phase), `glue phase ${phase}`);
}

console.log(`test-observability-registry: OK (${OBSERVABILITY_REGISTRY.length} modules, ${types.length} events)`);
