#!/usr/bin/env node
/**
 * Smoke: HTML панели copilot и словарь copy.
 */
import assert from 'node:assert/strict';
import { renderCopilotPanelHtml } from '../dashboard/public/interview-copilot-ui.mjs';
import {
  COPILOT_TAB_LABELS,
  copilotGuardLabel,
} from '../dashboard/public/dashboard-copy-ru.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const html = renderCopilotPanelHtml();
assert.ok(html.includes('copilot-tabs'), 'tabs shell');
assert.ok(html.includes('copilot-panel-prep'), 'prep panel');
assert.ok(html.includes('copilot-panel-live'), 'live panel');
assert.ok(html.includes('copilot-panel-replay'), 'replay panel');
assert.ok(html.includes('copilot-panel-post'), 'post panel');
assert.ok(!html.includes('interview-copilot-panel__debrief" hidden'), 'debrief not hidden in replay');
assert.ok(html.includes('data-copilot-action="desktop-live"'), 'primary CTA');
assert.equal(Object.keys(COPILOT_TAB_LABELS).length, 4);
assert.equal(copilotGuardLabel('star_weak'), 'Добавьте пример (СТАР)');
assert.ok(fs.existsSync(path.join(ROOT, 'dashboard/public/teleprompter-prep.html')));
assert.ok(fs.existsSync(path.join(ROOT, 'dashboard/public/teleprompter-shared.css')));

const personaFixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/fixtures/copilot-ux-persona-checklist.json'), 'utf8')
);
let personaScore = 0;
let personaMax = 0;
for (const p of personaFixture.personas) {
  for (const c of p.criteria) {
    personaMax++;
    const needle = personaFixture.html_assertions[c];
    if (needle && html.includes(needle)) personaScore++;
  }
}
assert.ok(personaScore >= personaMax - 2, `persona gate ${personaScore}/${personaMax}`);

console.log('test-interview-copilot-ui: OK');
