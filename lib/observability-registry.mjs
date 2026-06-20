/**
 * Реестр событий наблюдаемости (contract-first).
 * Glue-0: только модули с активными emit-хуками; расширяется по волнам.
 */

/** @typedef {{ module: string, events: string[], file: string, gluePhase?: string, tests?: string[] }} ObservabilityRegistryEntry */

/** @type {ObservabilityRegistryEntry[]} */
export const OBSERVABILITY_REGISTRY = [
  {
    module: 'apply-gate',
    events: ['gate.preview', 'gate.decided'],
    file: 'conversion-events.jsonl',
    gluePhase: 'gate.decided',
    tests: ['test-apply-gate'],
  },
  {
    module: 'vacancy-ingest',
    events: ['vacancy.ingested'],
    file: 'conversion-events.jsonl',
    gluePhase: 'vacancy.ingested',
    tests: ['test-conversion-glue'],
  },
  {
    module: 'hh-apply-batch',
    events: ['apply.batch.started', 'apply.batch.finished', 'apply.started', 'apply.finished'],
    file: 'conversion-events.jsonl',
    gluePhase: 'apply.started',
    tests: ['test-conversion-glue'],
  },
  {
    module: 'conversion-glue',
    events: ['glue.hook.error'],
    file: 'conversion-events.jsonl',
    tests: ['test-conversion-glue'],
  },
];

/** Все уникальные type из реестра. */
export function listRegisteredEventTypes() {
  const set = new Set();
  for (const row of OBSERVABILITY_REGISTRY) {
    for (const e of row.events) set.add(e);
  }
  return [...set].sort();
}

/**
 * @param {string} moduleId
 */
export function getRegistryEntry(moduleId) {
  return OBSERVABILITY_REGISTRY.find((r) => r.module === moduleId) || null;
}
