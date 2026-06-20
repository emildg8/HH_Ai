#!/usr/bin/env node
/**
 * Preflight перед демо суфлёра (5 мин).
 *   npm run demo:copilot-preflight
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'dashboard/public/interview-copilot-ui.mjs',
  'dashboard/public/teleprompter.html',
  'dashboard/public/teleprompter-prep.html',
  'dashboard/public/teleprompter-shared.css',
  'docs/DEMO-COPILOT-5MIN.md',
  'lib/interview-copilot-qa.mjs',
  'lib/interview-copilot-offer-guard.mjs',
  'scripts/fixtures/offer-guard-cases.json',
];

let fail = 0;
for (const f of required) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${f}`);
    fail++;
  } else {
    console.log(`OK  ${f}`);
  }
}

const tests = spawnSync('npm', ['run', 'test:copilot'], { cwd: ROOT, stdio: 'inherit', shell: true });
if (tests.status !== 0) fail++;

if (fail) {
  console.error(`\n[demo-preflight] FAIL (${fail} issues)`);
  process.exit(1);
}
console.log('\n[demo-preflight] Готово к демо — откройте docs/DEMO-COPILOT-5MIN.md');
