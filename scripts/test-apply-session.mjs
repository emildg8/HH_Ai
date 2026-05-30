/**
 * Статическая проверка scripts/apply.mjs — общий Chromium lock/launch.
 *   node scripts/test-apply-session.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'apply.mjs'), 'utf8');

assert.match(src, /launchPersistentContextSafe/, 'apply.mjs должен использовать launchPersistentContextSafe');
assert.match(src, /closeContextSafe/, 'apply.mjs должен закрывать контекст через closeContextSafe');
assert.match(src, /assertHhLoggedIn/, 'apply.mjs должен проверять вход через assertHhLoggedIn');
assert.match(src, /clearStaleBrowserLock/, 'apply.mjs должен снимать устаревший browser.lock');
assert.doesNotMatch(
  src,
  /chromium\.launchPersistentContext\s*\(/,
  'apply.mjs не должен вызывать chromium.launchPersistentContext напрямую'
);

console.log('test-apply-session: OK');
