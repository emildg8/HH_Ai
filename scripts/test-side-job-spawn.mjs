/**
 * Unit: spawn фоновых задач и preferences.
 */
import assert from 'node:assert/strict';
import { backgroundSpawnOptions } from '../lib/spawn-background.mjs';
import { hideSideJobConsole, sideJobsHeadless, sideJobHeadlessEnv } from '../lib/side-job-spawn.mjs';

if (process.platform === 'win32') {
  assert.equal(backgroundSpawnOptions({}).windowsHide, true, 'windowsHide default true');
  assert.equal(backgroundSpawnOptions({}, false).windowsHide, false, 'windowsHide can be off');
}

assert.equal(hideSideJobConsole({}), true, 'hideSideJobConsole default true');
assert.equal(hideSideJobConsole({ hideSideJobConsole: false }), false, 'hideSideJobConsole respects pref');
assert.equal(sideJobsHeadless({}), true, 'sideJobsHeadless default true');
assert.equal(sideJobsHeadless({ sideJobsHeadless: false }), false, 'sideJobsHeadless respects pref');
assert.equal(sideJobHeadlessEnv({ sideJobsHeadless: false }).HH_HEADLESS, '0', 'headless env off');

console.log('OK: test-side-job-spawn.mjs');
