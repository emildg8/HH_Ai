/**
 * Conversion glue: kill switch, emit, hooks.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  emitConversionEvent,
  registerConversionHook,
  clearConversionHooks,
  runConversionHooks,
  isConversionGlueEnabled,
} from '../lib/conversion-glue.mjs';
import { emitObsEvent, readConversionEvents, validateObsEventRow } from '../lib/observability.mjs';
import { listRegisteredEventTypes } from '../lib/observability-registry.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-glue-'));
const eventsFile = path.join(tmpDir, 'conversion-events.jsonl');
const prevGlue = process.env.HH_CONVERSION_GLUE;
const prevObs = process.env.HH_OBSERVABILITY;
const prevFile = process.env.HH_CONVERSION_EVENTS_FILE;

process.env.HH_CONVERSION_EVENTS_FILE = eventsFile;

function cleanup() {
  if (prevGlue === undefined) delete process.env.HH_CONVERSION_GLUE;
  else process.env.HH_CONVERSION_GLUE = prevGlue;
  if (prevObs === undefined) delete process.env.HH_OBSERVABILITY;
  else process.env.HH_OBSERVABILITY = prevObs;
  if (prevFile === undefined) delete process.env.HH_CONVERSION_EVENTS_FILE;
  else process.env.HH_CONVERSION_EVENTS_FILE = prevFile;
  clearConversionHooks();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

try {
  process.env.HH_CONVERSION_GLUE = '0';
  const off = emitConversionEvent('vacancy.ingested', { recordId: 'x' });
  assert.equal(off.skipped, true);
  assert.ok(!fs.existsSync(eventsFile), 'no file when disabled');

  delete process.env.HH_CONVERSION_GLUE;
  const on = emitConversionEvent(
    'vacancy.ingested',
    { recordId: 'rec-test', source: 'hh' },
    { correlationId: 'rec-test', recordId: 'rec-test', phase: 'vacancy.ingested' }
  );
  assert.equal(on.ok, true);
  assert.ok(fs.existsSync(eventsFile));

  const { events } = readConversionEvents({ limit: 10 });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'vacancy.ingested');
  assert.deepEqual(validateObsEventRow(events[0]), []);

  let hookRan = false;
  registerConversionHook('vacancy.ingested', async (ctx) => {
    hookRan = ctx.payload?.recordId === 'rec-test';
  });
  const hookRes = await runConversionHooks('vacancy.ingested', { payload: { recordId: 'rec-test' } });
  assert.equal(hookRes.ran, 1);
  assert.ok(hookRan);

  const types = listRegisteredEventTypes();
  assert.ok(types.includes('apply.batch.finished'));

  assert.equal(typeof isConversionGlueEnabled(), 'boolean');

  const direct = emitObsEvent('glue.ping', { ok: true }, {
    correlationId: 'ping-1',
    skipEnabledCheck: true,
  });
  assert.equal(direct.ok, true);

  console.log('test-conversion-glue: OK');
} finally {
  cleanup();
}
