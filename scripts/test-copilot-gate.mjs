#!/usr/bin/env node
/**
 * Gate всех тестов interview copilot.
 *   npm run test:copilot
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'scripts/test-interview-copilot-qa.mjs',
  'scripts/test-interview-copilot-live.mjs',
  'scripts/test-interview-copilot-spoken.mjs',
  'scripts/test-interview-copilot-offer-guard.mjs',
  'scripts/test-interview-speaker-role.mjs',
  'scripts/test-interview-copilot-replay.mjs',
  'scripts/test-interview-prompt.mjs',
  'scripts/test-interview-copilot-ui.mjs',
  'scripts/test-interview-copilot-latency.mjs',
];

let failed = 0;
for (const script of tests) {
  const label = path.basename(script, '.mjs');
  const r = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error(`[test:copilot] FAIL ${label}`);
    failed++;
  }
}

if (failed) process.exit(1);
console.log('[test:copilot] OK');
