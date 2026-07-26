import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../lib/paths.mjs';
import {
  acquireBrowserLock,
  getBrowserLockInfo,
  releaseBrowserLock,
} from '../lib/chromium-session.mjs';

const lockFile = path.join(DATA_DIR, 'session', 'browser.lock');
const previousLock = fs.existsSync(lockFile) ? fs.readFileSync(lockFile, 'utf8') : null;

if (getBrowserLockInfo().held) {
  throw new Error('Cannot run browser-lock test while a browser session is active');
}

try {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(
    lockFile,
    JSON.stringify({
      pid: process.pid,
      owner: 'long-running-test',
      at: Date.now() - 60 * 60 * 1000,
    }),
    'utf8'
  );

  const info = getBrowserLockInfo();
  assert.equal(info.held, true, 'a live browser owner must not expire based on lock age');
  assert.equal(info.stale, false);

  await assert.rejects(
    acquireBrowserLock('contending-test', { timeoutMs: 25 }),
    /Профиль браузера занят/,
    'a contender must not replace an old lock whose owner is still alive'
  );

  const saved = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  assert.equal(saved.owner, 'long-running-test');
  console.log('test-chromium-lock: OK');
} finally {
  releaseBrowserLock();
  if (previousLock !== null) {
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, previousLock, 'utf8');
  } else if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
  }
}
