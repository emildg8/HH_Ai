/**
 * Режим окна Playwright (harvest / batch).
 *   node scripts/test-playwright-display-mode.mjs
 */
import assert from 'node:assert/strict';
import {
  normalizePlaywrightDisplayMode,
  resolvePlaywrightDisplay,
  playwrightDisplayEnv,
  PLAYWRIGHT_DISPLAY_MODES,
} from '../lib/playwright-display-mode.mjs';

const saved = { ...process.env };

function restoreEnv() {
  for (const k of Object.keys(process.env)) {
    if (!(k in saved)) delete process.env[k];
  }
  Object.assign(process.env, saved);
}

function withEnv(patch, fn) {
  restoreEnv();
  Object.assign(process.env, patch);
  try {
    return fn();
  } finally {
    restoreEnv();
  }
}

assert.equal(normalizePlaywrightDisplayMode(''), PLAYWRIGHT_DISPLAY_MODES.hiddenCaptcha);
assert.equal(normalizePlaywrightDisplayMode('visible'), PLAYWRIGHT_DISPLAY_MODES.visible);

withEnv({}, () => {
  const harvest = resolvePlaywrightDisplay('harvest', {});
  assert.equal(harvest.headless, true);
  assert.equal(harvest.captchaEscalate, true);

  const batch = resolvePlaywrightDisplay('batch', {});
  assert.equal(batch.headless, false);
  assert.equal(batch.browserBackground, true);
  assert.equal(batch.captchaEscalate, true);
});

withEnv({ HH_PLAYWRIGHT_DISPLAY_MODE: 'visible' }, () => {
  const h = resolvePlaywrightDisplay('harvest', {});
  assert.equal(h.headless, false);
  assert.equal(h.browserBackground, false);
  const env = playwrightDisplayEnv('batch', {});
  assert.equal(env.HH_HEADLESS, '0');
  assert.equal(env.HH_BROWSER_BACKGROUND, '0');
});

withEnv({ HH_PLAYWRIGHT_DISPLAY_MODE: 'headless' }, () => {
  const b = resolvePlaywrightDisplay('batch', {});
  assert.equal(b.headless, true);
  assert.equal(b.captchaEscalate, false);
  assert.equal(playwrightDisplayEnv('batch', {}).HH_CAPTCHA_ESCALATE, '0');
});

withEnv({}, () => {
  const env = playwrightDisplayEnv('harvest', { dashboardPlaywrightDisplayMode: 'hidden-captcha' });
  assert.equal(env.HH_HEADLESS, '1');
  assert.equal(env.HH_CAPTCHA_ESCALATE, '1');
});

console.log('test-playwright-display-mode: ok');
