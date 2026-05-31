/**
 * Smoke: константы мобильной вёрстки v4.
 *   node scripts/test-mobile-layout.mjs
 */

import assert from 'node:assert/strict';
import { MOBILE_BREAKPOINT_PX, isMobileViewport } from '../dashboard/public/ui-mobile.mjs';

assert.equal(MOBILE_BREAKPOINT_PX, 1024);
assert.equal(typeof isMobileViewport(), 'boolean');

console.log('test-mobile-layout: OK');
